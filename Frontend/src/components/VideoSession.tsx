import { useEffect, useRef, useState, useCallback } from "react";
import {
  UserPlus, SkipForward, PhoneOff, Check, Video as VideoIcon,
  Sparkles, ArrowLeft, Compass, MessagesSquare, Send, MessageCircle
} from "lucide-react";
import { flagFor, type PeerUser, type UserProfile } from "@/lib/peerStore";
import { webrtc } from "@/services/webrtc";
import { discovery } from "@/services/discovery";
import { StorageService, type ChatMessage } from "@/services/storage";
import { signaling } from "@/services/signaling";

type Phase = "idle" | "requesting" | "searching" | "live" | "ended";

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
  const [camError, setCamError] = useState("");

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const [showChat, setShowChat] = useState(true);

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
      setPeer(e.detail.peer ?? {
        id: e.detail.peerId,
        name: 'Stranger',
        nickname: 'Stranger',
        country: 'United States',
        languages: ['English'],
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + e.detail.peerId
      });
      setPhase("live");
      setSeconds(0);
      setMessages([]);
      setAccepted(false);
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
      localRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      if (remoteRef.current.srcObject !== remoteStream) remoteRef.current.srcObject = remoteStream;
      remoteRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const acquireCamera = useCallback(async (): Promise<boolean> => {
    if (webrtc.hasLocalStream()) return true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Camera not supported (require HTTPS)");
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      webrtc.setLocalStream(stream);
      return true;
    } catch (e: any) {
      setCamError(
        e.name === 'NotAllowedError' ? "Camera permission denied. Allow access and try again." :
        e.name === 'NotFoundError' ? "No camera found." :
        e.name === 'NotReadableError' ? "Camera in use by another app." :
        "Camera access failed."
      );
      return false;
    }
  }, []);

  const startMatching = useCallback(async () => {
    setCamError("");
    setPhase("requesting");
    const ok = await acquireCamera();
    if (!ok) {
      setPhase("idle");
      return;
    }
    setRequested(false);
    setAccepted(false);
    setSeconds(0);
    setPhase("searching");
    webrtc.joinVideoQueue();
  }, [acquireCamera]);

  const matchNext = useCallback(async () => {
    webrtc.closeConnections();
    setCamError("");
    setRequested(false);
    setAccepted(false);
    setSeconds(0);
    setMessages([]);
    setPhase("searching");
    if (!webrtc.hasLocalStream()) {
      const ok = await acquireCamera();
      if (!ok) { setPhase("idle"); return; }
    }
    webrtc.joinVideoQueue();
  }, [acquireCamera]);

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
    discovery.sendFriendRequest(String(peer.id));
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

  /// ── Idle screen ──────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card-premium card-accent-top p-8 md:p-10 max-w-xl w-full text-center animate-in relative">
          <button onClick={onBack} className="btn-ghost absolute top-5 left-5 flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] mx-auto mb-5 flex items-center justify-center shadow-md">
            <VideoIcon className="w-7 h-7 text-white" />
          </div>
          <div className="badge-gradient mb-3 inline-block">Live Pool</div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-balance">Meet a stranger.</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Get paired with someone active in the pool right now.
          </p>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold">{online.toLocaleString()} strangers online</span>
          </div>
          {camError && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-2 mb-4">{camError}</div>
          )}
          <button onClick={startMatching}
            className="btn-gradient inline-flex items-center gap-2 px-8 py-3.5">
            <Sparkles className="w-4 h-4" /> Start Matching
          </button>
        </div>
      </div>
    );
  }

  /// ── Ended screen ─────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="card-premium card-accent-pink p-8 max-w-md w-full text-center animate-in">
          <div className="badge-pink mb-2 inline-block">Call Ended</div>
          <h2 className="text-2xl font-bold mb-6">What next?</h2>
          <div className="grid gap-2">
            <button onClick={() => matchNext()}
              className="btn-gradient inline-flex items-center justify-center gap-2 py-3">
              <SkipForward className="w-4 h-4" /> Match Again
            </button>
            <button onClick={onGoExplore}
              className="btn-secondary inline-flex items-center justify-center gap-2 py-3">
              <Compass className="w-4 h-4" /> Explore
            </button>
            <button onClick={onBack}
              className="btn-ghost inline-flex items-center justify-center gap-2">
              <MessagesSquare className="w-4 h-4" /> Back to Chats
            </button>
          </div>
        </div>
      </div>
    );
  }

  /// ── Live / Searching ─────────────────────────────────────────────────────
  const isSearching = phase === "requesting" || phase === "searching" || !peer;

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 z-20 bg-neutral-900 shrink-0">
        <button onClick={() => { endCall(); onBack(); }}
          className="bg-white/20 rounded-full px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1.5 hover:bg-white/30 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Exit
        </button>

        <div className="bg-white/20 rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-white">
          <span className={`w-2 h-2 rounded-full ${isSearching ? "bg-amber-400" : "bg-red-500"}`} />
          {isSearching ? "MATCHING" : `LIVE · ${fmt(seconds)}`}
        </div>

        {!isSearching && (
          <button onClick={() => setShowChat(p => !p)}
            className="bg-white/20 rounded-full px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1.5 hover:bg-white/30 transition md:hidden">
            <MessageCircle className="w-3.5 h-3.5" />
            {showChat ? "Hide Chat" : "Chat"}
          </button>
        )}
        {!isSearching && <div className="hidden md:block w-20" />}
      </div>

      {/* Main content: flex row on desktop, column on mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Video area */}
        <div className={`flex-1 relative bg-neutral-900 ${!isSearching && showChat ? 'hidden md:flex' : 'flex'} flex-col`}>
          {/* Remote video */}
          <video ref={remoteRef} autoPlay playsInline
            className="absolute inset-0 w-full h-full object-cover" />

          {/* Searching overlay */}
          {isSearching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="text-center bg-black/70 p-8 md:p-10 rounded-2xl backdrop-blur-sm">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full mx-auto mb-6 bg-gradient-to-br from-[#7C3AED] to-[#EC4899] shadow-lg animate-pulse" />
                <div className="text-white text-xl md:text-2xl font-bold tracking-tight">
                  {phase === "requesting" ? "Accessing camera…" : "Searching the pool…"}
                </div>
                <div className="text-white/50 text-xs mt-2 uppercase tracking-widest">
                  {phase === "requesting" ? "Grant permission when prompted" : "Pairing with a stranger"}
                </div>
              </div>
            </div>
          )}

          {/* Peer info overlay (shown until remote video arrives) */}
          {!isSearching && (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-500"
              style={{ opacity: remoteStream ? 0 : 1 }}
            >
              <img src={String(peer?.avatar ?? "")} alt={String(peer?.nickname ?? "")}
                className="w-28 h-28 md:w-36 md:h-36 rounded-2xl mb-5 ring-2 ring-white/20 bg-white/10" />
              <div className="text-white text-2xl md:text-3xl font-bold tracking-tight drop-shadow-lg">
                {String(peer?.nickname ?? "")}
              </div>
              <div className="text-white/80 text-sm mt-1 uppercase tracking-widest drop-shadow-md font-semibold">
                {flagFor(String(peer?.country ?? ""))} {String(peer?.country ?? "")}
              </div>
            </div>
          )}

          {/* PIP local video */}
          {!isSearching && localStream && (
            <div className="absolute top-3 right-3 w-28 h-20 md:w-44 md:h-32 rounded-xl overflow-hidden ring-2 ring-white/30 shadow-2xl bg-black z-20">
              <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-1 left-2 text-[10px] uppercase tracking-widest text-white/80 font-semibold drop-shadow-md">You</div>
            </div>
          )}

          {/* Friend accepted notification */}
          {accepted && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-md rounded-2xl px-8 py-6 text-center z-30 pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#10B981] to-[#6EE7B7] flex items-center justify-center mx-auto mb-3 shadow-md">
                <Check className="w-7 h-7 text-white" />
              </div>
              <div className="font-bold text-lg text-foreground">You're now friends</div>
              <div className="text-xs text-muted-foreground mt-1">Chat history is now saved</div>
            </div>
          )}
        </div>

        {/* ── Chat panel (side-by-side on desktop, overlay on mobile) ─────── */}
          {!isSearching && showChat && (
            <div className={[
              "md:flex w-80 xl:w-96 flex-col border-l border-white/10 bg-neutral-800/95 backdrop-blur-xl",
              "md:hidden fixed inset-x-0 bottom-0 z-30 rounded-t-2xl bg-neutral-800/95 backdrop-blur-xl max-h-[50vh] border-t border-white/10",
            ].join(' ')}>
            {/* Chat header on mobile */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 md:hidden">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Live Chat</span>
              <button onClick={() => setShowChat(false)}
                className="text-white/50 text-xs">Close</button>
            </div>

            {/* Messages */}
            <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-xs text-white/40 py-6 font-semibold uppercase tracking-widest">
                  Live Chat
                </div>
              )}
              {messages.map((m) => {
                const mine = m.senderId === "me";
                return (
                  <div key={m.ts.toString() + m.content.length} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      mine
                        ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded-br-sm"
                        : "bg-white/20 text-white rounded-bl-sm"
                    }`}>
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-white/10 shrink-0">
              <div className="bg-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm outline-none px-2 text-white placeholder:text-white/40"
                  maxLength={200}
                />
                <button onClick={sendChat}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center hover:opacity-85 transition shrink-0 shadow-sm">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      {!isSearching && (
        <div className="flex items-center justify-center gap-2 md:gap-3 px-4 py-3 md:py-4 bg-neutral-900 shrink-0 z-20">
          <button
            onClick={sendRequest}
            disabled={requested}
            className={`px-4 md:px-6 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 transition ${
              requested
                ? "bg-gradient-to-r from-[#10B981] to-[#6EE7B7] text-white shadow-sm"
                : "bg-white text-foreground hover:opacity-80"
            }`}
          >
            {requested ? <><Check className="w-4 h-4" /> Friend Added</> : <><UserPlus className="w-4 h-4" /> Add Friend</>}
          </button>
          <button
            onClick={skipCall}
            className="px-4 md:px-6 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 bg-white text-foreground hover:opacity-80 transition"
          >
            <SkipForward className="w-4 h-4" /> Skip
          </button>
          <button
            onClick={endCall}
            className="px-4 md:px-6 py-2.5 md:py-3 rounded-full bg-gradient-to-r from-[#EF4444] to-[#F87171] text-white text-xs md:text-sm font-semibold flex items-center gap-1.5 md:gap-2 shadow-sm hover:opacity-90 transition"
          >
            <PhoneOff className="w-4 h-4" /> End
          </button>
        </div>
      )}
    </div>
  );
}
