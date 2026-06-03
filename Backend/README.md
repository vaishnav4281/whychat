# MetWithStrangers Switchboard

Cloudflare Worker WebSocket relay for MetWithStrangers. It keeps only temporary in-memory state:

- online socket/profile maps
- explore presence
- video matchmaking queue
- WebRTC signaling relay
- friend/chat event relay

Run locally:

```bash
npm install
npm run dev
```

Deploy:

```bash
npm run deploy
```

After deployment, set the frontend environment variable:

```bash
VITE_SIGNALING_URL=wss://your-worker.your-account.workers.dev
```
