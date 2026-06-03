// worker.js - Ephemeral WebRTC & WebSocket Router for WhyChat
// Optimized with High-Performance DSA for Zero-Database Scaling

const clientsBySocket = new Map();
const clientsById = new Map();
const videoQueue = []; // Strictly handled as a FIFO Queue

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

function broadcastPoolUpdate() {
  for (const client of clientsBySocket.values()) {
    send(client, "pool_update", {});
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
  const index = videoQueue.indexOf(clientId);
  if (index !== -1) {
    videoQueue.splice(index, 1);
  }
}

function joinVideoQueue(client) {
  removeFromVideoQueue(client.id);

  // O(1) Queue Logic: Pull the first candidate who isn't self and is still connected
  while (videoQueue.length > 0) {
    const partnerId = videoQueue.shift(); // Remove from front of queue
    const partner = clientsById.get(partnerId);

    // If partner exists and is still online, perform match
    if (partner && partner.id !== client.id) {
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

  // No valid matching candidates found; join the queue
  videoQueue.push(client.id);
}

function cleanup(client) {
  if (client.cleanedUp) return;
  client.cleanedUp = true;
  clearInterval(client.heartbeat);
  clientsBySocket.delete(client.socket);
  clientsById.delete(client.id);
  removeFromVideoQueue(client.id);

  try {
    client.socket.close();
  } catch {
    // Socket is already terminated
  }

  setTimeout(() => {
    broadcastMetrics();
    broadcastPoolUpdate();
  }, 0);
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
    client.waitingForPong = false;
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
    broadcastPoolUpdate();
    return;
  }

  if (message.type === "fetch_explore") {
    // High-Performance Optimization: Single-pass iteration to prevent memory thrashing
    const peers = [];
    const filterCriteria = message.data ?? {};
    
    for (const peer of clientsById.values()) {
      if (peer.id === client.id) continue;
      
      const profile = publicProfile(peer);
      if (matchesFilters(profile, filterCriteria)) {
        peers.push(profile);
      }
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
    waitingForPong: false,
  };

  clientsBySocket.set(serverSocket, client);
  clientsById.set(client.id, client);

  serverSocket.addEventListener("message", (event) => {
    handleMessage(client, event.data);
  });
  serverSocket.addEventListener("close", () => cleanup(client));
  serverSocket.addEventListener("error", () => cleanup(client));

  client.heartbeat = setInterval(() => {
    if (client.waitingForPong) {
      cleanup(client);
      return;
    }
    client.waitingForPong = true;
    send(client, "ping", { ts: Date.now() });
  }, HEARTBEAT_MS);

  // Send baseline metric frame immediately to newly initialized socket
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
