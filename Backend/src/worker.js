const clientsBySocket = new Map();
const clientsById = new Map();
const videoQueue = new Set();
const rateLimits = new Map();
const CONNECTION_TIMEOUT = 120_000; // 2 min idle -> close

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
};

const RELAY_ALLOWED_TYPES = new Set(['CHAT_INIT', 'FRIEND_REQ', 'FRIEND_ACCEPT', 'signal_relay']);
const RELAY_SAFE_FIELDS = new Set(['id', 'name', 'nickname', 'avatar', 'country', 'languages', 'gender', 'peerId', 'peerDetails', 'signal']);

const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 30;

let broadcastDirty = false;

function json(type, data) {
  return JSON.stringify({ type, data });
}

function send(client, type, data) {
  if (client.cleanedUp) return;
  try {
    client.socket.send(json(type, data));
  } catch {
    cleanup(client);
  }
}

function scheduleBroadcast() {
  if (broadcastDirty) return;
  broadcastDirty = true;
  queueMicrotask(() => {
    broadcastDirty = false;
    const data = { online: clientsById.size };
    for (const client of clientsBySocket.values()) {
      if (!client.cleanedUp) send(client, "global_metrics", data);
    }
  });
}

function publicProfile(client) {
  return client.profile ? { id: client.id, ...client.profile } : { id: client.id };
}

function matchesFilters(profile, filters = {}) {
  if (!profile) return false;
  if (filters.gender && filters.gender !== "all" && profile.gender !== filters.gender) return false;
  if (filters.country && filters.country !== "all" && profile.country !== filters.country) return false;
  if (filters.language && filters.language !== "all" && !profile.languages?.includes(filters.language)) return false;
  return true;
}

function sanitizeRelayPayload(data) {
  if (!data || typeof data !== 'object') return data;
  const safe = {};
  for (const [key, value] of Object.entries(data)) {
    if (RELAY_SAFE_FIELDS.has(key)) safe[key] = value;
  }
  return safe;
}

function relay(sender, message) {
  const target = clientsById.get(message.target);
  if (!target || target.cleanedUp) return;
  const safeData = sanitizeRelayPayload(message.data);

  if (message.type === "signal_relay") {
    send(target, "signal_relay", { peerId: sender.id, signal: safeData.signal });
    return;
  }

  send(target, message.type, safeData);
}

function removeFromVideoQueue(clientId) {
  videoQueue.delete(clientId);
}

function joinVideoQueue(client) {
  videoQueue.delete(client.id);

  for (const partnerId of videoQueue) {
    videoQueue.delete(partnerId);
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

  videoQueue.add(client.id);
}

function checkRateLimit(client) {
  const now = Date.now();
  let entry = rateLimits.get(client.id);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry = { count: 0, windowStart: now };
    rateLimits.set(client.id, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

function cleanup(client) {
  if (client.cleanedUp) return;
  client.cleanedUp = true;
  clientsBySocket.delete(client.socket);
  clientsById.delete(client.id);
  videoQueue.delete(client.id);
  rateLimits.delete(client.id);
  if (client.idleTimer) clearTimeout(client.idleTimer);
  try { client.socket.close(1000, "cleanup"); } catch {}
  scheduleBroadcast();
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, "error", { message: "Invalid JSON" });
    return;
  }

  if (message.type === "ping") { send(client, "pong", { ts: Date.now() }); return; }
  if (message.type === "pong") return;

  if (!checkRateLimit(client)) {
    send(client, "error", { message: "rate limited" });
    return;
  }

  if (message.type === "join_pool") {
    const profile = message.data ?? {};
    const newId = profile.id || client.id;
    const existing = clientsById.get(newId);

    if (existing && existing !== client) {
      existing.cleanedUp = true;
      clientsBySocket.delete(existing.socket);
      clientsById.delete(newId);
      videoQueue.delete(newId);
      rateLimits.delete(newId);
      if (existing.idleTimer) clearTimeout(existing.idleTimer);
      try { existing.socket.close(1000, "replaced"); } catch {}
    }

    const oldId = client.id;
    if (oldId !== newId) clientsById.delete(oldId);

    client.id = newId;
    client.profile = profile;
    clientsById.set(client.id, client);
    scheduleBroadcast();
    return;
  }

  if (message.type === "fetch_explore") {
    const peers = [];
    const filters = message.data ?? {};
    for (const peer of clientsById.values()) {
      if (peer.id === client.id || peer.cleanedUp) continue;
      if (!peer.profile?.name && !peer.profile?.nickname) continue;
      const profile = publicProfile(peer);
      if (matchesFilters(profile, filters)) peers.push(profile);
    }
    send(client, "explore_data", peers);
    return;
  }

  if (message.type === "join_video_queue") { joinVideoQueue(client); return; }
  if (message.type === "leave_video") { videoQueue.delete(client.id); return; }

  if (RELAY_ALLOWED_TYPES.has(message.type)) {
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
    idleTimer: null,
  };

  // Reset idle timer on any activity
  function touchIdle() {
    if (client.idleTimer) clearTimeout(client.idleTimer);
    client.idleTimer = setTimeout(() => cleanup(client), CONNECTION_TIMEOUT);
  }

  clientsBySocket.set(serverSocket, client);
  clientsById.set(client.id, client);
  touchIdle();

  serverSocket.addEventListener("message", (event) => {
    touchIdle();
    handleMessage(client, event.data);
  });

  serverSocket.addEventListener("close", () => cleanup(client));
  serverSocket.addEventListener("error", () => cleanup(client));

  scheduleBroadcast();
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
        { ok: true, online: clientsById.size, queued: videoQueue.size },
        { headers: CORS_HEADERS }
      );
    }
    return new Response("WhyChat switchboard is running.", {
      headers: { "content-type": "text/plain; charset=utf-8", ...CORS_HEADERS },
    });
  },
};
