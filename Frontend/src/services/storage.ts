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

export interface ChatRecord {
  name: string;
  lastMessage: string;
  startedBy?: string;
  iHaveReplied: boolean;
  messages: ChatMessage[];
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
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith('whychat_') || key === 'peer_profile') {
          localStorage.removeItem(key);
        }
      }
      cache.clear();
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
  static getTotalVisits(): number {
    return getItem<number>('whychat_total_visits', 0);
  }

  static setTotalVisits(n: number): void {
    setItem('whychat_total_visits', n);
  }

  static getChats(): Record<string, ChatRecord> {
    const raw = getItem<Record<string, any>>('whychat_chats', {});
    // Migrate old format (Record<string, ChatMessage[]>) to new ChatRecord format
    const firstVal = Object.values(raw)[0];
    if (firstVal && Array.isArray(firstVal)) {
      const migrated: Record<string, ChatRecord> = {};
      for (const [peerId, msgs] of Object.entries(raw)) {
        migrated[peerId] = {
          name: peerId,
          lastMessage: msgs.length > 0 ? msgs[msgs.length - 1].content : '',
          iHaveReplied: true,
          messages: msgs as ChatMessage[],
        };
      }
      setItem('whychat_chats', migrated);
      return migrated;
    }
    return raw as Record<string, ChatRecord>;
  }

  static getChatHistory(peerId: string): ChatMessage[] {
    const chats = StorageService.getChats();
    return chats[peerId]?.messages || [];
  }

  static saveChatPlaceholder(peerId: string, name: string, startedBy?: string): void {
    const chats = StorageService.getChats();
    if (!chats[peerId]) {
      chats[peerId] = {
        name,
        lastMessage: '',
        startedBy,
        iHaveReplied: false,
        messages: [],
      };
      setItem('whychat_chats', chats);
    }
  }

  static addChatMessage(peerId: string, message: ChatMessage): void {
    const chats = StorageService.getChats();
    if (!chats[peerId]) {
      chats[peerId] = {
        name: peerId,
        lastMessage: '',
        iHaveReplied: false,
        messages: [],
      };
    }
    chats[peerId].messages.push(message);
    chats[peerId].lastMessage = message.content;

    const profile = StorageService.getProfile();
    if (message.senderId === profile?.id) {
      chats[peerId].iHaveReplied = true;
    }

    setItem('whychat_chats', chats);
  }
}
