const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
};

const RELAY_TYPES = new Set([
  'CHAT_INIT', 'FRIEND_REQ', 'FRIEND_ACCEPT', 'signal_relay', 'BOT_MSG'
]);

const SAFE_FIELDS = new Set([
  'id','name','nickname','avatar','country','languages',
  'gender','peerId','peerDetails','signal','isBot'
]);

const BOTS = [
  {
    id: 'bot-sophia', name: 'Sophia', nickname: 'Sophia',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=sophia',
    country: 'US', flag: '🇺🇸', gender: 'female',
    languages: ['English'], isBot: true, behavior: 'reply_first',
  },
  {
    id: 'bot-maya', name: 'Maya', nickname: 'Maya',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=maya',
    country: 'IN', flag: '🇮🇳', gender: 'female',
    languages: ['Hindi', 'English'], isBot: true, behavior: 'dead',
  },
  {
    id: 'bot-emma', name: 'Emma', nickname: 'Emma',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=emma',
    country: 'GB', flag: '🇬🇧', gender: 'female',
    languages: ['English'], isBot: true, behavior: 'accept_friend',
  },
  {
    id: 'bot-yuki', name: 'Yuki', nickname: 'Yuki',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=yuki',
    country: 'JP', flag: '🇯🇵', gender: 'female',
    languages: ['Japanese'], isBot: true, behavior: 'reply_first',
  },
  {
    id: 'bot-priya', name: 'Priya', nickname: 'Priya',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=priya',
    country: 'IN', flag: '🇮🇳', gender: 'female',
    languages: ['Tamil', 'English'], isBot: true, behavior: 'dead',
  },
  {
    id: 'bot-arjun', name: 'Arjun', nickname: 'Arjun',
    avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=arjun',
    country: 'IN', flag: '🇮🇳', gender: 'male',
    languages: ['Hindi', 'English'], isBot: true, behavior: 'accept_friend',
  },
  {
    id: 'bot-lucas', name: 'Lucas', nickname: 'Lucas',
    avatar: 'https://api.dicebear.com/9.x/bottts/svg?seed=lucas',
    country: 'BR', flag: '🇧🇷', gender: 'male',
    languages: ['Portuguese', 'English'], isBot: true, behavior: 'reply_first',
  },
];

const BOT_REPLIES = {
  'bot-sophia': [
    "Hey! Thanks for reaching out. I'm Sophia. What brings you to WhyChat?",
    "That's interesting! Tell me more about yourself.",
    "I love meeting new people. What are your hobbies?",
  ],
  'bot-yuki': [
    "こんにちは！Nice to meet you!",
    "I'm still learning English, please be patient with me!",
    "Do you like Japanese culture?",
  ],
  'bot-lucas': [
    "Olá! How are you doing today?",
    "Brazil is amazing! Have you ever visited?",
    "Nice chatting with you! I'm practicing my English.",
  ],
  'bot-emma': [
    "Hi there! Lovely to connect with you!",
    "Oh, that's so cool! I'm really into music and art.",
    "What part of the world are you from?",
  ],
  'bot-arjun': [
    "Hey! What's up? Good to connect with you.",
    "I'm from India too! Which part are you from?",
    "That's awesome! Tell me more about yourself.",
  ],
};
const FALLBACK_REPLIES = ["That's interesting!", "Tell me more!", "Cool!"];

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

    this.initBots();
  }

  initBots() {
    for (const cfg of BOTS) {
      if (this.clientsById.has(cfg.id)) continue;
      const client = {
        id: cfg.id,
        profile: { ...cfg },
        ws: null,
        closed: false,
        isBot: true,
        behavior: cfg.behavior,
        botData: { replied: false },
        idleTimer: null,
        heartTimer: null,
      };
      client.ws = {
        send: (data) => {
          if (client.closed) return;
          this.handleBotMessage(client, data);
        },
        close: () => { client.closed = true; },
        readyState: 1,
      };
      this.clientsById.set(client.id, client);
    }
  }

  handleBotMessage(bot, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const { type, data } = msg;
    if (!data) return;

    if (type === 'FRIEND_REQ') {
      if (bot.behavior === 'dead') return;
      const sender = this.clientsById.get(data.id);
      if (!sender || sender.closed) return;
      this.send(sender, 'FRIEND_REQ', {
        id: bot.id, name: bot.profile.name,
        avatar: bot.profile.avatar, country: bot.profile.country,
      });
    }

    else if (type === 'CHAT_INIT') {
      if (bot.behavior === 'dead') return;
      const sender = this.clientsById.get(data.peerId);
      if (!sender || sender.closed) return;
      this.send(sender, 'CHAT_INIT', {
        peerId: bot.id,
        peerDetails: { ...bot.profile },
      });
    }

    else if (type === 'signal_relay') {
      if (bot.behavior === 'dead') return;
      const signal = data.signal;
      if (!signal) return;
      const sender = this.clientsById.get(data.peerId);
      if (!sender || sender.closed) return;
      if (signal.type === 'offer') {
        const fakeAnswer = {
          type: 'answer',
          answer: { type: 'answer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=ice-lite\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\na=ice-ufrag:bot\r\na=ice-pwd:bot\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:passive\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n' }
        };
        this.send(sender, 'signal_relay', { peerId: bot.id, signal: fakeAnswer });
      } else if (signal.type === 'ice-candidate') {
        // ignore ICE from real user to bot
      } else if (signal.type === 'answer') {
        // ignore answer (bot never creates offers)
      }
    }

    else if (type === 'BOT_MSG') {
      if (bot.behavior === 'dead' || bot.behavior === 'accept_friend') return;
      const sender = this.clientsById.get(data.from);
      if (!sender || sender.closed) return;
      if (bot.behavior === 'reply_first' && bot.botData.replied) return;
      bot.botData.replied = true;
      const reply = this.generateBotReply(bot, data.text || '');
      this.send(sender, 'BOT_MSG', {
        from: bot.id, text: reply, ts: Date.now(),
      });
    }
  }

  generateBotReply(bot, userMessage) {
    const replies = BOT_REPLIES[bot.id] || FALLBACK_REPLIES;
    return replies[Math.floor(Math.random() * replies.length)];
  }

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
      let online = 0;
      for (const c of this.clientsBySocket.values()) {
        if (!c.closed) online++;
      }
      const payload = { online };
      for (const c of this.clientsBySocket.values()) {
        if (!c.closed) this.send(c, 'global_metrics', payload);
      }
    });
  }

  safeProfile(c) {
    const p = c.profile ? { id: c.id, ...c.profile } : { id: c.id };
    if (c.isBot) p.isBot = true;
    return p;
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
    if (client.closed || client.isBot) return;
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
        { ok: true, online: this.clientsBySocket.size, queued: this.videoQueue.size },
        { headers: CORS }
      );
    }

    if (url.pathname === '/bot-health') {
      const bots = [];
      for (const c of this.clientsById.values()) {
        if (c.isBot) {
          bots.push({ id: c.id, name: c.profile.name, behavior: c.behavior, replied: c.botData.replied });
        }
      }
      return Response.json({ bots, total: bots.length }, { headers: CORS });
    }

    return new Response('WhyChat switchboard DO is running.', {
      headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS },
    });
  }
}

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
