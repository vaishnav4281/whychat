// ─── WhyChat Switchboard ──────────────────────────────────────────────────
// Cloudflare Workers WebSocket signaling server.
// No KV, D1, or external storage — all state is in-memory per-isolate.
// Free-tier safe: lightweight message handling, idle-drain, rate limiting.
// ────────────────────────────────────────────────────────────────────────────

// ─── In-memory state ───────────────────────────────────────────────────────
const clientsBySocket = new Map();   // WebSocket → Client
const clientsById    = new Map();    // id → Client
const videoQueue     = new Set();    // Set of client ids waiting for a match
const rateLimits     = new Map();    // id → { count, windowStart }

const CONNECTION_TTL        = 180_000; // 3 min idle → automatic cleanup
const RATE_WINDOW           = 1_000;   // 1 second window
const RATE_MAX              = 30;      // max messages per window
const HEARTBEAT_INTERVAL    = 15_000;  // push ping every 15s

// CORS for /health and any HTTP fallback
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
};

const RELAY_TYPES = new Set([
  'CHAT_INIT', 'FRIEND_REQ', 'FRIEND_ACCEPT', 'signal_relay'
]);

// Only these fields are forwarded in relay payloads
const SAFE_FIELDS = new Set([
  'id','name','nickname','avatar','country','languages',
  'gender','peerId','peerDetails','signal'
]);

// ─── Helpers ───────────────────────────────────────────────────────────────

function json(type, data) {
  return JSON.stringify({ type, data });
}

function send(client, type, data) {
  if (client.closed) return;
  try {
    client.ws.send(json(type, data));
  } catch {
    close(client);
  }
}

// Throttled broadcast of online count to every connected client
let broadcastQueued = false;
function queueBroadcast() {
  if (broadcastQueued) return;
  broadcastQueued = true;
  queueMicrotask(() => {
    broadcastQueued = false;
    const payload = { online: clientsById.size };
    for (const c of clientsBySocket.values()) {
      if (!c.closed) send(c, 'global_metrics', payload);
    }
  });
}

function safeProfile(c) {
  return c.profile ? { id: c.id, ...c.profile } : { id: c.id };
}

function matchFilters(profile, filters = {}) {
  if (!profile) return false;
  if (filters.gender   && filters.gender   !== 'all' && profile.gender   !== filters.gender)   return false;
  if (filters.country  && filters.country  !== 'all' && profile.country  !== filters.country)   return false;
  if (filters.language && filters.language !== 'all' && !(profile.languages || []).includes(filters.language)) return false;
  return true;
}

function safeRelay(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SAFE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function relayMessage(sender, msg) {
  const target = clientsById.get(msg.target);
  if (!target || target.closed) return;

  const data = safeRelay(msg.data);

  if (msg.type === 'signal_relay') {
    // Forward raw signal (SDP / ICE) — frontend WebRTC parses it
    send(target, 'signal_relay', { peerId: sender.id, signal: data.signal });
    return;
  }

  send(target, msg.type, data);
}

// ─── Video queue matching ──────────────────────────────────────────────────

function tryMatch(client) {
  // Remove self in case they were already queued
  videoQueue.delete(client.id);

  // Walk queue (insertion order) — first suitable partner wins
  for (const pid of videoQueue) {
    const partner = clientsById.get(pid);
    if (!partner || partner.closed || partner.id === client.id) {
      videoQueue.delete(pid);
      continue;
    }

    // Found a match
    videoQueue.delete(pid);

    send(client, 'match_found', {
      peerId: partner.id,
      peer: safeProfile(partner),
      initiateCall: true,
    });

    send(partner, 'match_found', {
      peerId: client.id,
      peer: safeProfile(client),
      initiateCall: false,
    });

    return; // matched
  }

  // No match yet — enqueue
  videoQueue.add(client.id);
}

// ─── Rate limiter ──────────────────────────────────────────────────────────

function rateCheck(client) {
  const now = Date.now();
  let entry = rateLimits.get(client.id);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    entry = { count: 0, windowStart: now };
    rateLimits.set(client.id, entry);
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

// ─── Connection lifecycle ──────────────────────────────────────────────────

function close(client) {
  if (client.closed) return;
  client.closed = true;

  clientsBySocket.delete(client.ws);
  clientsById.delete(client.id);
  videoQueue.delete(client.id);
  rateLimits.delete(client.id);

  if (client.idleTimer) clearTimeout(client.idleTimer);
  if (client.heartTimer) clearInterval(client.heartTimer);

  try { client.ws.close(1000, 'bye'); } catch {}

  queueBroadcast();
}

// Touch the idle timer — any message / open resets it
function touchIdle(client) {
  if (client.idleTimer) clearTimeout(client.idleTimer);
  client.idleTimer = setTimeout(() => close(client), CONNECTION_TTL);
}

// ─── Message router ────────────────────────────────────────────────────────

function onMessage(client, raw) {
  // Reset idle timer on every message
  touchIdle(client);

  let msg;
  try { msg = JSON.parse(raw); } catch {
    send(client, 'error', { message: 'invalid json' });
    return;
  }

  // Heartbeat
  if (msg.type === 'ping') { send(client, 'pong', { ts: Date.now() }); return; }
  if (msg.type === 'pong') return;

  // Rate limit
  if (!rateCheck(client)) {
    send(client, 'error', { message: 'rate limited' });
    return;
  }

  switch (msg.type) {

    // ── Register / update profile ────────────────────────────────────────
    case 'join_pool': {
      const profile = msg.data || {};
      const newId   = profile.id || client.id;

      // If another connection holds this ID, evict it
      const existing = clientsById.get(newId);
      if (existing && existing !== client) {
        existing.closed = true;
        clientsBySocket.delete(existing.ws);
        clientsById.delete(newId);
        videoQueue.delete(newId);
        rateLimits.delete(newId);
        if (existing.idleTimer) clearTimeout(existing.idleTimer);
        if (existing.heartTimer) clearInterval(existing.heartTimer);
        try { existing.ws.close(1000, 'replaced'); } catch {}
      }

      // Remove old id mapping if the client changed its id
      if (client.id !== newId) clientsById.delete(client.id);

      client.id      = newId;
      client.profile = profile;
      clientsById.set(client.id, client);

      queueBroadcast();
      break;
    }

    // ── Explore query ────────────────────────────────────────────────────
    case 'fetch_explore': {
      const filters = msg.data || {};
      const peers = [];
      for (const c of clientsById.values()) {
        if (c.id === client.id || c.closed) continue;
        if (!c.profile || (!c.profile.name && !c.profile.nickname)) continue;
        const p = safeProfile(c);
        if (matchFilters(p, filters)) peers.push(p);
      }
      send(client, 'explore_data', peers);
      break;
    }

    // ── Video queue ───────────────────────────────────────────────────────
    case 'join_video_queue':
      tryMatch(client);
      break;

    case 'leave_video':
      videoQueue.delete(client.id);
      break;

    // ── Relay (friend requests, chat init, WebRTC signals) ────────────────
    default:
      if (RELAY_TYPES.has(msg.type)) {
        relayMessage(client, msg);
      }
      break;
  }
}

// ─── WebSocket handler ─────────────────────────────────────────────────────

function handleWebSocket(request) {
  const pair = new WebSocketPair();
  const [clientWs, serverWs] = Object.values(pair);
  serverWs.accept();

  const client = {
    id:       crypto.randomUUID(),
    profile:  null,
    ws:       serverWs,
    closed:   false,
    idleTimer: null,
    heartTimer: null,
  };

  clientsBySocket.set(serverWs, client);
  clientsById.set(client.id, client);
  touchIdle(client);

  // Server-pushed heartbeat to detect dead peers faster
  client.heartTimer = setInterval(() => {
    if (client.closed) { clearInterval(client.heartTimer); return; }
    try { client.ws.send(json('ping', { ts: Date.now() })); } catch { close(client); }
  }, HEARTBEAT_INTERVAL);

  serverWs.addEventListener('message', (e) => onMessage(client, e.data));
  serverWs.addEventListener('close',    () => close(client));
  serverWs.addEventListener('error',    () => close(client));

  queueBroadcast();
  return new Response(null, { status: 101, webSocket: clientWs });
}

// ─── Entry point ───────────────────────────────────────────────────────────

export default {
  fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // WebSocket upgrade
    const upgrade = request.headers.get('upgrade');
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      return handleWebSocket(request);
    }

    // Health-check endpoint
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json(
        { ok: true, online: clientsById.size, queued: videoQueue.size },
        { headers: CORS }
      );
    }

    return new Response('WhyChat switchboard is running.', {
      headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS },
    });
  },
};
