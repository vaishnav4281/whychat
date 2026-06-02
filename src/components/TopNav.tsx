import {
  Sparkles, Compass, Video, MessagesSquare, LogOut, Search,
} from "lucide-react";
import { clearProfile, flagFor, type UserProfile } from "@/lib/peerStore";
import type { Session } from "./ExploreDashboard";

interface Props {
  profile: UserProfile;
  session: Session;
  onSessionChange: (s: Session) => void;
  onLogout: () => void;
  online?: number;
}

export function TopNav({ profile, session, onSessionChange, onLogout, online = 1247 }: Props) {
  return (
    <header className="sticky top-0 z-30 px-6 py-4">
      <div className="glass-strong rounded-2xl px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-xl gradient-cyber flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight">Pulse</span>
        </div>

        <nav className="glass-card rounded-full p-1 flex items-center gap-1">
          {([
            { k: "explore" as const, label: "Explore", icon: Compass },
            { k: "video" as const, label: "Video", icon: Video },
            { k: "chats" as const, label: "Chats", icon: MessagesSquare },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => onSessionChange(t.k)}
              className={`px-3 md:px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                session === t.k
                  ? "gradient-cyber text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />{" "}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-xs glass-card rounded-full px-4 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search peers…"
            className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="glass-card rounded-full px-3 py-1.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-xs font-semibold tabular-nums">{online.toLocaleString()}</span>
            <span className="meta-label !text-[10px]">live</span>
          </div>
          <div className="flex items-center gap-2">
            <img src={profile.avatar} alt="" className="w-9 h-9 rounded-full ring-2 ring-white/60 bg-white/60" />
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold">{profile.nickname}</div>
              <div className="meta-label !text-[10px]">{flagFor(profile.country)} {profile.country}</div>
            </div>
          </div>
          <button
            onClick={() => { clearProfile(); onLogout(); }}
            className="glass-card rounded-full p-2 hover:scale-105 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
