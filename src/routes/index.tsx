import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { RegistrationCard } from "@/components/RegistrationCard";
import { ExploreDashboard, type Session } from "@/components/ExploreDashboard";
import { VideoSession } from "@/components/VideoSession";
import { ChatsList } from "@/components/ChatsList";
import { PersistentChat } from "@/components/PersistentChat";
import { TopNav } from "@/components/TopNav";
import { loadProfile, type PeerUser, type UserProfile } from "@/lib/peerStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WhyChat" },
      { name: "description", content: "Premium glass UI for live peer-to-peer video matching and chat." },
      { property: "og:title", content: "WhyChat" },
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

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  const goChat = (peer: PeerUser) => {
    setOpenChat(peer);
    setSession("chats");
  };

  if (!ready) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  if (!profile) {
    return <><MeshBackdrop /><RegistrationCard onComplete={setProfile} /></>;
  }

  // (Removed standalone openChat override to integrate it into "chats" session)

  if (session === "video") {
    return (
      <>
        <MeshBackdrop />
        <VideoSession
          profile={profile}
          onBack={() => setSession("explore")}
          onGoExplore={() => setSession("explore")}
          onOpenChat={goChat}
        />
      </>
    );
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
          />
          <div className="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden px-4 md:px-8 pb-8 gap-4 md:gap-8 mt-4">
            {/* Chats List Sidebar */}
            <div className={`w-full md:w-1/3 md:max-w-md shrink-0 h-[80vh] overflow-y-auto glass-card rounded-3xl pb-0 ${openChat ? 'hidden md:block' : 'block'}`}>
              <ChatsList onOpenChat={goChat} />
            </div>
            
            {/* Active Chat Area */}
            <div className={`flex-1 min-w-0 h-[80vh] ${openChat ? 'block' : 'hidden md:flex items-center justify-center glass-card rounded-3xl'}`}>
              {openChat ? (
                <PersistentChat peer={openChat} onBack={() => setOpenChat(null)} />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                  <div className="p-4 rounded-full glass-strong">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <p>Select a chat to start messaging</p>
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
