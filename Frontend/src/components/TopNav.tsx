import {
  Sparkles, Compass, MessagesSquare, LogOut, Search,
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
    <header className="sticky top-0 z-30">
      <div className="nav-premium px-4 md:px-6 py-2.5 md:py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold tracking-tight hidden sm:inline bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">WhyChat</span>
        </div>

        <nav className="pill-premium flex items-center">
          {([
            { k: "explore" as const, label: "Explore", icon: Compass },
            { k: "chats" as const, label: "Chats", icon: MessagesSquare },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => onSessionChange(t.k)}
              className={`pill-premium-item flex items-center gap-1.5 ${
                session === t.k ? "active" : ""
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search peers…"
              className="input-premium pl-9"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="surface-soft flex items-center gap-1.5 px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold tabular-nums">{online.toLocaleString()}</span>
            <span className="tag-premium !text-[10px] hidden md:inline">live</span>
          </div>
          <div className="flex items-center gap-2">
            <img src={profile.avatar} alt="" className="w-8 md:w-9 h-8 md:h-9 rounded-full ring-2 ring-[#D8D0F5]" />
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-semibold">{profile.nickname}</div>
              <div className="tag-premium !text-[10px]">{flagFor(profile.country)} {profile.country}</div>
            </div>
          </div>
          <button
            onClick={() => { StorageService.clearProfile(); onLogout(); }}
            className="btn-ghost p-2"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
