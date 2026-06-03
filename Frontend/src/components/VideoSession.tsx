import { useEffect, useRef, useState, useCallback } from "react";
import {
  UserPlus, SkipForward, PhoneOff, Check, Video as VideoIcon,
  Sparkles, ArrowLeft, Compass, MessagesSquare, Send
} from "lucide-react";
import { flagFor, type PeerUser, type UserProfile } from "@/lib/peerStore";
import { webrtc } from "@/services/webrtc";
import { discovery } from "@/services/discovery";
import { StorageService, type ChatMessage } from "@/services/storage";
import { signaling } from "@/services/signaling";

type Phase = "idle" | "searching" | "live" | "ended";

interface Props {
  profile: UserProfile;
  onBack: () => void;
  onOpenChat: (peer: PeerUser) => void;
  onGoExplore: () => void;
}

export function VideoSession({ profile, onBack, onOpenChat, onGoExplore }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [peer, setPeer] = useState<Record<string, unknown> | null>(null);
  const [requested, setRequested] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [online, setOnline] = useState(0);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    signaling.connect().catch(() => {});

    const onLocalStream = (e: CustomEvent<{ stream: MediaStream }>) => {
      setLocalStream(e.detail.stream);
    };
    
    const onRemoteStream = (e: CustomEvent<{ stream: MediaStream }>) => {
      setRemoteStream(e.detail.stream);
    };

    const onCleanup = () => {
      setLocalStream(null);
      setRemoteStream(null);
      if (localRef.current) localRef.current.srcObject = null;
      if (remoteRef.current) remoteRef.current.srcObject = null;
    };
    
    const onMatchFound = (e: CustomEvent<{ peerId: string; initiateCall: boolean; peer?: any }>) => {
      const matchedPeer = e.detail.peer ?? {
        id: e.detail.peerId,
        name: 'Stranger',
        nickname: 'Stranger',
        country: 'United States',
        languages: ['English'],
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + e.detail.peerId
      };
      setPeer(matchedPeer);
      setPhase("live");
      setSeconds(0);
      setMessages([]);
    };

    const onMetrics = (e: CustomEvent<{ online: number }>) => {
      setOnline(e.detail.online);
    };

    window.addEventListener('whychat_local_stream', onLocalStream as EventListener);
    window.addEventListener('whychat_remote_stream', onRemoteStream as EventListener);
    window.addEventListener('whychat_video_cleanup', onCleanup);
    signaling.events.addEventListener('match_found', onMatchFound as EventListener);
    signaling.events.addEventListener('global_metrics', onMetrics as EventListener);

    return () => {
      window.removeEventListener('whychat_local_stream', onLocalStream as EventListener);
      window.removeEventListener('whychat_remote_stream', onRemoteStream as EventListener);
      window.removeEventListener('whychat_video_cleanup', onCleanup);
      signaling.events.removeEventListener('match_found', onMatchFound as EventListener);
      signaling.events.removeEventListener('global_metrics', onMetrics as EventListener);
    };
  }, []);

  useEffect(() => {
    if (localRef.current && localStream) {
      if (localRef.current.srcObject !== localStream) localRef.current.srcObject = localStream;
      localRef.current.play().catch(e => console.error("Local play blocked", e));
    }
  }, [localStream, phase]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      if (remoteRef.current.srcObject !== remoteStream) remoteRef.current.srcObject = remoteStream;
      remoteRef.current.play().catch(e => console.error("Remote play blocked", e));
    }
  }, [remoteStream, phase]);

  const matchNext = useCallback(() => {
    setRequested(false);
    setAccepted(false);
    setSeconds(0);
    setPhase("searching");
    webrtc.joinVideoQueue();
  }, []);

  const enterPool = useCallback(() => {
    matchNext();
  }, [matchNext]);

  const endCall = () => {
    webrtc.closeConnections();
    setPhase("ended");
  };

  const skipCall = () => {
    webrtc.skipVideo();
    matchNext();
  };

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    const onFriendAccept = (e: CustomEvent<{ peerId: string }>) => {
      if (!peer || e.detail.peerId !== peer.id) return;
      setAccepted(true);
      setTimeout(() => setAccepted(false), 3000);
    };

    const handleTextRecv = (e: CustomEvent<{ text: string, sender: string }>) => {
      if (!peer || e.detail.sender !== peer.id) return;
      const m: ChatMessage = {
        senderId: peer.id,
        type: 'text',
        content: e.detail.text,
        ts: Date.now()
      };
      setMessages(p => [...p, m]);
      StorageService.addChatMessage(peer.id, m);
    };

    const onPartnerLeft = () => {
      matchNext();
    };

    signaling.events.addEventListener('FRIEND_ACCEPT', onFriendAccept as EventListener);
    window.addEventListener('whychat_text_received', handleTextRecv as EventListener);
    window.addEventListener('whychat_partner_left', onPartnerLeft);
    return () => {
      signaling.events.removeEventListener('FRIEND_ACCEPT', onFriendAccept as EventListener);
      window.removeEventListener('whychat_text_received', handleTextRecv as EventListener);
      window.removeEventListener('whychat_partner_left', onPartnerLeft);
    };
  }, [peer, matchNext]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => webrtc.closeConnections(), []);

  const sendRequest = () => {
    if (!peer) return;
    discovery.sendFriendRequest(peer.id);
    setRequested(true);
  };
  
  const sendChat = () => {
    if (!draft.trim() || !peer) return;
    webrtc.sendText(draft.trim());
    const m: ChatMessage = {
      senderId: 'me',
      type: 'text',
      content: draft.trim(),
      ts: Date.now()
    };
    setMessages(p => [...p, m]);
    StorageService.addChatMessage(peer.id, m);
    setDraft("");
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Idle landing ───────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 md:px-6">
        <div className="glass-card rounded-3xl max-w-xl w-full p-8 md:p-10 text-center animate-in relative">
          <button onClick={onBack} className="absolute top-5 left-5 glass rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-white/[0.12] transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-16 h-16 rounded-3xl gradient-premium mx-auto mb-5 flex items-center justify-center shadow-lg glow-purple">
            <VideoIcon className="w-7 h-7 text-white" />
          </div>
          <div className="meta-label mb-1">Live Pool</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Meet a <span className="text-gradient-premium">stranger</span>.
          </h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Get paired with someone active in the pool right now. Send a friend request if you vibe — chat unlocks instantly.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-xs font-semibold">{online.toLocaleString()} strangers online</span>
          </div>
          <button onClick={enterPool}
            className="gradient-premium text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.99] transition inline-flex items-center gap-2 glow-purple">
            <Sparkles className="w-4 h-4" /> Start Matching
          </button>
        </div>
      </div>
    );
  }

  // ── Ended ──────────────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 md:px-6">
        <div className="glass-card rounded-3xl max-w-md w-full p-8 text-center animate-in">
          <div className="meta-label mb-2">Call Ended</div>
          <h2 className="text-2xl font-bold mb-6">What next?</h2>
          <div className="grid gap-2">
            <button onClick={matchNext}
              className="gradient-premium text-white font-semibold py-3 rounded-2xl hover:scale-[1.01] transition inline-flex items-center justify-center gap-2 glow-purple">
              <SkipForward className="w-4 h-4" /> Match Again
            </button>
            <button onClick={onGoExplore}
              className="bg-white/[0.06] border border-white/[0.1] text-foreground font-semibold py-3 rounded-2xl hover:bg-white/[0.1] hover:scale-[1.01] transition inline-flex items-center justify-center gap-2">
              <Compass className="w-4 h-4" /> Explore
            </button>
            <button onClick={onBack}
              className="text-sm text-muted-foreground py-2 inline-flex items-center justify-center gap-2 hover:text-foreground transition">
              <MessagesSquare className="w-4 h-4" /> Back to Chats
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Live / Searching ───────────────────────────────────────────────────────
  const isSearching = phase === "searching" || !peer;
  return (
    <div className="fixed inset-0 z-40 p-0 md:p-6 bg-black/60 backdrop-blur-md flex items-center justify-center">
      <div className="relative w-full h-full md:h-[calc(100vh-3rem)] md:rounded-[2rem] overflow-hidden bg-neutral-950 shadow-2xl md:max-w-[calc(100vw-3rem)]">
        {/* Remote Video Background */}
        <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover z-0" />
        
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{
          background: "radial-gradient(circle at 30% 30%, rgba(139,92,246,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(236,72,153,0.12) 0%, transparent 50%)",
        }}>
          {isSearching && (
            <div className="text-center bg-black/70 p-8 md:p-10 rounded-3xl backdrop-blur-xl border border-white/[0.06]">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-6 gradient-premium animate-glow-pulse" />
              <div className="text-white text-xl md:text-2xl font-bold tracking-tight">Searching the pool…</div>
              <div className="text-white/50 text-xs mt-2 uppercase tracking-widest">Pairing with a stranger</div>
            </div>
          )}
          
          {!isSearching && (
            <div className="text-center absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ opacity: remoteRef.current?.srcObject ? 0 : 1 }}>
              <div className="gradient-border rounded-3xl mb-6">
                <img src={peer.avatar} alt={peer.nickname}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-white/[0.06]" />
              </div>
              <div className="text-white text-2xl md:text-3xl font-bold tracking-tight drop-shadow-lg">{peer.nickname}</div>
              <div className="text-white/80 text-sm mt-1 uppercase tracking-widest drop-shadow-md font-semibold">
                {flagFor(peer.country)} {peer.country} · {peer.languages.join(" · ")}
              </div>
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-3 md:p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={() => { endCall(); onBack(); }}
            className="glass rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-white/[0.12] transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Exit
          </button>
          <div className="glass rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${isSearching ? "bg-amber-400" : "bg-red-500"} animate-pulse-dot`} />
            {isSearching ? "MATCHING" : `LIVE · ${fmt(seconds)}`}
          </div>
        </div>

        {/* PiP local preview */}
        <div className="absolute top-14 right-3 md:top-16 md:right-4 w-32 h-24 md:w-48 md:h-36 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-2xl bg-black z-20">
          <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-2 text-[10px] uppercase tracking-widest text-white/80 font-semibold drop-shadow-md">You</div>
        </div>

        {/* Accepted toast */}
        {accepted && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-3xl px-8 py-6 text-center animate-in z-30 pointer-events-none">
            <div className="w-14 h-14 rounded-full gradient-premium flex items-center justify-center mx-auto mb-3 glow-purple">
              <Check className="w-7 h-7 text-white" />
            </div>
            <div className="font-bold text-lg">You're now friends</div>
            <div className="text-xs text-muted-foreground mt-1">Chat history is now saved</div>
          </div>
        )}

        {/* Live Chat Overlay */}
        {!isSearching && (
          <div className="absolute bottom-24 left-3 md:left-6 right-3 md:right-auto md:w-96 rounded-2xl md:rounded-3xl flex flex-col z-30 h-64 md:h-72 overflow-hidden pointer-events-auto bg-black/50 border border-white/[0.08] backdrop-blur-xl animate-in shadow-2xl">
            <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-xs text-white/40 py-4 font-semibold uppercase tracking-widest">
                  Live Chat
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === "me";
                return (
                  <div key={m.ts.toString() + m.content.length} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "gradient-premium text-white rounded-br-sm" : "bg-white/[0.12] text-white rounded-bl-sm backdrop-blur-sm"}`}>
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-3 py-3 border-t border-white/[0.08] bg-black/40">
              <div className="bg-white/[0.06] rounded-full px-3 py-1.5 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm outline-none px-2 text-white placeholder:text-white/40"
                  maxLength={200}
                />
                <button onClick={sendChat}
                  className="w-8 h-8 rounded-full gradient-premium text-white flex items-center justify-center hover:scale-105 transition shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Control strip */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-1.5rem)] md:w-auto">
          <div className="glass-strong rounded-full p-2 flex items-center justify-center gap-1.5 md:gap-2">
            <button
              onClick={sendRequest}
              disabled={requested || isSearching}
              className={`px-3 md:px-5 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 transition-all ${
                requested
                  ? "bg-green-500/90 text-white"
                  : isSearching
                  ? "bg-white/[0.06] text-white/40 cursor-not-allowed"
                  : "gradient-premium text-white hover:scale-105"
              }`}
            >
              {requested ? <><Check className="w-4 h-4" /> Sent</> : <><UserPlus className="w-4 h-4" /> Add Friend</>}
            </button>
            <button
              onClick={skipCall}
              disabled={isSearching}
              className={`px-3 md:px-5 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 transition ${
                isSearching ? "bg-white/[0.06] text-white/40 cursor-not-allowed" : "bg-white/90 text-neutral-900 hover:bg-white hover:scale-105"
              }`}
            >
              <SkipForward className="w-4 h-4" /> Skip
            </button>
            <button
              onClick={endCall}
              className="px-3 md:px-5 py-2.5 md:py-3 rounded-full bg-red-500 text-white text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 hover:bg-red-400 hover:scale-105 transition"
            >
              <PhoneOff className="w-4 h-4" /> End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
