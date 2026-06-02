import { useEffect, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { loadFriends, flagFor, type PeerUser } from "@/lib/peerStore";

interface Props {
  onOpenChat: (peer: PeerUser) => void;
}

export function ChatsList({ onOpenChat }: Props) {
  const [friends, setFriends] = useState<PeerUser[]>([]);
  useEffect(() => setFriends(loadFriends()), []);

    <div className="p-6 h-full">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="meta-label">Inbox</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-6">Your chats</h1>

        {friends.length === 0 ? (
          <div className="glass-card rounded-3xl p-10 text-center">
            <div className="text-sm text-muted-foreground">
              No conversations yet. Match someone in Video to start chatting.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((f) => {
              const raw = typeof window !== "undefined" ? localStorage.getItem(`chat_${f.id}`) : null;
              let preview = "Start the conversation";
              try {
                const arr = raw ? JSON.parse(raw) : [];
                const last = arr[arr.length - 1];
                if (last) preview = last.kind === "text" ? last.payload : last.kind === "image" ? "📷 Photo" : "🎤 Voice note";
              } catch { /* ignore */ }
              return (
                <button key={f.id} onClick={() => onOpenChat(f)}
                  className="w-full glass-card rounded-3xl p-4 flex items-center gap-3 hover:scale-[1.01] transition text-left">
                  <div className="relative">
                    <img src={f.avatar} alt="" className="w-12 h-12 rounded-2xl bg-white/60" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{f.nickname}</span>
                      <span className="meta-label !text-[10px]">{flagFor(f.country)} {f.country}</span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">{preview}</div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
