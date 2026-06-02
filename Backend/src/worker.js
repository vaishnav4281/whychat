const clientsBySocket = new Map();
const clientsById = new Map();
const videoQueue = [];

const HEARTBEAT_MS = 25000;

function json(type, data) {
  return JSON.stringify({ type, data });
}

function send(client, type, data) {
  try {
    client.socket.send(json(type, data));
  } catch {
    cleanup(client);
  }
}

function broadcastMetrics() {
  const data = { online: clientsById.size };
  for (const client of clientsBySocket.values()) {
    send(client, "global_metrics", data);
  }
}

function publicProfile(client) {
  return {
    ...(client.profile ?? {}),
    id: client.id,
  };
}

function matchesFilters(profile, filters = {}) {
  if (!profile) return false;
  if (filters.gender && filters.gender !== "all" && profile.gender !== filters.gender) {
    return false;
  }
  if (filters.country && filters.country !== "all" && profile.country !== filters.country) {
    return false;
  }
  if (
    filters.language &&
    filters.language !== "all" &&
    !profile.languages?.includes(filters.language)
  ) {
    return false;
  }
  return true;
}

function relay(sender, message) {
  const target = clientsById.get(message.target);
  if (!target) return;

  if (message.type === "signal_relay") {
    send(target, "signal_relay", {
      peerId: sender.id,
      signal: message.data,
    });
    return;
  }

  send(target, message.type, message.data);
}

function removeFromVideoQueue(clientId) {
  let index = videoQueue.indexOf(clientId);
  while (index !== -1) {
    videoQueue.splice(index, 1);
    index = videoQueue.indexOf(clientId);
  }
}

function joinVideoQueue(client) {
  removeFromVideoQueue(client.id);

  const partnerId = videoQueue.find((id) => id !== client.id && clientsById.has(id));
  if (!partnerId) {
    videoQueue.push(client.id);
    return;
  }

  removeFromVideoQueue(partnerId);
  const partner = clientsById.get(partnerId);
  if (!partner) {
    videoQueue.push(client.id);
    return;
  }

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
}

function cleanup(client) {
  clearInterval(client.heartbeat);
  clientsBySocket.delete(client.socket);
  clientsById.delete(client.id);
  removeFromVideoQueue(client.id);

  try {
    client.socket.close();
  } catch {
    // Socket is already closed.
  }

  broadcastMetrics();
}

function handleMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send(client, "error", { message: "Invalid JSON payload" });
    return;
  }

  if (message.type === "pong") {
    client.lastPong = Date.now();
    return;
  }

  if (message.type === "join_pool") {
    const previousId = client.id;
    const profile = message.data ?? {};
    client.id = profile.id || previousId;
    client.profile = profile;

    if (previousId !== client.id) {
      clientsById.delete(previousId);
    }
    clientsById.set(client.id, client);
    broadcastMetrics();
    return;
  }

  if (message.type === "fetch_explore") {
    const peers = [...clientsById.values()]
      .filter((peer) => peer.id !== client.id)
      .map(publicProfile)
      .filter((profile) => matchesFilters(profile, message.data));
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

  if (
    message.type === "CHAT_INIT" ||
    message.type === "FRIEND_REQ" ||
    message.type === "FRIEND_ACCEPT" ||
    message.type === "signal_relay"
  ) {
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
    lastPong: Date.now(),
    heartbeat: null,
  };

  clientsBySocket.set(serverSocket, client);
  clientsById.set(client.id, client);

  serverSocket.addEventListener("message", (event) => {
    handleMessage(client, event.data);
  });
  serverSocket.addEventListener("close", () => cleanup(client));
  serverSocket.addEventListener("error", () => cleanup(client));

  client.heartbeat = setInterval(() => {
    if (Date.now() - client.lastPong > HEARTBEAT_MS * 2) {
      cleanup(client);
      return;
    }
    send(client, "ping", { ts: Date.now() });
  }, HEARTBEAT_MS);

  send(client, "global_metrics", { online: clientsById.size });
  broadcastMetrics();

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
  });
}

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get("upgrade") === "websocket") {
      return handleWebSocket(request);
    }

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        online: clientsById.size,
        queued: videoQueue.length,
      });
    }

    return new Response("WhyChat switchboard is running.", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
