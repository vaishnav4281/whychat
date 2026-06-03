import { useEffect, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type Friend } from "@/services/storage";

interface Props {
  onOpenChat: (peer: PeerUser) => void;
}

export function ChatsList({ onOpenChat }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const update = () => {
      const friendList = Object.values(StorageService.getFriends());
      setFriends(friendList);
      const chats = StorageService.getChats();
      const p: Record<string, string> = {};
      for (const f of friendList) {
        const history = chats[f.id];
        if (history?.length) {
          const last = history[history.length - 1];
          p[f.id] = last.type === "text" ? last.content : last.type === "image" ? "📷 Photo" : "🎤 Voice note";
        } else {
          p[f.id] = "Start the conversation";
        }
      }
      setPreviews(p);
    };

    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  return (
    <div className="p-5 md:p-6 h-full">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="badge-gradient">Inbox</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-5 md:mb-6">
          Your chats
        </h1>

        {friends.length === 0 ? (
          <div className="card-premium card-accent-blue p-8 md:p-10 text-center">
            <div className="text-sm text-muted-foreground">
              No conversations yet. Match someone in Video to start chatting.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => {
              const preview = previews[f.id] ?? "Start the conversation";

              return (
                <button key={f.id} onClick={() => onOpenChat({ ...f, nickname: f.name, gender: 'M', languages: [], online: true } as PeerUser)}
                  className="w-full card-premium-hover card-accent-top p-3.5 md:p-4 flex items-center gap-3 text-left">
                  <div className="relative shrink-0">
                    <img src={f.avatar} alt="" className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-secondary ring-2 ring-[#D8D0F5]" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm md:text-base">{f.name}</span>
                      <span className="tag-premium !text-[10px]">{flagFor(f.country)} {f.country}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{preview}</div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
