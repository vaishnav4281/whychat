import { useState } from "react";
import { Sparkles, Globe2, User2, Languages } from "lucide-react";
import { StorageService } from "@/services/storage";
import {
  COUNTRIES, LANGUAGES, avatarFor,
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
    StorageService.saveProfile(profile);
    onComplete(profile);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="card-premium card-accent-top p-8 md:p-10 w-full max-w-xl animate-in"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="badge-gradient">Step 01</span>
            <div className="text-sm text-muted-foreground mt-0.5">Set up your identity</div>
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-balance">
          Forge your presence.
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Crafted instantly. Stored on your device only.
        </p>

        <label className="block mb-5">
          <span className="tag-premium flex items-center gap-1.5 mb-2">
            <User2 className="w-3 h-3" /> Nickname
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="luna"
            className="input-premium"
            required
          />
        </label>

        <label className="block mb-5">
          <span className="tag-premium flex items-center gap-1.5 mb-2">
            <Globe2 className="w-3 h-3" /> Country
          </span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="select-premium"
          >
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.flag}  {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-5">
          <span className="tag-premium block mb-2">Gender</span>
          <div className="pill-premium inline-flex">
            {(["F", "M"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`pill-premium-item ${gender === g ? "active" : ""}`}
              >
                {g === "F" ? "Female" : "Male"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <span className="tag-premium flex items-center gap-1.5 mb-2">
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
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white border-transparent shadow-sm"
                      : "bg-secondary text-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  {active ? "✓ " : ""}{l}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="btn-gradient w-full py-3.5 text-center text-sm"
        >
          Enter the Hub →
        </button>
      </form>
    </div>
  );
}
