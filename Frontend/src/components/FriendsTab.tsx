import { useState, useEffect } from "react";
import { Users, MessageCircle } from "lucide-react";
import { flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type Friend } from "@/services/storage";

interface Props {
  onOpenChat: (peer: PeerUser) => void;
}

export function FriendsTab({ onOpenChat }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    const update = () => {
      setFriends(Object.values(StorageService.getFriends()));
    };
    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  const handleOpenChat = (f: Friend) => {
    onOpenChat({ ...f, nickname: f.name, gender: 'M', languages: [], online: true } as PeerUser);
  };

  return (
    <div className="max-w-2xl mx-auto p-5 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Users className="w-5 h-5 text-[#7C3AED]" />
        <h2 className="text-xl font-bold">Friends</h2>
        <span className="tag-premium text-xs ml-auto">{friends.length}</span>
      </div>
      {friends.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-16">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No friends yet. Send a connection request to someone in Explore.
        </div>
      )}
      <div className="space-y-2">
        {friends.map((f) => (
          <button key={f.id} onClick={() => handleOpenChat(f)}
            className="w-full card-premium-hover card-accent-top p-3.5 flex items-center gap-3 hover:opacity-80 transition text-left">
            <div className="relative shrink-0">
              <img src={f.avatar} alt="" className="w-11 h-11 rounded-full bg-secondary" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-card" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{f.name}</div>
              <div className="tag-premium !text-[10px]">{flagFor(f.country)} {f.country}</div>
            </div>
            <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
