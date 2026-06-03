export interface Profile {
  id: string;
  name: string;
  gender: string;
  country: string;
  languages: string[];
  avatar: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  country: string;
  addedAt: number;
}

export interface FriendRequest {
  id: string;
  name: string;
  avatar: string;
  country: string;
}

export interface Requests {
  incoming: FriendRequest[];
  outgoing: string[];
}

export interface ChatMessage {
  senderId: string;
  type: 'text' | 'image' | 'voice';
  content: string;
  ts: number;
}

const cache = new Map<string, { value: unknown; ts: number }>();
const CACHE_TTL = 2000;

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return entry.value as T;
  }
  cache.delete(key);
  return undefined;
}

function setCached(key: string, value: unknown): void {
  cache.set(key, { value, ts: Date.now() });
  if (cache.size > 50) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

function getItem<T>(key: string, defaultValue: T): T {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw) as T;
      setCached(key, value);
      return value;
    }
  } catch { /* ignore */ }
  return defaultValue;
}

function setItem<T>(key: string, value: T): void {
  setCached(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('whychat_storage_update', { detail: { key, value } }));
  } catch { /* ignore */ }
}

export class StorageService {
  // Profile
  static getProfile(): Profile | null {
    return getItem<Profile | null>('whychat_profile', null)
      || getItem<Profile | null>('peer_profile', null);
  }

  static saveProfile(profile: Profile): void {
    setItem('whychat_profile', profile);
    try { localStorage.removeItem('peer_profile'); } catch { /* ignore */ }
  }

  static clearProfile(): void {
    try {
      localStorage.removeItem('whychat_profile');
      localStorage.removeItem('peer_profile');
      window.dispatchEvent(new CustomEvent('whychat_storage_update', { detail: { key: 'whychat_profile', value: null } }));
    } catch { /* ignore */ }
  }

  // Friends
  static getFriends(): Record<string, Friend> {
    return getItem<Record<string, Friend>>('whychat_friends', {});
  }

  static addFriend(peerId: string, friend: Friend): void {
    const friends = getItem<Record<string, Friend>>('whychat_friends', {});
    friends[peerId] = friend;
    setItem('whychat_friends', friends);
  }

  static removeFriend(peerId: string): void {
    const friends = getItem<Record<string, Friend>>('whychat_friends', {});
    delete friends[peerId];
    setItem('whychat_friends', friends);
  }

  // Requests
  static getRequests(): Requests {
    return getItem<Requests>('whychat_requests', { incoming: [], outgoing: [] });
  }

  static addIncomingRequest(req: FriendRequest): void {
    const requests = getItem<Requests>('whychat_requests', { incoming: [], outgoing: [] });
    if (!requests.incoming.find(r => r.id === req.id)) {
      requests.incoming.push(req);
      setItem('whychat_requests', requests);
    }
  }

  static addOutgoingRequest(targetId: string): void {
    const requests = getItem<Requests>('whychat_requests', { incoming: [], outgoing: [] });
    if (!requests.outgoing.includes(targetId)) {
      requests.outgoing.push(targetId);
      setItem('whychat_requests', requests);
    }
  }

  static removeRequest(id: string): void {
    const requests = getItem<Requests>('whychat_requests', { incoming: [], outgoing: [] });
    requests.incoming = requests.incoming.filter(r => r.id !== id);
    requests.outgoing = requests.outgoing.filter(r => r !== id);
    setItem('whychat_requests', requests);
  }

  // Chats
  static getChats(): Record<string, ChatMessage[]> {
    return getItem<Record<string, ChatMessage[]>>('whychat_chats', {});
  }

  static getChatHistory(peerId: string): ChatMessage[] {
    const chats = getItem<Record<string, ChatMessage[]>>('whychat_chats', {});
    return chats[peerId] || [];
  }

  static addChatMessage(peerId: string, message: ChatMessage): void {
    const chats = getItem<Record<string, ChatMessage[]>>('whychat_chats', {});
    if (!chats[peerId]) chats[peerId] = [];
    chats[peerId].push(message);
    setItem('whychat_chats', chats);
  }
}
