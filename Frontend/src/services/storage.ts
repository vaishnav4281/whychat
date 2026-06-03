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
  content: string; // text-data or local-blob-url
  ts: number;
}

export class StorageService {
  private static get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
    }
    return defaultValue;
  }

  private static set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Dispatch custom event for cross-tab or global state reactivity
      window.dispatchEvent(new CustomEvent('whychat_storage_update', { detail: { key, value } }));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage`, e);
    }
  }

  // Profile
  static getProfile(): Profile | null {
    return this.get<Profile | null>('whychat_profile', null);
  }

  static saveProfile(profile: Profile): void {
    this.set('whychat_profile', profile);
  }

  // Friends
  static getFriends(): Record<string, Friend> {
    return this.get<Record<string, Friend>>('whychat_friends', {});
  }

  static addFriend(peerId: string, friend: Friend): void {
    const friends = this.getFriends();
    friends[peerId] = friend;
    this.set('whychat_friends', friends);
  }

  static removeFriend(peerId: string): void {
    const friends = this.getFriends();
    delete friends[peerId];
    this.set('whychat_friends', friends);
  }

  // Requests
  static getRequests(): Requests {
    return this.get<Requests>('whychat_requests', { incoming: [], outgoing: [] });
  }

  static addIncomingRequest(req: FriendRequest): void {
    const requests = this.getRequests();
    if (!requests.incoming.find(r => r.id === req.id)) {
      requests.incoming.push(req);
      this.set('whychat_requests', requests);
    }
  }

  static addOutgoingRequest(targetId: string): void {
    const requests = this.getRequests();
    if (!requests.outgoing.includes(targetId)) {
      requests.outgoing.push(targetId);
      this.set('whychat_requests', requests);
    }
  }

  static removeRequest(id: string): void {
    const requests = this.getRequests();
    requests.incoming = requests.incoming.filter(r => r.id !== id);
    requests.outgoing = requests.outgoing.filter(r => r !== id);
    this.set('whychat_requests', requests);
  }

  // Chats
  static getChats(): Record<string, ChatMessage[]> {
    return this.get<Record<string, ChatMessage[]>>('whychat_chats', {});
  }

  static getChatHistory(peerId: string): ChatMessage[] {
    const chats = this.getChats();
    return chats[peerId] || [];
  }

  static addChatMessage(peerId: string, message: ChatMessage): void {
    const chats = this.getChats();
    if (!chats[peerId]) {
      chats[peerId] = [];
    }
    chats[peerId].push(message);
    this.set('whychat_chats', chats);
  }
}
