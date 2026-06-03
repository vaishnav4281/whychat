import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, Radio, Filter } from "lucide-react";
import { COUNTRIES, LANGUAGES, flagFor } from "@/lib/peerStore";
import { discovery } from "@/services/discovery";
import { signaling } from "@/services/signaling";

const ACCENT_CLASSES = ["card-accent-top", "card-accent-pink", "card-accent-blue", "card-accent-green"];

interface Props {
  onOpenChat: (peer: any) => void;
}

export function ExploreDashboard({ onOpenChat }: Props) {
  const [allPeers, setAllPeers] = useState<Array<Record<string, unknown>>>([]);

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

    const handleExploreData = (e: CustomEvent<any[]>) => {
      setAllPeers(e.detail);
    };
    const handleConnected = () => fetchExploreWithFilters();
    const handlePoolUpdate = () => fetchExploreWithFilters();

    signaling.events.addEventListener('explore_data', handleExploreData as EventListener);
    signaling.events.addEventListener('connected', handleConnected);
    signaling.events.addEventListener('pool_update', handlePoolUpdate as EventListener);

    const refreshInterval = setInterval(() => {
      if (document.hidden) return;
      fetchExploreWithFilters();
    }, 5000);

    return () => {
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

  const handleOpenChat = (p: Record<string, unknown>) => {
    discovery.initiateChat(String(p.id), p as any);
    onOpenChat(p as any);
  };

  return (
    <div className="p-3 md:p-6 pb-16 md:pb-6">
      {/* Filter pills */}
      <div className="card-premium p-2 md:p-3 mb-4 flex items-center gap-1.5 md:gap-2 flex-nowrap md:flex-wrap overflow-x-auto">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden md:block" />
        <PillSelect label="Gender" value={genderFilter} setValue={(v) => setGenderFilter(v as typeof genderFilter)}
          options={[{ v: "all", l: "Any" }, { v: "F", l: "Female" }, { v: "M", l: "Male" }]} />
        <PillSelect label="Country" value={countryFilter} setValue={setCountryFilter}
          options={[{ v: "all", l: "Any" }, ...COUNTRIES.slice(0, 5).map((c) => ({ v: c.name, l: `${c.flag} ${c.name}` }))]} />
        <PillSelect label="Lang" value={langFilter} setValue={setLangFilter}
          options={[{ v: "all", l: "Any" }, ...LANGUAGES.slice(0, 8).map((l) => ({ v: l, l }))]} />
        <div className="ml-auto surface-soft flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 shrink-0">
          <Radio className="w-3 h-3 text-green-500" />
          <span className="text-[11px] md:text-xs font-semibold tabular-nums">{filtered.length}</span>
          <span className="tag-premium !text-[9px] md:!text-[10px] hidden md:inline">online</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
        {filtered.map((p, i) => {
          const pid = String(p.id);
          const accentClass = ACCENT_CLASSES[i % ACCENT_CLASSES.length];
          return (
            <article
              key={pid}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`card-premium-hover ${accentClass} p-4 md:p-5 animate-in`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="relative">
                  <img src={String(p.avatar ?? "")} alt={String(p.nickname ?? "")}
                    className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-secondary ring-2 ring-[#D8D0F5]" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 ring-2 ring-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold tracking-tight truncate text-sm md:text-base">{String(p.nickname ?? "")}</h3>
                  <div className="tag-premium !text-[9px] md:!text-[10px] mt-0.5">{flagFor(String(p.country ?? ""))} {String(p.country ?? "")}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 min-h-[22px]">
                {(p.languages as string[] | undefined)?.slice(0, 3).map((l: string) => (
                  <span key={l} className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wider bg-secondary border border-border rounded-full px-1.5 md:px-2 py-0.5">{l}</span>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-1.5 md:gap-2">
                <button onClick={() => handleOpenChat(p)}
                  className="btn-gradient text-[11px] md:text-xs font-semibold py-2 md:py-2.5 rounded-full flex items-center justify-center gap-1 md:gap-1.5">
                  <MessageCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Message
                </button>
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
    <label className="surface-soft rounded-full px-2 md:px-3 py-1 md:py-1.5 flex items-center gap-1 md:gap-2 text-[11px] md:text-xs shrink-0">
      <span className="tag-premium !text-[8px] md:!text-[10px]">{label}</span>
      <select value={value} onChange={(e) => setValue(e.target.value)}
        className="bg-transparent outline-none text-[11px] md:text-xs font-semibold cursor-pointer max-w-[80px] md:max-w-none">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}
