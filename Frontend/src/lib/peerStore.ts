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
  isBot?: boolean;
}

export const avatarFor = (gender: Gender, seed: string) =>
  gender === "M"
    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`
    : `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

export const flagFor = (country: string) =>
  COUNTRIES.find((c) => c.name === country)?.flag ?? "🌐";

export const LANGUAGES = [
  "English", "Spanish", "Mandarin", "Arabic", "Portuguese",
  "French", "German", "Japanese", "Korean", "Italian", "Turkish",
  "Russian", "Dutch", "Swedish", "Polish",
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
