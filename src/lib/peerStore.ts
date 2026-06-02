// Client-side state primitives. No backend; localStorage only.
// WebSocket / WebRTC signal stubs are colocated for clarity.

export type Gender = "M" | "F";

export interface UserProfile {
  id: string;
  nickname: string;
  country: string;
  languages: string[];
  gender: Gender;
  avatar: string;
}

export interface PeerUser extends UserProfile {
  online: boolean;
}

export interface FriendRequest {
  id: string;
  from: PeerUser;
  at: number;
}

export interface ChatMessage {
  id: string;
  from: "me" | "peer";
  kind: "text" | "image" | "voice";
  payload: string; // text | dataURL | objectURL
  at: number;
}

const PROFILE_KEY = "peer_profile";
const FRIENDS_KEY = "local_friends";

export const avatarFor = (gender: Gender, seed: string) =>
  gender === "M"
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

export const loadProfile = (): UserProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
};

export const saveProfile = (p: UserProfile) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
};

export const clearProfile = () => {
  localStorage.removeItem(PROFILE_KEY);
};

export const loadFriends = (): PeerUser[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FRIENDS_KEY);
    return raw ? (JSON.parse(raw) as PeerUser[]) : [];
  } catch {
    return [];
  }
};

export const saveFriends = (friends: PeerUser[]) => {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
};

export const addFriend = (peer: PeerUser): PeerUser[] => {
  const current = loadFriends();
  if (current.some((f) => f.id === peer.id)) return current;
  const next = [...current, peer];
  saveFriends(next);
  return next;
};

// ─────────────────────────────────────────────────────────────────────────
// WebSocket signal dispatch stubs (would point at Cloudflare Workers backend)
// ─────────────────────────────────────────────────────────────────────────
export const WS_BACKEND_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_WS_BACKEND) ||
  "wss://example-worker.workers.dev/socket";

type SignalPayload = Record<string, unknown>;

export const wsStub = {
  join_pool: (profile: UserProfile) => {
    // eslint-disable-next-line no-console
    console.debug("[ws] join_pool →", WS_BACKEND_URL, profile.id);
  },
  fetch_explore: (filters: SignalPayload) => {
    // eslint-disable-next-line no-console
    console.debug("[ws] fetch_explore", filters);
  },
  send_request: (toId: string) => {
    // eslint-disable-next-line no-console
    console.debug("[ws] send_request →", toId);
  },
  accept_request: (reqId: string) => {
    // eslint-disable-next-line no-console
    console.debug("[ws] accept_request →", reqId);
  },
  signal_handshake: (payload: SignalPayload) => {
    // eslint-disable-next-line no-console
    console.debug("[ws] signal_handshake", payload);
  },
};

// ─────────────────────────────────────────────────────────────────────────
// WebRTC wrapper — STUN-only peer with a DataChannel for file blobs.
// ─────────────────────────────────────────────────────────────────────────
export const createPeerConnection = (): RTCPeerConnection => {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  return pc;
};

export const openDataChannel = (pc: RTCPeerConnection, label = "p2p-files") => {
  const dc = pc.createDataChannel(label);
  const CHUNK = 16 * 1024;
  const sendBlob = async (blob: Blob, meta: { name: string; type: string }) => {
    dc.send(JSON.stringify({ kind: "blob-meta", meta, size: blob.size }));
    const buf = await blob.arrayBuffer();
    for (let i = 0; i < buf.byteLength; i += CHUNK) {
      dc.send(buf.slice(i, i + CHUNK));
    }
    dc.send(JSON.stringify({ kind: "blob-end" }));
  };
  return { dc, sendBlob };
};

// ─────────────────────────────────────────────────────────────────────────
// Mock data — peers, languages, countries.
// ─────────────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  "English", "Spanish", "Mandarin", "Arabic", "Portuguese",
  "French", "German", "Japanese", "Korean", "Italian", "Turkish",
  "Russian", "Dutch", "Swedish", "Polish",
  // Indian languages
  "Hindi", "Tamil", "Malayalam", "Kannada", "Telugu", "Bengali",
  "Marathi", "Gujarati", "Punjabi", "Urdu", "Odia", "Assamese",
];

export const COUNTRIES: Array<{ name: string; flag: string }> = [
  { name: "United States", flag: "🇺🇸" }, { name: "United Kingdom", flag: "🇬🇧" },
  { name: "Canada", flag: "🇨🇦" }, { name: "Brazil", flag: "🇧🇷" },
  { name: "Germany", flag: "🇩🇪" }, { name: "France", flag: "🇫🇷" },
  { name: "Japan", flag: "🇯🇵" }, { name: "Korea", flag: "🇰🇷" },
  { name: "India", flag: "🇮🇳" }, { name: "Spain", flag: "🇪🇸" },
  { name: "Mexico", flag: "🇲🇽" }, { name: "Italy", flag: "🇮🇹" },
  { name: "Australia", flag: "🇦🇺" }, { name: "Netherlands", flag: "🇳🇱" },
  { name: "Turkey", flag: "🇹🇷" }, { name: "Sweden", flag: "🇸🇪" },
];

export const flagFor = (country: string) =>
  COUNTRIES.find((c) => c.name === country)?.flag ?? "🌐";

const MOCK_NAMES = [
  "luna", "kairo", "noor", "ezra", "mika", "rio", "sasha", "yuki",
  "amir", "iris", "tao", "zara", "kenji", "elif", "leo", "nia",
  "ash", "vera", "milo", "juno", "remi", "kit", "ronan", "ines",
];

export const generateMockPeers = (n = 18): PeerUser[] => {
  return Array.from({ length: n }).map((_, i) => {
    const name = MOCK_NAMES[i % MOCK_NAMES.length] + (i > MOCK_NAMES.length ? i : "");
    const gender: Gender = i % 2 === 0 ? "F" : "M";
    const country = COUNTRIES[i % COUNTRIES.length].name;
    const langs = [LANGUAGES[i % LANGUAGES.length], LANGUAGES[(i + 3) % LANGUAGES.length]];
    return {
      id: `peer_${i}_${name}`,
      nickname: name,
      country,
      languages: langs,
      gender,
      avatar: avatarFor(gender, name),
      online: true,
    };
  });
};

export const generateMockRequests = (n = 3): FriendRequest[] => {
  const peers = generateMockPeers(n).map((p, i) => ({ ...p, id: `req_peer_${i}` }));
  return peers.map((p, i) => ({ id: `req_${i}`, from: p, at: Date.now() - i * 60000 }));
};
