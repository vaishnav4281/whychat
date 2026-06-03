import { useEffect, useState } from "react";
import { StorageService, ChatRecord } from "../services/storage";

interface Props {
  onOpenChat: (peer: any) => void;
}

export function ChatsList({ onOpenChat }: Props) {
  const [chats, setChats] = useState<Record<string, ChatRecord>>({});
  const [myId, setMyId] = useState('');

  useEffect(() => {
    const load = () => {
      const profile = StorageService.getProfile();
      setChats(StorageService.getChats());
      setMyId(profile?.id || '');
    };
    load();
    const interval = window.setInterval(load, 1000);
    return () => clearInterval(interval);
  }, []);

  const entries = Object.entries(chats);

  const requests: [string, ChatRecord][] = [];
  const general: [string, ChatRecord][] = [];

  for (const [peerId, record] of entries) {
    if (record.startedBy && record.startedBy !== myId && !record.iHaveReplied) {
      requests.push([peerId, record]);
    } else {
      general.push([peerId, record]);
    }
  }

  const requestCount = requests.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-xl font-bold">Chats</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-3xl mb-3">💬</div>
            <p className="text-muted-foreground">No chats yet</p>
            <p className="text-sm text-muted-foreground mt-1">Visit Explore to start a conversation</p>
          </div>
        ) : (
          <>
            {requests.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Requests</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#F472B6] text-white">{requestCount}</span>
                </div>
                {requests.map(([peerId, record]) => (
                  <div
                    key={peerId}
                    onClick={() => onOpenChat({ id: peerId, nickname: record.name, name: record.name, gender: 'M', languages: [], country: 'Unknown', avatar: '', online: false, isBot: false })}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {record.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{record.name || 'Stranger'}</div>
                      <div className="text-xs text-muted-foreground truncate">{record.lastMessage || 'Wants to chat'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {general.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">General</span>
                </div>
                {general.map(([peerId, record]) => (
                  <div
                    key={peerId}
                    onClick={() => onOpenChat({ id: peerId, nickname: record.name, name: record.name, gender: 'M', languages: [], country: 'Unknown', avatar: '', online: false, isBot: false })}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {record.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{record.name || 'Stranger'}</div>
                      <div className="text-xs text-muted-foreground truncate">{record.lastMessage || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
