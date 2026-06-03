import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { RegistrationCard } from "@/components/RegistrationCard";
import { ExploreDashboard } from "@/components/ExploreDashboard";
import { ChatsList } from "@/components/ChatsList";
import { PersistentChat } from "@/components/PersistentChat";
import { FriendsTab } from "@/components/FriendsTab";
import { TopNav } from "@/components/TopNav";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { StorageService } from "@/services/storage";
import { signaling } from "@/services/signaling";
import { type PeerUser, type UserProfile } from "@/lib/peerStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WhyChat — Connect Instantly" },
      { name: "description", content: "Premium glass UI for live peer-to-peer video matching and chat." },
      { property: "og:title", content: "WhyChat — Connect Instantly" },
      { property: "og:description", content: "Premium glass UI for live peer-to-peer video matching and chat." },
    ],
  }),
  component: Index,
});

function Index() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("explore");
  const [openChat, setOpenChat] = useState<PeerUser | null>(null);
  const [online, setOnline] = useState(0);

  useEffect(() => {
    setProfile(StorageService.getProfile() as UserProfile | null);
    setReady(true);

    const handleMetrics = (e: CustomEvent<{ online: number }>) => {
      setOnline(e.detail.online);
    };
    signaling.events.addEventListener('global_metrics', handleMetrics as EventListener);

    const onRouteChat = (e: CustomEvent<{ peerId: string; peerDetails?: Partial<PeerUser> }>) => {
      const friends = JSON.parse(localStorage.getItem('whychat_friends') || '{}');
      const friend = friends[e.detail.peerId];
      const peerDetails = e.detail.peerDetails ?? friend;
      if (!peerDetails) return;

      setOpenChat({
        ...peerDetails,
        id: e.detail.peerId,
        name: peerDetails.name ?? peerDetails.nickname ?? 'Stranger',
        nickname: peerDetails.nickname ?? peerDetails.name ?? 'Stranger',
        gender: peerDetails.gender ?? 'M',
        languages: peerDetails.languages ?? [],
        country: peerDetails.country ?? 'Unknown',
        avatar:
          peerDetails.avatar ??
          'https://api.dicebear.com/7.x/bottts/svg?seed=' + e.detail.peerId,
        online: true,
      } as PeerUser);
      setTab("chats");
    };
    window.addEventListener('whychat_route_chat', onRouteChat as EventListener);

    return () => {
      signaling.events.removeEventListener('global_metrics', handleMetrics as EventListener);
      window.removeEventListener('whychat_route_chat', onRouteChat as EventListener);
    };
  }, []);

  const [requests, setRequests] = useState(0);
  useEffect(() => {
    const update = () => setRequests(StorageService.getRequests().incoming.length);
    update();
    window.addEventListener('whychat_storage_update', update);
    return () => window.removeEventListener('whychat_storage_update', update);
  }, []);

  const goChat = (peer: PeerUser) => {
    setOpenChat(peer);
    setTab("chats");
  };

  if (!ready) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  if (!profile) {
    return <><MeshBackdrop /><RegistrationCard onComplete={setProfile} /></>;
  }

  return (
    <>
      <MeshBackdrop />
      <div className="min-h-screen flex flex-col">
        <TopNav
          profile={profile}
          onLogout={() => setProfile(null)}
          online={online}
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className={tab !== "explore" ? "hidden" : "flex-1 overflow-y-auto pb-20 md:pb-8"}>
            <ExploreDashboard onOpenChat={goChat} />
          </div>
          <div className={tab !== "chats" ? "hidden" : "flex-1 overflow-y-auto pb-20 md:pb-8"}>
            {openChat ? (
              <PersistentChat peer={openChat} onBack={() => setOpenChat(null)} />
            ) : (
              <ChatsList onOpenChat={goChat} />
            )}
          </div>
          <div className={tab !== "friends" ? "hidden" : "flex-1 overflow-y-auto pb-20 md:pb-8"}>
            <FriendsTab onOpenChat={goChat} />
          </div>
        </main>
        <BottomNav tab={tab} onTabChange={setTab} badge={requests} />
      </div>
    </>
  );
}
