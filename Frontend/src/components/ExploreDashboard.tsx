import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, Check, X, Users, UserPlus, Radio, Filter,
} from "lucide-react";
import {
  COUNTRIES, LANGUAGES, flagFor,
  type UserProfile, type PeerUser,
} from "@/lib/peerStore";
import { StorageService, type FriendRequest, type Friend } from "@/services/storage";
import { signaling } from "@/services/signaling";
import { discovery } from "@/services/discovery";
import { TopNav } from "./TopNav";

export type Session = "explore" | "video" | "chats";

interface Props {
  profile: UserProfile;
  session: Session;
  onSessionChange: (s: Session) => void;
  onLogout: () => void;
  onOpenChat: (peer: PeerUser) => void;
}

type SidebarTab = "requests" | "friends";

export function ExploreDashboard({ profile, session, onSessionChange, onLogout, onOpenChat }: Props) {
  const [allPeers, setAllPeers] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  const [tab, setTab] = useState<SidebarTab>("requests");
  const [genderFilter, setGenderFilter] = useState<"all" | "M" | "F">("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [online, setOnline] = useState(0);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const genderRef = useRef(genderFilter);
  const countryRef = useRef(countryFilter);
  const langRef = useRef(langFilter);
  genderRef.current = genderFilter;
  countryRef.current = countryFilter;
  langRef.current = langFilter;

  const fetchExploreWithFilters = useCallback(() => {
    discovery.fetchExplore({
      gender: genderRef.current,
      country: countryRef.current,
      language: langRef.current,
    });
  }, []);

  useEffect(() => {
    fetchExploreWithFilters();
  }, [genderFilter, countryFilter, langFilter, fetchExploreWithFilters]);

  useEffect(() => {
    signaling.connect().then(fetchExploreWithFilters).catch(() => {});

    const updateStorageState = () => {
      setRequests(StorageService.getRequests().incoming);
      setFriends(Object.values(StorageService.getFriends()));
      setSentTo(new Set(StorageService.getRequests().outgoing));
    };
    updateStorageState();

    const handleStorageUpdate = () => updateStorageState();
    const handleExploreData = (e: CustomEvent<any[]>) => {
      setAllPeers(e.detail);
    };
    const handleMetrics = (e: CustomEvent<{ online: number }>) => {
      setOnline(e.detail.online);
    };
    const handleConnected = () => fetchExploreWithFilters();
    const handlePoolUpdate = () => fetchExploreWithFilters();

    window.addEventListener('whychat_storage_update', handleStorageUpdate);
    signaling.events.addEventListener('explore_data', handleExploreData as EventListener);
    signaling.events.addEventListener('global_metrics', handleMetrics as EventListener);
    signaling.events.addEventListener('connected', handleConnected);
    signaling.events.addEventListener('pool_update', handlePoolUpdate as EventListener);

    const refreshInterval = setInterval(() => {
      if (document.hidden) return;
      fetchExploreWithFilters();
    }, 5000);

    return () => {
      window.removeEventListener('whychat_storage_update', handleStorageUpdate);
      signaling.events.removeEventListener('explore_data', handleExploreData as EventListener);
      signaling.events.removeEventListener('global_metrics', handleMetrics as EventListener);
      signaling.events.removeEventListener('connected', handleConnected);
      signaling.events.removeEventListener('pool_update', handlePoolUpdate as EventListener);
      clearInterval(refreshInterval);
    };
  }, [fetchExploreWithFilters]);

  const filtered = useMemo(() => {
    return allPeers.filter((p) => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (countryFilter !== "all" && p.country !== countryFilter) return false;
      if (langFilter !== "all" && (!p.languages || !p.languages.includes(langFilter))) return false;
      return true;
    });
  }, [allPeers, genderFilter, countryFilter, langFilter]);

  const acceptRequest = (r: FriendRequest) => {
    discovery.acceptFriendRequest(r.id, r);
  };
  const declineRequest = (r: FriendRequest) => {
    StorageService.removeRequest(r.id);
  };

  const sendReq = (p: Record<string, unknown>) => {
    discovery.sendFriendRequest(String(p.id));
  };

  const handleOpenChat = (p: Record<string, unknown>) => {
    discovery.initiateChat(String(p.id), p as unknown as PeerUser);
    onOpenChat(p as unknown as PeerUser);
  };

  return (
    <div className="min-h-screen">
      <TopNav profile={profile} session={session} onSessionChange={onSessionChange} onLogout={onLogout} online={online} />

      <div className="px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 md:gap-6 pb-12">
        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="glass-card rounded-3xl p-1.5 flex">
            {([
              { k: "requests" as const, label: "Requests", icon: UserPlus, count: requests.length },
              { k: "friends" as const, label: "Friends", icon: Users, count: friends.length },
            ]).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`flex-1 rounded-2xl px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 md:gap-2 transition-all ${
                  tab === t.k ? "gradient-premium text-white shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
                <span className="text-[10px] opacity-80">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="glass-card rounded-3xl p-4 min-h-[400px] md:min-h-[420px]">
            {tab === "requests" ? (
              <div className="space-y-2">
                <div className="meta-label px-1 mb-2">Incoming · {requests.length}</div>
                {requests.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    No pending requests.
                  </div>
                )}
                {requests.map((r) => (
                  <div key={r.id} className="glass-strong rounded-2xl p-3 flex items-center gap-3 animate-in">
                    <img src={r.avatar} alt="" className="w-11 h-11 rounded-full bg-white/[0.06]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{r.name}</div>
                      <div className="meta-label !text-[10px]">{flagFor(r.country)} {r.country}</div>
                    </div>
                    <button onClick={() => acceptRequest(r)}
                      className="w-8 h-8 rounded-full gradient-cyber text-white flex items-center justify-center hover:scale-110 transition shrink-0">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => declineRequest(r)}
                      className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center hover:scale-110 transition shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="meta-label px-1 mb-2">Friends · {friends.length}</div>
                {friends.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    No friends yet. Jump into Video to meet strangers.
                  </div>
                )}
                {friends.map((f) => (
                  <button key={f.id} onClick={() => handleOpenChat(f)}
                    className="w-full glass-strong rounded-2xl p-3 flex items-center gap-3 hover:bg-white/[0.06] transition text-left">
                    <div className="relative shrink-0">
                      <img src={f.avatar} alt="" className="w-11 h-11 rounded-full bg-white/[0.06]" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-[var(--card)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{f.name}</div>
                      <div className="meta-label !text-[10px]">{flagFor(f.country)} {f.country}</div>
                    </div>
                    <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main>
          {/* Filter pills */}
          <div className="glass-card rounded-3xl p-3 mb-4 md:mb-6 flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
            <PillSelect label="Gender" value={genderFilter} setValue={(v) => setGenderFilter(v as typeof genderFilter)}
              options={[{ v: "all", l: "Any" }, { v: "F", l: "Female" }, { v: "M", l: "Male" }]} />
            <PillSelect label="Country" value={countryFilter} setValue={setCountryFilter}
              options={[{ v: "all", l: "Anywhere" }, ...COUNTRIES.map((c) => ({ v: c.name, l: `${c.flag} ${c.name}` }))]} />
            <PillSelect label="Language" value={langFilter} setValue={setLangFilter}
              options={[{ v: "all", l: "Any" }, ...LANGUAGES.map((l) => ({ v: l, l }))]} />
            <div className="ml-auto glass rounded-full px-3 py-1.5 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-semibold tabular-nums">{filtered.length}</span>
              <span className="meta-label !text-[10px]">online now</span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((p, i) => {
              const sent = sentTo.has(p.id);
              const isFriend = friends.some((f) => f.id === p.id);
              return (
                <article
                  key={p.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="glass-card rounded-3xl p-5 group hover:scale-[1.02] hover:shadow-xl transition-all duration-300 animate-in glow-inset"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative">
                      <div className="gradient-border rounded-2xl">
                        <img src={p.avatar} alt={p.nickname}
                          className="w-14 h-14 rounded-2xl bg-white/[0.06]" />
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-[var(--card)] animate-pulse-dot" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold tracking-tight truncate">{p.nickname}</h3>
                      <div className="meta-label !text-[10px] mt-0.5">{flagFor(p.country)} {p.country}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4 min-h-[26px]">
                    {p.languages?.map((l: string) => (
                      <span key={l} className="text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] border border-white/[0.1] rounded-full px-2 py-0.5">
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 opacity-90 group-hover:opacity-100 transition">
                    {isFriend ? (
                      <button
                        onClick={() => handleOpenChat(p)}
                        className="col-span-2 gradient-premium text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:scale-[1.02] transition">
                        <MessageCircle className="w-3.5 h-3.5" /> Open Chat
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => sendReq(p)}
                          disabled={sent}
                          className={`text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition ${
                            sent
                              ? "bg-green-500/90 text-white"
                              : "gradient-premium text-white hover:scale-105"
                          }`}>
                          {sent ? <><Check className="w-3.5 h-3.5" /> Sent</> : <><UserPlus className="w-3.5 h-3.5" /> Add</>}
                        </button>
                        <button
                          onClick={() => handleOpenChat(p)}
                          className="bg-white/[0.06] border border-white/[0.1] text-foreground text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/[0.1] hover:scale-105 transition">
                          <MessageCircle className="w-3.5 h-3.5" /> Message
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

function PillSelect({ label, value, setValue, options }: {
  label: string; value: string; setValue: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label className="glass rounded-full px-3 py-1.5 flex items-center gap-2 text-xs">
      <span className="meta-label !text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-transparent outline-none text-xs font-semibold cursor-pointer"
      >
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
