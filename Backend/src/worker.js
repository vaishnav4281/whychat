// worker.js - WhyChat Signaling Server
// Compatible with Cloudflare Workers - NO setInterval/setTimeout for background work
// Heartbeating is client-driven: clients send {type:"pong"} responses to server pings
// Server pings are sent inline when messages arrive (lazy heartbeat pattern)

const clientsBySocket = new Map();
const clientsById = new Map();
const videoQueue = [];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
};

function json(type, data) {
  return JSON.stringify({ type, data });
}

function send(client, type, data) {
  if (client.cleanedUp) return;
  try {
    if (client.socket.readyState === WebSocket.OPEN || client.socket.readyState === 1) {
      client.socket.send(json(type, data));
    }
  } catch {
    cleanup(client);
  }
}

function broadcastMetrics() {
  const data = { online: clientsById.size };
  for (const client of clientsBySocket.values()) {
    if (!client.cleanedUp) send(client, "global_metrics", data);
  }
}

function broadcastPoolUpdate() {
  for (const client of clientsBySocket.values()) {
    if (!client.cleanedUp) send(client, "pool_update", {});
  }
}

function publicProfile(client) {
  return { ...(client.profile ?? {}), id: client.id };
}

function matchesFilters(profile, filters = {}) {
  if (!profile) return false;
  if (filters.gender && filters.gender !== "all" && profile.gender !== filters.gender) return false;
  if (filters.country && filters.country !== "all" && profile.country !== filters.country) return false;
  if (filters.language && filters.language !== "all" && !profile.languages?.includes(filters.language)) return false;
  return true;
}

function relay(sender, message) {
  const target = clientsById.get(message.target);
  if (!target || target.cleanedUp) return;

  if (message.type === "signal_relay") {
    send(target, "signal_relay", { peerId: sender.id, signal: message.data });
    return;
  }

  if (message.type === "FRIEND_REQ") {
    send(target, "FRIEND_REQ", {
      id: sender.id,
      name: sender.profile?.name || sender.profile?.nickname || "Stranger",
      avatar: sender.profile?.avatar || "",
      country: sender.profile?.country || "",
      nickname: sender.profile?.nickname || sender.profile?.name || "Stranger",
      ...message.data,
    });
    return;
  }

  send(target, message.type, message.data);
}

function removeFromVideoQueue(clientId) {
  const index = videoQueue.indexOf(clientId);
  if (index !== -1) videoQueue.splice(index, 1);
}

function joinVideoQueue(client) {
  removeFromVideoQueue(client.id);

  while (videoQueue.length > 0) {
    const partnerId = videoQueue.shift();
    const partner = clientsById.get(partnerId);
    if (partner && partner.id !== client.id && !partner.cleanedUp) {
      send(client, "match_found", {
        peerId: partner.id,
        peer: publicProfile(partner),
        initiateCall: true,
      });
      send(partner, "match_found", {
        peerId: client.id,
        peer: publicProfile(client),
        initiateCall: false,
      });
      return;
    }
  }

  videoQueue.push(client.id);
}

function cleanup(client) {
  if (client.cleanedUp) return;
  client.cleanedUp = true;
  clientsBySocket.delete(client.socket);
  clientsById.delete(client.id);
  removeFromVideoQueue(client.id);
  try { client.socket.close(); } catch { /* already closed */ }
  broadcastMetrics();
  broadcastPoolUpdate();
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, "error", { message: "Invalid JSON" });
    return;
  }

  // Respond to client pings — keeps connection alive without setInterval
  if (message.type === "ping") {
    send(client, "pong", { ts: Date.now() });
    return;
  }

  // Client acknowledging our pong
  if (message.type === "pong") {
    return;
  }

  if (message.type === "join_pool") {
    const profile = message.data ?? {};
    const newId = profile.id || client.id;

    // Evict stale socket with same ID (reconnect scenario)
    const existing = clientsById.get(newId);
    if (existing && existing !== client) {
      existing.cleanedUp = true;
      clientsBySocket.delete(existing.socket);
      clientsById.delete(newId);
      try { existing.socket.close(); } catch { /* already closed */ }
    }

    const oldId = client.id;
    client.id = newId;
    client.profile = profile;

    if (oldId !== newId) clientsById.delete(oldId);
    clientsById.set(client.id, client);

    // Send immediate metrics to this client
    send(client, "global_metrics", { online: clientsById.size });
    broadcastMetrics();
    broadcastPoolUpdate();
    return;
  }

  if (message.type === "fetch_explore") {
    const peers = [];
    const filters = message.data ?? {};
    for (const peer of clientsById.values()) {
      if (peer.id === client.id || peer.cleanedUp) continue;
      if (!peer.profile?.name && !peer.profile?.nickname) continue; // skip unregistered
      const profile = publicProfile(peer);
      if (matchesFilters(profile, filters)) peers.push(profile);
    }
    send(client, "explore_data", peers);
    return;
  }

  if (message.type === "join_video_queue") {
    joinVideoQueue(client);
    return;
  }

  if (message.type === "leave_video") {
    removeFromVideoQueue(client.id);
    return;
  }

  if (["CHAT_INIT", "FRIEND_REQ", "FRIEND_ACCEPT", "signal_relay"].includes(message.type)) {
    relay(client, message);
  }
}

function handleWebSocket(request) {
  const pair = new WebSocketPair();
  const [clientSocket, serverSocket] = Object.values(pair);

  serverSocket.accept();

  const client = {
    id: crypto.randomUUID(),
    profile: null,
    socket: serverSocket,
    cleanedUp: false,
  };

  clientsBySocket.set(serverSocket, client);
  clientsById.set(client.id, client);

  serverSocket.addEventListener("message", (event) => {
    handleMessage(client, event.data);
  });

  serverSocket.addEventListener("close", () => cleanup(client));
  serverSocket.addEventListener("error", () => cleanup(client));

  // Immediately send current metrics to the newly connected client
  send(client, "global_metrics", { online: clientsById.size });
  broadcastMetrics();

  // Return the 101 upgrade response immediately — NO setInterval
  return new Response(null, { status: 101, webSocket: clientSocket });
}

export default {
  fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return handleWebSocket(request);
    }

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json(
        { ok: true, online: clientsById.size, queued: videoQueue.length },
        { headers: CORS_HEADERS }
      );
    }

    return new Response("WhyChat switchboard is running.", {
      headers: { "content-type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  },
};
