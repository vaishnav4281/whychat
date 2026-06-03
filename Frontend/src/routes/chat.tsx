import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { ExploreDashboard } from "@/components/ExploreDashboard";
import { ChatsList } from "@/components/ChatsList";
import { PersistentChat } from "@/components/PersistentChat";
import { TopNav } from "@/components/TopNav";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { StorageService } from "@/services/storage";
import { type UserProfile, type PeerUser } from "@/lib/peerStore";
import { signaling } from "@/services/signaling";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — MetWithStrangers" },
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
  const [totalVisits, setTotalVisits] = useState<number | undefined>(() => {
    const saved = StorageService.getTotalVisits();
    return saved > 0 ? saved : undefined;
  });
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
    const handleMetrics = (e: CustomEvent<{ online: number; totalVisits?: number }>) => {
      setOnline(e.detail.online);
      if (e.detail.totalVisits !== undefined) {
        setTotalVisits(e.detail.totalVisits);
        StorageService.setTotalVisits(e.detail.totalVisits);
      }
    };
    signaling.events.addEventListener('global_metrics', handleMetrics as EventListener);
    signaling.connect();
    const onRouteChat = (e: CustomEvent<{ peerId: string; peerDetails?: Partial<PeerUser> }>) => {
      const peerDetails = e.detail.peerDetails;
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

  const [chatRequests, setChatRequests] = useState(0);
  useEffect(() => {
    const update = () => {
      const chats = StorageService.getChats();
      const profile = StorageService.getProfile();
      const myId = profile?.id || '';
      const count = Object.entries(chats).filter(
        ([_, r]) => r.startedBy && r.startedBy !== myId && !r.iHaveReplied
      ).length;
      setChatRequests(count);
    };
    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  const goChat = (peer: PeerUser) => { setOpenChat(peer); setTab("chats"); };

  if (!ready || !profile) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  return (
    <div className="flex flex-col h-screen">
      <TopNav profile={profile} onLogout={() => { StorageService.clearProfile(); navigate({ to: '/' }); }} online={online} totalVisits={totalVisits} />
      <main className="flex-1 flex flex-col overflow-hidden">
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
      </main>
      <BottomNav tab={tab} onTabChange={setTab} badge={chatRequests} />
    </div>
  );
}
