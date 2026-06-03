import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, Mic, Square, Play } from "lucide-react";
import { flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type ChatMessage } from "@/services/storage";
import { webrtc } from "@/services/webrtc";

interface Props {
  peer: PeerUser;
  onBack: () => void;
}

export function PersistentChat({ peer, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => 
    StorageService.getChatHistory(peer.id)
  );
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    webrtc.establishDataConnection(peer.id);
    setMessages(StorageService.getChatHistory(peer.id));
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [peer.id]);

  useEffect(() => {
    const handleStorageUpdate = (e: CustomEvent<{ key: string, value: any }>) => {
      if (e.detail.key === 'whychat_chats') {
        const chats = e.detail.value;
        if (chats[peer.id]) {
          setMessages(chats[peer.id]);
        }
      }
    };

    const handleTextRecv = (e: CustomEvent<{ text: string, sender: string }>) => {
      if (e.detail.sender === peer.id) {
        StorageService.addChatMessage(peer.id, {
          senderId: peer.id,
          type: 'text',
          content: e.detail.text,
          ts: Date.now()
        });
      }
    };

    const handleMediaRecv = (e: CustomEvent<{ url: string, mimeType: string, sender: string }>) => {
      if (e.detail.sender === peer.id) {
        StorageService.addChatMessage(peer.id, {
          senderId: peer.id,
          type: e.detail.mimeType.startsWith('image/') ? 'image' : 'voice',
          content: e.detail.url,
          ts: Date.now()
        });
      }
    };

    window.addEventListener('whychat_storage_update', handleStorageUpdate as EventListener);
    window.addEventListener('whychat_text_received', handleTextRecv as EventListener);
    window.addEventListener('whychat_media_received', handleMediaRecv as EventListener);

    return () => {
      window.removeEventListener('whychat_storage_update', handleStorageUpdate as EventListener);
      window.removeEventListener('whychat_text_received', handleTextRecv as EventListener);
      window.removeEventListener('whychat_media_received', handleMediaRecv as EventListener);
      webrtc.closeConnections();
    };
  }, [peer.id]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const pushLocal = (m: Pick<ChatMessage, "type" | "content">) => {
    StorageService.addChatMessage(peer.id, {
      senderId: 'me',
      type: m.type,
      content: m.content,
      ts: Date.now()
    });
  };

  const send = () => {
    if (!draft.trim()) return;
    webrtc.sendText(draft.trim());
    pushLocal({ type: "text", content: draft.trim() });
    setDraft("");
  };

  const onFile = async (f: File) => {
    webrtc.sendFile(f);
    const localUrl = URL.createObjectURL(f);
    pushLocal({ type: "image", content: localUrl });
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        
        webrtc.sendFile(file);
        
        const url = URL.createObjectURL(blob);
        pushLocal({ type: "voice", content: url });
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
    <div className="w-full h-full flex flex-col card-apple overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 py-3.5 md:py-4 flex items-center gap-3 border-b border-border">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center hover:opacity-80 transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <img src={peer.avatar} alt="" className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-secondary ring-1 ring-border" />
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight truncate">{peer.nickname}</div>
          <div className="tag-apple !text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1.5 align-middle" />
            {flagFor(peer.country)} {peer.country} · peer-to-peer
          </div>
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-4 md:px-5 py-5 md:py-6 space-y-3 bg-[#FBFBFD]">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Say hi to {peer.nickname}
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.ts.toString() + m.content.length} m={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="px-3 py-3 border-t border-border">
        <div className="bg-secondary rounded-full px-3 py-2 flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFile(e.target.files[0]);
                e.target.value = '';
              }
            }} />
          <button onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-full bg-card text-foreground flex items-center justify-center hover:opacity-80 transition shrink-0 border border-border">
            <ImagePlus className="w-4 h-4" />
          </button>
          <button onClick={recording ? stopRec : startRec}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 border border-border ${
              recording ? "bg-destructive text-white" : "bg-card text-foreground hover:opacity-80"
            }`}>
            {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm outline-none px-1 md:px-2 placeholder:text-muted-foreground"
          />
          <button onClick={send}
            className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.senderId === "me";
  const base = "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm animate-in shadow-sm";
  const skin = mine
    ? "bg-foreground text-background rounded-br-sm"
    : "bg-card text-foreground rounded-bl-sm border border-border";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`${base} ${skin}`}>
        {m.type === "text" && <span className="whitespace-pre-wrap break-words">{m.content}</span>}
        {m.type === "image" && (
          <img src={m.content} alt="" className="rounded-2xl max-w-xs max-h-72 -mx-1 -my-1" />
        )}
        {m.type === "voice" && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <Play className="w-4 h-4" />
            <audio src={m.content} controls className="h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
