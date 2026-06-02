import { useEffect, useRef, useState, useCallback } from "react";
import {
  UserPlus, SkipForward, PhoneOff, Check, Video as VideoIcon,
  Sparkles, ArrowLeft, Compass, MessagesSquare,
} from "lucide-react";
import {
  addFriend, createPeerConnection, openDataChannel, flagFor,
  generateMockPeers, wsStub, type PeerUser, type UserProfile,
} from "@/lib/peerStore";

type Phase = "idle" | "searching" | "live" | "ended";

interface Props {
  profile: UserProfile;
  onBack: () => void;
  onOpenChat: (peer: PeerUser) => void;
  onGoExplore: () => void;
}

export function VideoSession({ profile, onBack, onOpenChat, onGoExplore }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [peer, setPeer] = useState<PeerUser | null>(null);
  const [requested, setRequested] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const stopMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const startMedia = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
    } catch { /* permission denied — preview will be blank */ }
  }, []);

  // pick a random "stranger" from the active pool
  const matchNext = useCallback(() => {
    setRequested(false);
    setAccepted(false);
    setSeconds(0);
    setPhase("searching");
    pcRef.current?.close();
    const pc = createPeerConnection();
    openDataChannel(pc);
    pcRef.current = pc;
    wsStub.signal_handshake({ kind: "search", profile: profile.id });

    setTimeout(() => {
      const pool = generateMockPeers(20);
      const next = pool[Math.floor(Math.random() * pool.length)];
      setPeer(next);
      setPhase("live");
      wsStub.signal_handshake({ kind: "offer", peerId: next.id });
    }, 1100 + Math.random() * 900);
  }, [profile.id]);

  const enterPool = useCallback(async () => {
    await startMedia();
    wsStub.join_pool(profile);
    matchNext();
  }, [profile, startMedia, matchNext]);

  const endCall = () => {
    setPhase("ended");
    pcRef.current?.close();
    pcRef.current = null;
  };

  useEffect(() => {
    if (phase !== "live") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => stopMedia(), [stopMedia]);

  const sendRequest = () => {
    if (!peer) return;
    wsStub.send_request(peer.id);
    setRequested(true);
    setTimeout(() => {
      setAccepted(true);
      addFriend(peer);
      setTimeout(() => onOpenChat(peer), 1100);
    }, 1400);
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Idle landing ───────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card rounded-3xl max-w-xl w-full p-10 text-center animate-fade-up">
          <button onClick={onBack} className="absolute top-6 left-6 glass-strong rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="w-16 h-16 rounded-3xl gradient-cyber mx-auto mb-5 flex items-center justify-center shadow-lg">
            <VideoIcon className="w-7 h-7 text-white" />
          </div>
          <div className="meta-label mb-1">Live Pool</div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Meet a <span className="text-gradient-cyber">stranger</span>.
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Get paired with someone active in the pool right now. Send a friend request if you vibe — chat unlocks instantly.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="text-xs font-semibold">1,247 strangers online</span>
          </div>
          <button onClick={enterPool}
            className="gradient-cyber text-white font-semibold px-8 py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.99] transition inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Start Matching
          </button>
        </div>
      </div>
    );
  }

  // ── Ended ──────────────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card rounded-3xl max-w-md w-full p-8 text-center animate-fade-up">
          <div className="meta-label mb-2">Call Ended</div>
          <h2 className="text-2xl font-bold mb-6">What next?</h2>
          <div className="grid gap-2">
            <button onClick={matchNext}
              className="gradient-cyber text-white font-semibold py-3 rounded-2xl hover:scale-[1.01] transition inline-flex items-center justify-center gap-2">
              <SkipForward className="w-4 h-4" /> Match Again
            </button>
            <button onClick={onGoExplore}
              className="bg-white/70 border border-white/60 font-semibold py-3 rounded-2xl hover:scale-[1.01] transition inline-flex items-center justify-center gap-2">
              <Compass className="w-4 h-4" /> Explore
            </button>
            <button onClick={onBack}
              className="text-sm text-muted-foreground py-2 inline-flex items-center justify-center gap-2">
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
    <div className="fixed inset-0 z-40 p-4 md:p-8 bg-black/50 backdrop-blur-md flex">
      <div className="relative flex-1 rounded-[2rem] overflow-hidden bg-neutral-900 shadow-2xl">
        <div className="absolute inset-0 flex items-center justify-center" style={{
          background: "radial-gradient(circle at 30% 30%, #6366f1 0%, transparent 50%), radial-gradient(circle at 70% 70%, #ec4899 0%, transparent 50%), #111",
        }}>
          {isSearching ? (
            <div className="text-center">
              <div className="w-24 h-24 rounded-full mx-auto mb-6 gradient-cyber animate-pulse-dot" />
              <div className="text-white text-2xl font-bold tracking-tight">Searching the pool…</div>
              <div className="text-white/60 text-xs mt-2 uppercase tracking-widest">Pairing with a stranger</div>
            </div>
          ) : (
            <div className="text-center">
              <img src={peer.avatar} alt={peer.nickname}
                className="w-40 h-40 rounded-3xl mx-auto mb-6 ring-4 ring-white/20 bg-white/10" />
              <div className="text-white text-3xl font-bold tracking-tight">{peer.nickname}</div>
              <div className="text-white/70 text-sm mt-1 uppercase tracking-widest">
                {flagFor(peer.country)} {peer.country} · {peer.languages.join(" · ")}
              </div>
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button onClick={() => { endCall(); onBack(); }}
            className="glass-strong rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:scale-105 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Exit
          </button>
          <div className="glass-strong rounded-full px-3 py-1.5 flex items-center gap-2 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${isSearching ? "bg-amber-400" : "bg-red-500"} animate-pulse-dot`} />
            {isSearching ? "MATCHING" : `LIVE · ${fmt(seconds)}`}
          </div>
        </div>

        {/* PiP local preview */}
        <div className="absolute top-4 right-4 mt-12 w-40 h-28 md:w-56 md:h-40 rounded-2xl overflow-hidden ring-2 ring-white/40 shadow-2xl bg-black">
          <video ref={localRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          <div className="absolute bottom-1 left-2 text-[10px] uppercase tracking-widest text-white/90 font-semibold">You</div>
        </div>

        {/* Accepted toast */}
        {accepted && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-strong rounded-3xl px-8 py-6 text-center animate-fade-up">
            <div className="w-14 h-14 rounded-full gradient-cyber flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-white" />
            </div>
            <div className="font-bold text-lg">You&apos;re now friends</div>
            <div className="text-xs text-muted-foreground mt-1">Opening chat…</div>
          </div>
        )}

        {/* Control strip */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <div className="glass-strong rounded-full p-2 flex items-center gap-2">
            <button
              onClick={sendRequest}
              disabled={requested || isSearching}
              className={`px-4 md:px-5 py-3 rounded-full text-xs md:text-sm font-semibold flex items-center gap-2 transition-all ${
                requested
                  ? "bg-green-500/90 text-white"
                  : isSearching
                  ? "bg-white/40 text-white/60 cursor-not-allowed"
                  : "gradient-cyber text-white hover:scale-105"
              }`}
            >
              {requested ? <><Check className="w-4 h-4" /> Sent</> : <><UserPlus className="w-4 h-4" /> Add Friend</>}
            </button>
            <button
              onClick={matchNext}
              className="px-4 md:px-5 py-3 rounded-full bg-white/80 text-xs md:text-sm font-semibold flex items-center gap-2 hover:scale-105 transition"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </button>
            <button
              onClick={endCall}
              className="px-4 md:px-5 py-3 rounded-full bg-red-500 text-white text-xs md:text-sm font-semibold flex items-center gap-2 hover:scale-105 transition"
            >
              <PhoneOff className="w-4 h-4" /> End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
