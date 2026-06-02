import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, Mic, Square, Play } from "lucide-react";
import { flagFor, type PeerUser, type ChatMessage } from "@/lib/peerStore";

interface Props {
  peer: PeerUser;
  onBack: () => void;
}

export function PersistentChat({ peer, onBack }: Props) {
  const key = `chat_${peer.id}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(messages));
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, key]);

  const push = (m: Omit<ChatMessage, "id" | "at">) =>
    setMessages((prev) => [...prev, { ...m, id: `m_${Date.now()}_${Math.random()}`, at: Date.now() }]);

  const send = () => {
    if (!draft.trim()) return;
    push({ from: "me", kind: "text", payload: draft.trim() });
    setDraft("");
    setTimeout(() => push({
      from: "peer", kind: "text",
      payload: ["got it ✨", "lol same", "yes! exactly", "hmm tell me more"][Math.floor(Math.random()*4)],
    }), 900);
  };

  const onFile = async (f: File) => {
    const reader = new FileReader();
    reader.onload = () => push({ from: "me", kind: "image", payload: reader.result as string });
    reader.readAsDataURL(f);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        push({ from: "me", kind: "voice", payload: url });
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch { /* denied */ }
  };
  const stopRec = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="w-full h-full flex flex-col glass-card rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/40">
          <button onClick={onBack} className="w-9 h-9 rounded-full glass-strong flex items-center justify-center hover:scale-105 transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <img src={peer.avatar} alt="" className="w-11 h-11 rounded-full bg-white/60" />
          <div className="flex-1 min-w-0">
            <div className="font-bold tracking-tight">{peer.nickname}</div>
            <div className="meta-label !text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1.5 align-middle" />
              {flagFor(peer.country)} {peer.country} · online
            </div>
          </div>
        </div>

        {/* Feed */}
        <div ref={feedRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-12">
              Say hi to {peer.nickname} 👋
            </div>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
        </div>

        {/* Composer */}
        <div className="px-3 py-3 border-t border-white/40">
          <div className="glass-strong rounded-full px-3 py-2 flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center hover:scale-105 transition">
              <ImagePlus className="w-4 h-4" />
            </button>
            <button onClick={recording ? stopRec : startRec}
              className={`w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition ${
                recording ? "bg-red-500 text-white animate-pulse-dot" : "bg-white/70"
              }`}>
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-sm outline-none px-2"
            />
            <button onClick={send}
              className="w-10 h-10 rounded-full gradient-cyber text-white flex items-center justify-center hover:scale-105 transition">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.from === "me";
  const base = "max-w-[75%] rounded-3xl px-4 py-2.5 text-sm animate-fade-up shadow-sm";
  const skin = mine
    ? "gradient-cyber text-white rounded-br-md"
    : "glass-strong text-foreground rounded-bl-md";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`${base} ${skin}`}>
        {m.kind === "text" && <span className="whitespace-pre-wrap break-words">{m.payload}</span>}
        {m.kind === "image" && (
          <img src={m.payload} alt="" className="rounded-2xl max-w-xs max-h-72 -mx-1 -my-1" />
        )}
        {m.kind === "voice" && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <Play className="w-4 h-4" />
            <audio src={m.payload} controls className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
