import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { ExploreDashboard } from "@/components/ExploreDashboard";
import { ChatsList } from "@/components/ChatsList";
import { PersistentChat } from "@/components/PersistentChat";
import { FriendsTab } from "@/components/FriendsTab";
import { TopNav } from "@/components/TopNav";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { StorageService } from "@/services/storage";
import { type UserProfile, type PeerUser } from "@/lib/peerStore";
import { signaling } from "@/services/signaling";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — WhyChat" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatRoute,
});

function ChatRoute() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<Tab>("explore");
  const [openChat, setOpenChat] = useState<PeerUser | null>(null);
  const [online, setOnline] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = StorageService.getProfile() as UserProfile | null;
    if (!p) {
      navigate({ to: '/' });
      return;
    }
    setProfile(p);
    setReady(true);
  }, [navigate]);

  useEffect(() => {
    if (!profile) return;
    const handleMetrics = (e: CustomEvent<{ online: number }>) => setOnline(e.detail.online);
    signaling.events.addEventListener('global_metrics', handleMetrics as EventListener);
    signaling.connect();
    const onRouteChat = (e: CustomEvent<{ peerId: string; peerDetails?: Partial<PeerUser> }>) => {
      const friends = JSON.parse(localStorage.getItem('whychat_friends') || '{}');
      const friend = friends[e.detail.peerId];
      const peerDetails = e.detail.peerDetails ?? friend;
      if (!peerDetails) return;
      setOpenChat({
        ...peerDetails, id: e.detail.peerId,
        name: peerDetails.name ?? peerDetails.nickname ?? 'Stranger',
        nickname: peerDetails.nickname ?? peerDetails.name ?? 'Stranger',
        gender: peerDetails.gender ?? 'M', languages: peerDetails.languages ?? [],
        country: peerDetails.country ?? 'Unknown',
        avatar: peerDetails.avatar ?? 'https://api.dicebear.com/7.x/bottts/svg?seed=' + e.detail.peerId,
        online: true,
      } as PeerUser);
      setTab("chats");
    };
    window.addEventListener('whychat_route_chat', onRouteChat as EventListener);
    return () => {
      signaling.events.removeEventListener('global_metrics', handleMetrics as EventListener);
      window.removeEventListener('whychat_route_chat', onRouteChat as EventListener);
    };
  }, [profile]);

  const [requests, setRequests] = useState(0);
  useEffect(() => {
    const update = () => setRequests(StorageService.getRequests().incoming.length);
    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  const goChat = (peer: PeerUser) => { setOpenChat(peer); setTab("chats"); };

  if (!ready || !profile) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  return (
    <>
      <TopNav profile={profile} onLogout={() => { StorageService.clearProfile(); navigate({ to: '/' }); }} online={online} />
      <main className="flex-1 flex flex-col overflow-hidden pb-14">
        <div className={tab !== "explore" ? "hidden" : "flex-1 overflow-y-auto"}>
          <ExploreDashboard onOpenChat={goChat} />
        </div>
        <div className={tab !== "chats" ? "hidden" : "flex-1 flex overflow-hidden"}>
          {!openChat ? (
            <div className="flex-1 overflow-y-auto">
              <ChatsList onOpenChat={goChat} />
            </div>
          ) : (
            <>
              <div className="w-80 hidden md:flex flex-col overflow-y-auto border-r border-border">
                <ChatsList onOpenChat={goChat} />
              </div>
              <div className="flex-1 flex flex-col overflow-hidden">
                <PersistentChat peer={openChat} onBack={() => setOpenChat(null)} />
              </div>
            </>
          )}
        </div>
        <div className={tab !== "friends" ? "hidden" : "flex-1 overflow-y-auto"}>
          <FriendsTab onOpenChat={goChat} />
        </div>
      </main>
      <BottomNav tab={tab} onTabChange={setTab} badge={requests} />
    </>
  );
}
