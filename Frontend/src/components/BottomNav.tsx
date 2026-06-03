import { Compass, MessageCircle } from "lucide-react";

export type Tab = "explore" | "chats";

interface Props {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  badge?: number;
}

export function BottomNav({ tab, onTabChange, badge = 0 }: Props) {
  return (
    <nav className="w-full">
      <div className="nav-premium px-4 py-2 flex items-center justify-around md:justify-center md:gap-8">
        {([
          { k: "explore" as const, label: "Explore", icon: Compass },
          { k: "chats" as const, label: "Chats", icon: MessageCircle },
        ]).map((t) => (
          <button
            key={t.k}
            onClick={() => onTabChange(t.k)}
            className={`flex flex-col md:flex-row items-center gap-0.5 md:gap-1.5 px-4 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
              tab === t.k
                ? "text-[#7C3AED]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <t.icon className="w-5 h-5" />
              {t.k === "chats" && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-r from-[#EC4899] to-[#F472B6] text-white text-[8px] font-bold flex items-center justify-center shadow-sm">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </div>
            <span className="hidden md:inline">{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
