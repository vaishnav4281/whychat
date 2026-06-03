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

export class SignalingService {
  private static instance: SignalingService;
  private ws: WebSocket | null = null;
  private url: string = import.meta.env.VITE_SIGNALING_URL ?? '';
  public events = new EventTarget() as SignalingEventTarget;
  private reconnectInterval = 5000;
  private connectPromise: Promise<void> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  private constructor() {}

  public isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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

    if (!this.url) {
      return Promise.resolve();
    }

    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        const connectionTimeout = setTimeout(() => {
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
          resolve();
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
          this.connected = false;
          this.events.dispatchEvent(new Event('disconnected'));
          this.ws = null;
          this.connectPromise = null;
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
        };

        this.ws.onerror = () => {};
      } catch {
        this.connectPromise = null;
        resolve();
      }
    });

    return this.connectPromise;
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
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      console.warn("WebSocket is not open. Payload not sent:", payload.type);
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
