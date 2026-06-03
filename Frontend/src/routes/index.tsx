import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { RegistrationCard } from "@/components/RegistrationCard";
import { ExploreDashboard, type Session } from "@/components/ExploreDashboard";
import { ChatsList } from "@/components/ChatsList";
import { PersistentChat } from "@/components/PersistentChat";
import { TopNav } from "@/components/TopNav";
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
  const [session, setSession] = useState<Session>("explore");
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
      setSession("chats");
    };
    window.addEventListener('whychat_route_chat', onRouteChat as EventListener);
    return () => {
      signaling.events.removeEventListener('global_metrics', handleMetrics as EventListener);
      window.removeEventListener('whychat_route_chat', onRouteChat as EventListener);
    };
  }, []);

  const goChat = (peer: PeerUser) => {
    setOpenChat(peer);
    setSession("chats");
  };

  if (!ready) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  if (!profile) {
    return <><MeshBackdrop /><RegistrationCard onComplete={setProfile} /></>;
  }

  if (session === "chats" || openChat) {
    return (
      <>
        <MeshBackdrop />
        <div className="min-h-screen flex flex-col">
          <TopNav
            profile={profile}
            session="chats"
            onSessionChange={setSession}
            onLogout={() => setProfile(null)}
            online={online}
          />
          <div className="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden px-3 md:px-6 pb-3 md:pb-8 gap-3 md:gap-6 mt-3 md:mt-4">
            {/* Chats List Sidebar */}
            <div className={`w-full md:w-1/3 md:max-w-md shrink-0 h-[calc(100vh-10rem)] overflow-y-auto card-premium rounded-3xl pb-0 ${openChat ? 'hidden md:block' : 'block'}`}>
              <ChatsList onOpenChat={goChat} />
            </div>
            
            {/* Active Chat Area */}
            <div className={`flex-1 min-w-0 h-[calc(100vh-10rem)] ${openChat ? 'block' : 'hidden md:flex items-center justify-center card-premium rounded-3xl'}`}>
              {openChat ? (
                <PersistentChat peer={openChat} onBack={() => setOpenChat(null)} />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full glass">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <p className="text-sm">Select a chat to start messaging</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <MeshBackdrop />
      <ExploreDashboard
        profile={profile}
        session={session}
        onSessionChange={setSession}
        onLogout={() => setProfile(null)}
        onOpenChat={goChat}
      />
    </>
  );
}
