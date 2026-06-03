import { useState } from "react";
import { Sparkles, X, Globe2, User2, Languages } from "lucide-react";
import {
  COUNTRIES, LANGUAGES, avatarFor, saveProfile,
  type Gender, type UserProfile,
} from "@/lib/peerStore";

interface Props {
  onComplete: (p: UserProfile) => void;
}

export function RegistrationCard({ onComplete }: Props) {
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0].name);
  const [gender, setGender] = useState<Gender>("F");
  const [langs, setLangs] = useState<string[]>(["English"]);

  const toggleLang = (l: string) => {
    setLangs((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || langs.length === 0) return;
    const profile: UserProfile = {
      id: `me_${Date.now()}`,
      name: nickname.trim(),
      nickname: nickname.trim(),
      country,
      languages: langs,
      gender,
      avatar: avatarFor(gender, nickname.trim()),
    };
    saveProfile(profile);
    onComplete(profile);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="glass-card rounded-3xl p-10 w-full max-w-xl animate-fade-up"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="meta-label">Step 01 · Identity</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Forge your <span className="text-gradient-cyber">presence</span>.
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Crafted instantly. Stored on your device only.
        </p>

        {/* Nickname */}
        <label className="block mb-5">
          <span className="meta-label flex items-center gap-1.5 mb-2">
            <User2 className="w-3 h-3" /> Nickname
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="luna"
            className="w-full rounded-2xl bg-white/60 border border-white/60 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 transition"
            required
          />
        </label>

        {/* Country */}
        <label className="block mb-5">
          <span className="meta-label flex items-center gap-1.5 mb-2">
            <Globe2 className="w-3 h-3" /> Country
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-2xl bg-white/60 border border-white/60 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/40 transition"
          >
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.flag}  {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* Gender capsule switch */}
        <div className="mb-5">
          <span className="meta-label block mb-2">Gender</span>
          <div className="glass-strong inline-flex rounded-full p-1">
            {(["F", "M"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                  gender === g
                    ? "gradient-cyber text-white shadow-lg scale-105"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g === "F" ? "Female" : "Male"}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="mb-8">
          <span className="meta-label flex items-center gap-1.5 mb-2">
            <Languages className="w-3 h-3" /> Languages · tap to add
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => {
              const active = langs.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLang(l)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-200 ${
                    active
                      ? "gradient-cyber text-white border-transparent shadow-sm"
                      : "bg-white/40 border-white/60 text-foreground hover:scale-105"
                  }`}
                >
                  {active && <X className="inline w-3 h-3 mr-0.5 -mt-0.5" />}
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="w-full gradient-cyber text-white font-semibold py-4 rounded-2xl shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-transform"
        >
          Enter the Hub →
        </button>
      </form>
    </div>
  );
}
