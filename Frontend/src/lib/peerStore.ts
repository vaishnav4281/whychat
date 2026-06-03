// Client-side state primitives. No backend; localStorage only.

export type Gender = "M" | "F";

export interface UserProfile {
  id: string;
  name: string;
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

const PROFILE_KEY = "whychat_profile";
const LEGACY_PROFILE_KEY = "peer_profile";

const normalizeProfile = (profile: Partial<UserProfile>): UserProfile | null => {
  const displayName = profile.name ?? profile.nickname;
  if (
    !profile.id ||
    !displayName ||
    !profile.country ||
    !profile.languages ||
    !profile.gender ||
    !profile.avatar
  ) {
    return null;
  }

  return {
    id: profile.id,
    name: displayName,
    nickname: profile.nickname ?? displayName,
    country: profile.country,
    languages: profile.languages,
    gender: profile.gender,
    avatar: profile.avatar,
  };
};

export const avatarFor = (gender: Gender, seed: string) =>
  gender === "M"
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

export const loadProfile = (): UserProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(PROFILE_KEY) ?? localStorage.getItem(LEGACY_PROFILE_KEY);
    const profile = raw ? normalizeProfile(JSON.parse(raw) as Partial<UserProfile>) : null;
    if (profile) saveProfile(profile);
    return profile;
  } catch {
    return null;
  }
};

export const saveProfile = (p: UserProfile) => {
  const profile = normalizeProfile(p);
  if (!profile) return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.removeItem(LEGACY_PROFILE_KEY);
};

export const clearProfile = () => {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(LEGACY_PROFILE_KEY);
};

// ─────────────────────────────────────────────────────────────────────────
// Mock data — languages, countries.
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
