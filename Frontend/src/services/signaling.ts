import { StorageService } from './storage';

type SignalEventMap = {
  'global_metrics': CustomEvent<{ online: number }>;
  'explore_data': CustomEvent<any[]>;
  'match_found': CustomEvent<{ peerId: string; initiateCall: boolean; peer?: any }>;
  'signal_relay': CustomEvent<{ peerId: string; signal: any }>;
  'CHAT_INIT': CustomEvent<{ peerId: string; peerDetails: any }>;
  'FRIEND_REQ': CustomEvent<{ id: string; name: string }>;
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

export class SignalingService {
  private static instance: SignalingService;
  private ws: WebSocket | null = null;
  private url: string = import.meta.env.VITE_SIGNALING_URL ?? '';
  public events = new EventTarget() as SignalingEventTarget;
  private reconnectInterval = 3000;
  private connectPromise: Promise<void> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private demoMode = import.meta.env.DEV && !this.url;

  private constructor() {
    if (typeof window !== 'undefined' && this.url) {
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        try {
          const parsed = new URL(this.url);
          parsed.hostname = window.location.hostname;
          this.url = parsed.toString();
        } catch { /* malformed url, ignore */ }
      }
    }
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
      this.demoMode = false;
    }
    if (this.demoMode || !this.url) {
      if (!this.demoMode) {
        this.demoMode = true;
        console.warn('No signaling URL configured — using demo mode');
      }
      this.events.dispatchEvent(new Event('connected'));
      this.joinPool();
      return Promise.resolve();
    }
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.events.dispatchEvent(new Event('connected'));
          this.joinPool();
          // Client-driven heartbeat — keeps connection alive in Cloudflare Workers
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
          this.events.dispatchEvent(new Event('disconnected'));
          this.ws = null;
          this.connectPromise = null;
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
          // Auto reconnect
          setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (error) => {
          console.error("WebSocket error", error);
          if (this.ws?.readyState !== WebSocket.OPEN) {
             reject(error);
          }
        };
      } catch (e) {
        reject(e);
      }
    });

    return this.connectPromise;
  }

  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data);
      if (message.type === 'pong') {
        // server acknowledged our ping — connection alive
        return;
      } else if (message.type === 'ping') {
        // server-initiated ping (legacy) — respond
        this.send({ type: 'pong' });
      } else {
        // Dispatch specific event based on message type
        // Pass the entire message data to the custom event
        this.events.dispatchEvent(new CustomEvent(message.type, { detail: message.data || message }));
      }
    } catch (e) {
      console.error("Failed to parse websocket message", e);
    }
  }

  public send(payload: any) {
    if (this.demoMode && this.handleDemoPayload(payload)) return;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket is not open. Payload was not sent:", payload);
    }
  }

  private handleDemoPayload(payload: any): boolean {
    if (payload.type === 'join_pool' || payload.type === 'pong') return true;

    if (payload.type === 'fetch_explore') {
      setTimeout(() => {
        const countries = ['United States', 'Japan', 'Brazil', 'Germany', 'India'];
        const mockUsers = Array.from({ length: 12 }).map((_, i) => ({
          id: `mock_user_${i}_${Date.now()}`,
          name: `stranger_${i}`,
          nickname: `stranger_${i}`,
          country: countries[Math.floor(Math.random() * countries.length)],
          languages: ['English'],
          gender: i % 2 === 0 ? 'F' : 'M',
          avatar: `https://api.dicebear.com/7.x/${
            i % 2 === 0 ? 'adventurer' : 'bottts'
          }/svg?seed=stranger_${i}`,
        }));
        this.events.dispatchEvent(new CustomEvent('explore_data', { detail: mockUsers }));
      }, 500);
      return true;
    }

    if (payload.type === 'join_video_queue') {
      setTimeout(() => {
        const mockPeerId = `mock_match_${Date.now()}`;
        this.events.dispatchEvent(
          new CustomEvent('match_found', {
            detail: { peerId: mockPeerId, initiateCall: true },
          }),
        );
      }, 2000);
      return true;
    }

    if (payload.type === 'FRIEND_REQ') {
      setTimeout(() => {
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
      }, 1500);
      return true;
    }

    return false;
  }

  private joinPool() {
    const profile = StorageService.getProfile();
    if (profile) {
      this.send({ type: 'join_pool', data: profile });
    } else {
      // If no profile, they are a guest. A basic UUID can be sent.
      this.send({ type: 'join_pool', data: { id: 'guest-' + Math.random().toString(36).substring(7) } });
    }
  }
}

export const signaling = SignalingService.getInstance();
