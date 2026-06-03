import { useState, useEffect } from "react";
import { Check, X, Users, UserPlus, MessageCircle } from "lucide-react";
import { flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type FriendRequest, type Friend } from "@/services/storage";
import { discovery } from "@/services/discovery";

interface Props {
  onOpenChat: (peer: PeerUser) => void;
}

type SubTab = "requests" | "friends";

export function FriendsTab({ onOpenChat }: Props) {
  const [sub, setSub] = useState<SubTab>("requests");
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    const update = () => {
      setRequests(StorageService.getRequests().incoming);
      setFriends(Object.values(StorageService.getFriends()));
    };
    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  const acceptRequest = (r: FriendRequest) => {
    discovery.acceptFriendRequest(r.id, r);
  };
  const declineRequest = (r: FriendRequest) => {
    StorageService.removeRequest(r.id);
  };

  const handleOpenChat = (f: Friend) => {
    onOpenChat({ ...f, nickname: f.name, gender: 'M', languages: [], online: true } as PeerUser);
  };

  return (
    <div className="max-w-2xl mx-auto p-5 md:p-6">
      <div className="pill-premium flex mb-5">
        {([
          { k: "requests" as const, label: "Requests", icon: UserPlus, count: requests.length },
          { k: "friends" as const, label: "Friends", icon: Users, count: friends.length },
        ]).map((t) => (
          <button
            key={t.k}
            onClick={() => setSub(t.k)}
            className={`pill-premium-item flex-1 flex items-center justify-center gap-2 ${
              sub === t.k ? "active" : ""
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
            <span className="text-[10px] opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {sub === "requests" ? (
        <div className="space-y-2">
          <div className="tag-premium px-1 mb-2">Incoming · {requests.length}</div>
          {requests.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-12">
              No pending requests.
            </div>
          )}
          {requests.map((r) => (
            <div key={r.id} className="card-premium-hover card-accent-top p-3.5 flex items-center gap-3 animate-in">
              <img src={r.avatar} alt="" className="w-11 h-11 rounded-full bg-secondary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{r.name}</div>
                <div className="tag-premium !text-[10px]">{flagFor(r.country)} {r.country}</div>
              </div>
              <button onClick={() => acceptRequest(r)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white flex items-center justify-center hover:opacity-85 transition shrink-0 shadow-sm">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => declineRequest(r)}
                className="w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center hover:opacity-80 transition shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="tag-premium px-1 mb-2">Friends · {friends.length}</div>
          {friends.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-12">
              No friends yet. Send a friend request to someone in Explore.
            </div>
          )}
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
      )}
    </div>
  );
}
