import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, Mic, Square, Play, UserPlus, Check, WifiOff, Bot } from "lucide-react";
import { flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type ChatMessage } from "@/services/storage";
import { webrtc } from "@/services/webrtc";
import { signaling } from "@/services/signaling";
import { discovery } from "@/services/discovery";

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
  const [isFriend, setIsFriend] = useState(false);
  const [dcOnline, setDcOnline] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const friends = StorageService.getFriends();
    setIsFriend(!!friends[peer.id]);
  }, [peer.id]);

  useEffect(() => {
    setMessages(StorageService.getChatHistory(peer.id));
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });

    if (peer.isBot) {
      setDcOnline(true);
      discovery.clearInitiator();
      return;
    }

    const initiate = discovery.chatInitiatorFor === peer.id;
    webrtc.establishDataConnection(peer.id, initiate);
    discovery.clearInitiator();
    setDcOnline(webrtc.dcReady);
  }, [peer.id]);

  useEffect(() => {
    const handleDcStatus = (e: CustomEvent<{ status: string; peerId: string }>) => {
      if (e.detail.peerId === peer.id) {
        setDcOnline(e.detail.status === 'open');
      }
    };

    const handleStorageUpdate = (e: CustomEvent<{ key: string, value: any }>) => {
      if (e.detail.key === 'whychat_chats') {
        const chats = e.detail.value;
        if (chats[peer.id]) {
          setMessages(chats[peer.id]);
        }
      }
      if (e.detail.key === 'whychat_friends') {
        const friends = e.detail.value;
        setIsFriend(!!friends[peer.id]);
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

    window.addEventListener('whychat_dc_status', handleDcStatus as EventListener);
    window.addEventListener('whychat_storage_update', handleStorageUpdate as EventListener);
    window.addEventListener('whychat_text_received', handleTextRecv as EventListener);
    window.addEventListener('whychat_media_received', handleMediaRecv as EventListener);

    return () => {
      window.removeEventListener('whychat_dc_status', handleDcStatus as EventListener);
      window.removeEventListener('whychat_storage_update', handleStorageUpdate as EventListener);
      window.removeEventListener('whychat_text_received', handleTextRecv as EventListener);
      window.removeEventListener('whychat_media_received', handleMediaRecv as EventListener);
      if (!peer.isBot) webrtc.closeConnections();
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
    if (peer.isBot) {
      const profile = StorageService.getProfile();
      signaling.send({ type: 'BOT_MSG', target: peer.id, data: { text: draft.trim(), from: profile?.id } });
    } else {
      webrtc.sendText(draft.trim());
    }
    pushLocal({ type: "text", content: draft.trim() });
    setDraft("");
  };

  const onFile = async (f: File) => {
    if (peer.isBot) return;
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

  const handleConnect = () => {
    discovery.sendFriendRequest(peer.id);
    setIsFriend(true);
  };

  return (
    <div className="w-full h-full flex flex-col card-premium card-accent-top overflow-hidden">
      {/* Header */}
      <div className="px-3 md:px-5 py-3 md:py-4 flex items-center gap-2 md:gap-3 border-b border-border">
        <button onClick={onBack} className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary flex items-center justify-center hover:opacity-80 transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <img src={peer.avatar} alt="" className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-secondary ring-2 ring-[#D8D0F5]" />
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight truncate text-sm md:text-base">{peer.nickname}</div>
          <div className="tag-premium !text-[9px] md:!text-[10px] flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${dcOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            {peer.isBot && <Bot className="w-2.5 h-2.5 text-purple-500" />}
            {flagFor(peer.country)} {peer.country}
            {peer.isBot && <span className="text-purple-500 font-semibold">Bot</span>}
            {!dcOnline && !peer.isBot && <WifiOff className="w-2.5 h-2.5 text-muted-foreground" />}
          </div>
        </div>
        {!isFriend && (
          <button onClick={handleConnect}
            className="btn-gradient text-[11px] md:text-xs font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-1.5 shrink-0">
            <UserPlus className="w-3.5 h-3.5" /> Connect
          </button>
        )}
        {isFriend && (
          <div className="text-[11px] md:text-xs font-semibold px-3 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-1.5 bg-gradient-to-r from-[#10B981] to-[#6EE7B7] text-white shadow-sm">
            <Check className="w-3.5 h-3.5" /> Friends
          </div>
        )}
      </div>

      {/* Feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-3 md:px-5 py-4 md:py-6 space-y-3 bg-[#FAFAFE]">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            {peer.isBot
              ? `${peer.nickname} is a bot — say hi to see a reply!`
              : `Say hi to ${peer.nickname}`
            }
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.ts.toString() + m.content.length} m={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="px-2 md:px-3 py-2 md:py-3 border-t border-border">
        <div className="bg-secondary rounded-full px-2 md:px-3 py-1.5 md:py-2 flex items-center gap-1.5 md:gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFile(e.target.files[0]);
                e.target.value = '';
              }
            }} />
          <button onClick={() => fileRef.current?.click()}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-card text-foreground flex items-center justify-center hover:opacity-80 transition shrink-0 border border-border">
            <ImagePlus className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
          <button onClick={recording ? stopRec : startRec}
            className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition shrink-0 border border-border ${
              recording ? "bg-gradient-to-r from-[#EF4444] to-[#F87171] text-white" : "bg-card text-foreground hover:opacity-80"
            }`}>
            {recording ? <Square className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 bg-transparent text-sm outline-none px-1 placeholder:text-muted-foreground"
          />
          <button onClick={send}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center hover:opacity-85 transition shrink-0 shadow-sm">
            <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.senderId === "me";
  const base = "max-w-[75%] rounded-2xl px-3 md:px-4 py-2 md:py-2.5 text-sm animate-in shadow-sm";
  const skin = mine
    ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white rounded-br-sm"
    : "bg-card text-foreground rounded-bl-sm border border-border";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`${base} ${skin}`}>
        {m.type === "text" && <span className="whitespace-pre-wrap break-words">{m.content}</span>}
        {m.type === "image" && (
          <img src={m.content} alt="" className="rounded-xl max-w-[200px] md:max-w-xs max-h-48 md:max-h-72 -mx-1 -my-1" />
        )}
        {m.type === "voice" && (
          <div className="flex items-center gap-2 min-w-[140px] md:min-w-[160px]">
            <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <audio src={m.content} controls className="h-7 md:h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
