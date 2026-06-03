import {
  Sparkles, Compass, Video, MessagesSquare, LogOut, Search,
} from "lucide-react";
import { StorageService } from "@/services/storage";
import { flagFor, type UserProfile } from "@/lib/peerStore";
import type { Session } from "./ExploreDashboard";

interface Props {
  profile: UserProfile;
  session: Session;
  onSessionChange: (s: Session) => void;
  onLogout: () => void;
  online?: number;
}

export function TopNav({ profile, session, onSessionChange, onLogout, online = 0 }: Props) {
  return (
    <header className="sticky top-0 z-30 px-4 md:px-6 py-3 md:py-4">
      <div className="glass-strong rounded-2xl px-4 md:px-5 py-2.5 md:py-3 flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 mr-1 md:mr-2 shrink-0">
          <div className="w-8 h-8 rounded-xl gradient-premium flex items-center justify-center glow-purple">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight hidden sm:inline">WhyChat</span>
        </div>

        <nav className="glass rounded-full p-1 flex items-center gap-0.5">
          {([
            { k: "explore" as const, label: "Explore", icon: Compass },
            { k: "video" as const, label: "Video", icon: Video },
            { k: "chats" as const, label: "Chats", icon: MessagesSquare },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => onSessionChange(t.k)}
              className={`px-2.5 md:px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                session === t.k
                  ? "gradient-premium text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />{" "}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-xs glass rounded-full px-4 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            placeholder="Search peers…"
            className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <div className="glass rounded-full px-2.5 md:px-3 py-1.5 flex items-center gap-1.5 md:gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-xs font-semibold tabular-nums">{online.toLocaleString()}</span>
            <span className="meta-label !text-[10px] hidden md:inline">live</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="gradient-border rounded-full">
              <img src={profile.avatar} alt="" className="w-8 md:w-9 h-8 md:h-9 rounded-full" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold">{profile.nickname}</div>
              <div className="meta-label !text-[10px]">{flagFor(profile.country)} {profile.country}</div>
            </div>
          </div>
          <button
            onClick={() => { StorageService.clearProfile(); onLogout(); }}
            className="glass rounded-full p-2 hover:bg-white/[0.12] transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
