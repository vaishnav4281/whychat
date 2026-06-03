import { StorageService } from './storage';

type SignalEventMap = {
  'global_metrics': CustomEvent<{ online: number }>;
  'explore_data': CustomEvent<any[]>;
  'match_found': CustomEvent<{ peerId: string; initiateCall: boolean; peer?: any }>;
  'signal_relay': CustomEvent<{ peerId: string; signal: any }>;
  'CHAT_INIT': CustomEvent<{ peerId: string; peerDetails: any }>;
  'FRIEND_REQ': CustomEvent<{ id: string; name: string; avatar: string; country: string }>;
  'FRIEND_ACCEPT': CustomEvent<{ peerId: string; peerDetails: any }>;
  'pool_update': Event;
  'connected': Event;
  'disconnected': Event;
};

export interface SignalingEventTarget extends EventTarget {
  addEventListener<K extends keyof SignalEventMap>(type: K, listener: (this: SignalingEventTarget, ev: SignalEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof SignalEventMap>(type: K, listener: (this: SignalingEventTarget, ev: SignalEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

const MOCK_COUNTRIES = ['United States', 'Japan', 'Brazil', 'Germany', 'India', 'France', 'Korea', 'United Kingdom'];
const MOCK_LANGS = ['English', 'Spanish', 'Japanese', 'Portuguese', 'German', 'French', 'Korean'];
const MOCK_NAMES = [
  'alex', 'maya', 'jordan', 'sam', 'riley', 'taylor', 'casey', 'jessie',
  'quinn', 'avery', 'blake', 'drew', 'ellis', 'finley', 'harper', 'indigo',
];

export class SignalingService {
  private static instance: SignalingService;
  private ws: WebSocket | null = null;
  private url: string = import.meta.env.VITE_SIGNALING_URL ?? '';
  public events = new EventTarget() as SignalingEventTarget;
  private reconnectInterval = 5000;
  private connectPromise: Promise<void> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private demoMode = false;
  private connected = false;
  private mockInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  /** Returns true when the service can handle requests (connected or in demo mode). */
  public isReady(): boolean {
    return this.demoMode || this.ws?.readyState === WebSocket.OPEN;
  }

  public static getInstance(): SignalingService {
    if (!SignalingService.instance) {
      SignalingService.instance = new SignalingService();
    }
    return SignalingService.instance;
  }

  public connect(url?: string): Promise<void> {
    if (url) {
      this.url = url;
    }

    // If no URL configured, go straight to demo mode
    if (!this.url) {
      return this.enterDemoMode();
    }

    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        const connectionTimeout = setTimeout(() => {
          // Connection took too long — fall back to demo mode
          if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            if (this.ws.readyState !== WebSocket.OPEN) {
              this.ws.close();
            }
          }
          this.ws = null;
          this.connectPromise = null;
          resolve(this.enterDemoMode());
        }, 8000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.events.dispatchEvent(new Event('connected'));
          this.joinPool();
          this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          const wasConnected = this.connected;
          this.connected = false;
          this.events.dispatchEvent(new Event('disconnected'));
          this.ws = null;
          this.connectPromise = null;
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
          // Fall back to demo mode so the app stays usable
          if (wasConnected) {
            this.enterDemoMode();
          }
        };

        this.ws.onerror = () => {
          // Error alone doesn't mean we're disconnected — onclose will fire next
        };
      } catch {
        // WebSocket constructor threw — go to demo mode
        this.connectPromise = null;
        resolve(this.enterDemoMode());
      }
    });

    return this.connectPromise;
  }

  private async enterDemoMode(): Promise<void> {
    if (this.demoMode) return;
    this.demoMode = true;
    console.log('WhyChat: running in demo mode (no signaling server)');

    // Yield so callers can register their event listeners first
    await new Promise(r => setTimeout(r, 0));

    this.events.dispatchEvent(new Event('connected'));
    this.joinPool();

    // Dispatch explore + metrics every 7 seconds
    const dispatchAll = () => {
      this.dispatchMockExplore();
      this.dispatchMockMetrics();
    };
    this.mockInterval = setInterval(dispatchAll, 7000);

    // Immediate mock data
    dispatchAll();
  }

  private dispatchMockMetrics() {
    this.events.dispatchEvent(new CustomEvent('global_metrics', {
      detail: { online: 142 + Math.floor(Math.random() * 60) }
    }));
  }

  private mockPeer(index: number) {
    const name = MOCK_NAMES[index % MOCK_NAMES.length] + (index > 15 ? `_${index}` : '');
    const country = MOCK_COUNTRIES[index % MOCK_COUNTRIES.length];
    const langs = [MOCK_LANGS[index % MOCK_LANGS.length], 'English'];
    const gender = index % 2 === 0 ? 'F' : 'M';
    const seed = encodeURIComponent(name);
    return {
      id: `demo_${index}`,
      name,
      nickname: name,
      country,
      languages: langs,
      gender,
      avatar: `https://api.dicebear.com/7.x/${gender === 'F' ? 'adventurer' : 'bottts'}/svg?seed=${seed}`,
    };
  }

  private dispatchMockExplore() {
    const profile = StorageService.getProfile();
    const count = 8 + Math.floor(Math.random() * 12);
    const peers = Array.from({ length: count }, (_, i) => this.mockPeer(Date.now() % 1000 + i));
    // Remove self if in list
    const filtered = profile ? peers.filter(p => p.id !== profile.id) : peers;
    this.events.dispatchEvent(new CustomEvent('explore_data', { detail: filtered }));
  }

  private static ALLOWED_EVENTS = new Set([
    'global_metrics', 'explore_data', 'match_found', 'signal_relay',
    'pool_update', 'FRIEND_REQ', 'FRIEND_ACCEPT', 'CHAT_INIT', 'error',
  ]);

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      if (message.type === 'pong') return;
      if (message.type === 'ping') { this.send({ type: 'pong' }); return; }
      if (!SignalingService.ALLOWED_EVENTS.has(message.type)) {
        console.warn('Ignoring unknown event type:', message.type);
        return;
      }
      this.events.dispatchEvent(new CustomEvent(message.type, { detail: message.data || message }));
    } catch (e) {
      console.error("Failed to parse websocket message", e);
    }
  }

  public send(payload: any) {
    // In demo mode, handle locally
    if (this.demoMode) {
      this.handleDemoPayload(payload);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket is not open. Payload not sent:", payload.type);
    }
  }

  private async handleDemoPayload(payload: any) {
    if (payload.type === 'pong') return;

    if (payload.type === 'fetch_explore') {
      this.dispatchMockExplore();
      return;
    }

    if (payload.type === 'join_video_queue') {
      await delay(1500 + Math.random() * 2000);
      const mockPeer = this.mockPeer(Math.floor(Math.random() * 1000));
      this.events.dispatchEvent(
        new CustomEvent('match_found', {
          detail: {
            peerId: mockPeer.id,
            peer: mockPeer,
            initiateCall: true
          },
        }),
      );
      return;
    }

    if (payload.type === 'FRIEND_REQ') {
      // Simulate auto-accept after a short delay
      await delay(1200 + Math.random() * 800);
      this.events.dispatchEvent(
        new CustomEvent('FRIEND_ACCEPT', {
          detail: {
            peerId: payload.target,
            peerDetails: {
              name: 'Stranger',
              nickname: 'Stranger',
              avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Stranger',
              country: 'United States',
            },
          },
        }),
      );
      return;
    }

    if (payload.type === 'signal_relay') {
      // In demo mode, WebRTC won't work for video — that's expected
      console.log('Demo mode: signal_relay ignored (WebRTC needs a real server)');
      return;
    }

    if (payload.type === 'CHAT_INIT') {
      // No-op in demo mode; the frontend handles local chat routing
      return;
    }
  }

  private joinPool() {
    const profile = StorageService.getProfile();
    if (profile) {
      this.send({ type: 'join_pool', data: profile });
    } else {
      this.send({ type: 'join_pool', data: { id: 'guest-' + Math.random().toString(36).substring(7) } });
    }
  }
}

export const signaling = SignalingService.getInstance();
