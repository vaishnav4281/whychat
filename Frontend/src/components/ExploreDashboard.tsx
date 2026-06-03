import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Check, UserPlus, Radio, Filter } from "lucide-react";
import { COUNTRIES, LANGUAGES, flagFor, type PeerUser } from "@/lib/peerStore";
import { StorageService, type Friend } from "@/services/storage";
import { signaling } from "@/services/signaling";
import { discovery } from "@/services/discovery";

const ACCENT_CLASSES = ["card-accent-top", "card-accent-pink", "card-accent-blue", "card-accent-green"];

interface Props {
  onOpenChat: (peer: PeerUser) => void;
}

export function ExploreDashboard({ onOpenChat }: Props) {
  const [allPeers, setAllPeers] = useState<Array<Record<string, unknown>>>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const [genderFilter, setGenderFilter] = useState<"all" | "M" | "F">("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [langFilter, setLangFilter] = useState<string>("all");

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
    if (!signaling.isReady()) return;
    fetchExploreWithFilters();
  }, [genderFilter, countryFilter, langFilter, fetchExploreWithFilters]);

  useEffect(() => {
    signaling.connect().then(fetchExploreWithFilters).catch(() => {});

    const updateStorageState = () => {
      setFriends(Object.values(StorageService.getFriends()));
      setSentTo(new Set(StorageService.getRequests().outgoing));
    };
    updateStorageState();

    const handleStorageUpdate = () => updateStorageState();
    const handleExploreData = (e: CustomEvent<any[]>) => {
      setAllPeers(e.detail);
    };
    const handleConnected = () => fetchExploreWithFilters();
    const handlePoolUpdate = () => fetchExploreWithFilters();

    signaling.events.addEventListener('explore_data', handleExploreData as EventListener);
    signaling.events.addEventListener('connected', handleConnected);
    signaling.events.addEventListener('pool_update', handlePoolUpdate as EventListener);
    window.addEventListener('whychat_storage_update', handleStorageUpdate);

    const refreshInterval = setInterval(() => {
      if (document.hidden) return;
      fetchExploreWithFilters();
    }, 5000);

    return () => {
      window.removeEventListener('whychat_storage_update', handleStorageUpdate);
      signaling.events.removeEventListener('explore_data', handleExploreData as EventListener);
      signaling.events.removeEventListener('connected', handleConnected);
      signaling.events.removeEventListener('pool_update', handlePoolUpdate as EventListener);
      clearInterval(refreshInterval);
    };
  }, [fetchExploreWithFilters]);

  const filtered = useMemo(() => {
    return allPeers.filter((p) => {
      if (genderFilter !== "all" && p.gender !== genderFilter) return false;
      if (countryFilter !== "all" && p.country !== countryFilter) return false;
      if (langFilter !== "all" && (!p.languages || !(p.languages as string[]).includes(langFilter))) return false;
      return true;
    });
  }, [allPeers, genderFilter, countryFilter, langFilter]);

  const sendReq = (p: Record<string, unknown>) => {
    discovery.sendFriendRequest(String(p.id));
  };

  const handleOpenChat = (p: Record<string, unknown>) => {
    discovery.initiateChat(String(p.id), p as unknown as PeerUser);
    onOpenChat(p as unknown as PeerUser);
  };

  return (
    <div className="p-5 md:p-6 pb-24 md:pb-6">
      {/* Filter pills */}
      <div className="card-premium p-3 mb-5 flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground ml-1 shrink-0" />
        <PillSelect label="Gender" value={genderFilter} setValue={(v) => setGenderFilter(v as typeof genderFilter)}
          options={[{ v: "all", l: "Any" }, { v: "F", l: "Female" }, { v: "M", l: "Male" }]} />
        <PillSelect label="Country" value={countryFilter} setValue={setCountryFilter}
          options={[{ v: "all", l: "Anywhere" }, ...COUNTRIES.map((c) => ({ v: c.name, l: `${c.flag} ${c.name}` }))]} />
        <PillSelect label="Language" value={langFilter} setValue={setLangFilter}
          options={[{ v: "all", l: "Any" }, ...LANGUAGES.map((l) => ({ v: l, l }))]} />
        <div className="ml-auto surface-soft flex items-center gap-2 px-3 py-1.5">
          <Radio className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold tabular-nums">{filtered.length}</span>
          <span className="tag-premium !text-[10px]">online now</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filtered.map((p, i) => {
          const sent = sentTo.has(String(p.id));
          const isFriend = friends.some((f) => f.id === p.id);
          const accentClass = ACCENT_CLASSES[i % ACCENT_CLASSES.length];
          return (
            <article
              key={String(p.id)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`card-premium-hover ${accentClass} p-5 animate-in`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                  <img src={String(p.avatar ?? "")} alt={String(p.nickname ?? "")}
                    className="w-14 h-14 rounded-2xl bg-secondary ring-2 ring-[#D8D0F5]" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold tracking-tight truncate">{String(p.nickname ?? "")}</h3>
                  <div className="tag-premium !text-[10px] mt-0.5">{flagFor(String(p.country ?? ""))} {String(p.country ?? "")}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-4 min-h-[26px]">
                {(p.languages as string[] | undefined)?.map((l: string) => (
                  <span key={l} className="text-[10px] font-semibold uppercase tracking-wider bg-secondary border border-border rounded-full px-2 py-0.5">{l}</span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {isFriend ? (
                  <button onClick={() => handleOpenChat(p)}
                    className="col-span-2 btn-gradient text-center flex items-center justify-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Open Chat
                  </button>
                ) : (
                  <>
                    <button onClick={() => sendReq(p)} disabled={sent}
                      className={`text-xs font-semibold py-2.5 rounded-full flex items-center justify-center gap-1.5 transition ${
                        sent ? "bg-gradient-to-r from-[#10B981] to-[#6EE7B7] text-white shadow-sm" : "btn-gradient"
                      }`}>
                      {sent ? <><Check className="w-3.5 h-3.5" /> Sent</> : <><UserPlus className="w-3.5 h-3.5" /> Add</>}
                    </button>
                    <button onClick={() => handleOpenChat(p)}
                      className="btn-secondary text-center flex items-center justify-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Message
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function PillSelect({ label, value, setValue, options }: {
  label: string; value: string; setValue: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label className="surface-soft rounded-full px-3 py-1.5 flex items-center gap-2 text-xs">
      <span className="tag-premium !text-[10px]">{label}</span>
      <select value={value} onChange={(e) => setValue(e.target.value)}
        className="bg-transparent outline-none text-xs font-semibold cursor-pointer">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
