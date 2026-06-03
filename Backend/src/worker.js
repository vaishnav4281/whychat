// ─── WhyChat Switchboard ──────────────────────────────────────────────────
// Cloudflare Workers WebSocket signaling server using Durable Objects for
// shared state across all WebSocket connections.
// ───────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
};

const RELAY_TYPES = new Set([
  'CHAT_INIT', 'FRIEND_REQ', 'FRIEND_ACCEPT', 'signal_relay'
]);

const SAFE_FIELDS = new Set([
  'id','name','nickname','avatar','country','languages',
  'gender','peerId','peerDetails','signal'
]);

function json(type, data) {
  return JSON.stringify({ type, data });
}

function safeRelay(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (SAFE_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

// ─── Durable Object ────────────────────────────────────────────────────────

export class SwitchboardDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clientsBySocket = new Map();
    this.clientsById    = new Map();
    this.videoQueue     = new Set();
    this.rateLimits     = new Map();
    this._broadcastQueued = false;

    this.CONNECTION_TTL     = 180_000;
    this.RATE_WINDOW        = 1_000;
    this.RATE_MAX           = 30;
    this.HEARTBEAT_INTERVAL = 15_000;
  }

  // ── Internal helpers ───────────────────────────────────────────────────

  send(client, type, data) {
    if (client.closed) return;
    try {
      client.ws.send(json(type, data));
    } catch {
      this.close(client);
    }
  }

  queueBroadcast() {
    if (this._broadcastQueued) return;
    this._broadcastQueued = true;
    queueMicrotask(() => {
      this._broadcastQueued = false;
      const payload = { online: this.clientsById.size };
      for (const c of this.clientsBySocket.values()) {
        if (!c.closed) this.send(c, 'global_metrics', payload);
      }
    });
  }

  safeProfile(c) {
    return c.profile ? { id: c.id, ...c.profile } : { id: c.id };
  }

  matchFilters(profile, filters = {}) {
    if (!profile) return false;
    if (filters.gender   && filters.gender   !== 'all' && profile.gender   !== filters.gender)   return false;
    if (filters.country  && filters.country  !== 'all' && profile.country  !== filters.country)   return false;
    if (filters.language && filters.language !== 'all' && !(profile.languages || []).includes(filters.language)) return false;
    return true;
  }

  rateCheck(client) {
    const now = Date.now();
    let entry = this.rateLimits.get(client.id);
    if (!entry || now - entry.windowStart > this.RATE_WINDOW) {
      entry = { count: 0, windowStart: now };
      this.rateLimits.set(client.id, entry);
    }
    entry.count++;
    return entry.count <= this.RATE_MAX;
  }

  close(client) {
    if (client.closed) return;
    client.closed = true;

    this.clientsBySocket.delete(client.ws);
    this.clientsById.delete(client.id);
    this.videoQueue.delete(client.id);
    this.rateLimits.delete(client.id);

    if (client.idleTimer) clearTimeout(client.idleTimer);
    if (client.heartTimer) clearInterval(client.heartTimer);

    try { client.ws.close(1000, 'bye'); } catch {}

    this.queueBroadcast();
  }

  touchIdle(client) {
    if (client.idleTimer) clearTimeout(client.idleTimer);
    client.idleTimer = setTimeout(() => this.close(client), this.CONNECTION_TTL);
  }

  // ── Relay ───────────────────────────────────────────────────────────────

  relayMessage(sender, msg) {
    const target = this.clientsById.get(msg.target);
    if (!target || target.closed) return;

    const data = safeRelay(msg.data);

    if (msg.type === 'signal_relay') {
      this.send(target, 'signal_relay', { peerId: sender.id, signal: msg.data });
      return;
    }

    this.send(target, msg.type, data);
  }

  // ── Video matching ──────────────────────────────────────────────────────

  tryMatch(client) {
    this.videoQueue.delete(client.id);

    for (const pid of this.videoQueue) {
      const partner = this.clientsById.get(pid);
      if (!partner || partner.closed || partner.id === client.id) {
        this.videoQueue.delete(pid);
        continue;
      }

      this.videoQueue.delete(pid);

      this.send(client, 'match_found', {
        peerId: partner.id,
        peer: this.safeProfile(partner),
        initiateCall: true,
      });

      this.send(partner, 'match_found', {
        peerId: client.id,
        peer: this.safeProfile(client),
        initiateCall: false,
      });

      return;
    }

    this.videoQueue.add(client.id);
  }

  // ── Message router ──────────────────────────────────────────────────────

  onMessage(client, raw) {
    this.touchIdle(client);

    let msg;
    try { msg = JSON.parse(raw); } catch {
      this.send(client, 'error', { message: 'invalid json' });
      return;
    }

    if (msg.type === 'ping') { this.send(client, 'pong', { ts: Date.now() }); return; }
    if (msg.type === 'pong') return;

    if (!this.rateCheck(client)) {
      this.send(client, 'error', { message: 'rate limited' });
      return;
    }

    switch (msg.type) {

      case 'join_pool': {
        const profile = msg.data || {};
        const newId   = profile.id || client.id;

        const existing = this.clientsById.get(newId);
        if (existing && existing !== client) {
          existing.closed = true;
          this.clientsBySocket.delete(existing.ws);
          this.clientsById.delete(newId);
          this.videoQueue.delete(newId);
          this.rateLimits.delete(newId);
          if (existing.idleTimer) clearTimeout(existing.idleTimer);
          if (existing.heartTimer) clearInterval(existing.heartTimer);
          try { existing.ws.close(1000, 'replaced'); } catch {}
        }

        if (client.id !== newId) this.clientsById.delete(client.id);

        client.id      = newId;
        client.profile = profile;
        this.clientsById.set(client.id, client);

        this.queueBroadcast();
        break;
      }

      case 'fetch_explore': {
        const filters = msg.data || {};
        const peers = [];
        for (const c of this.clientsById.values()) {
          if (c.id === client.id || c.closed) continue;
          if (!c.profile || (!c.profile.name && !c.profile.nickname)) continue;
          const p = this.safeProfile(c);
          if (this.matchFilters(p, filters)) peers.push(p);
        }
        this.send(client, 'explore_data', peers);
        break;
      }

      case 'join_video_queue':
        this.tryMatch(client);
        break;

      case 'leave_video':
        this.videoQueue.delete(client.id);
        break;

      default:
        if (RELAY_TYPES.has(msg.type)) {
          this.relayMessage(client, msg);
        }
        break;
    }
  }

  // ── WebSocket handler ───────────────────────────────────────────────────

  handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = Object.values(pair);
    serverWs.accept();

    const client = {
      id:        crypto.randomUUID(),
      profile:   null,
      ws:        serverWs,
      closed:    false,
      idleTimer:  null,
      heartTimer: null,
    };

    this.clientsBySocket.set(serverWs, client);
    this.clientsById.set(client.id, client);
    this.touchIdle(client);

    client.heartTimer = setInterval(() => {
      if (client.closed) { clearInterval(client.heartTimer); return; }
      try { client.ws.send(json('ping', { ts: Date.now() })); } catch { this.close(client); }
    }, this.HEARTBEAT_INTERVAL);

    serverWs.addEventListener('message', (e) => this.onMessage(client, e.data));
    serverWs.addEventListener('close',    () => this.close(client));
    serverWs.addEventListener('error',    () => this.close(client));

    this.queueBroadcast();
    return new Response(null, { status: 101, webSocket: clientWs });
  }

  // ─── HTTP handler ──────────────────────────────────────────────────────

  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const upgrade = request.headers.get('upgrade');
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      return this.handleWebSocket(request);
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json(
        { ok: true, online: this.clientsById.size, queued: this.videoQueue.size },
        { headers: CORS }
      );
    }

    return new Response('WhyChat switchboard DO is running.', {
      headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS },
    });
  }
}

// ─── Entry point (proxies to DO) ──────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const doId = env.WEBSOCKET_DO.idFromName("global");
    const stub = env.WEBSOCKET_DO.get(doId);
    return stub.fetch(request);
  },
};
