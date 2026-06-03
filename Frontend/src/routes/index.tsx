import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Sparkles, Globe2, Shield, Users, ArrowRight, Languages, Compass, ArrowLeft } from "lucide-react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { StorageService } from "@/services/storage";
import { COUNTRIES, LANGUAGES, flagFor, avatarFor, type Gender, type UserProfile } from "@/lib/peerStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WhyChat — Connect with Strangers Worldwide | Free Global Chat | No Signup" },
      { name: "description", content: "Join WhyChat and meet strangers from 150+ countries. Free global chat platform for language exchange, making friends, and cultural discovery. Supports English, Hindi, Tamil, Malayalam, Telugu, Kannada, Bengali, Spanish, Japanese & more. Real-time messaging, no signup required." },
      { name: "keywords", content: "chat with strangers, online chat, free chat app, global chat, language exchange, meet new people, anonymous chat, text chat, make friends online, international chat, why chat, stranger chat, hindi chat, tamil chat, malayalam chat, telugu chat, india chat, language practice, free messaging, no signup chat, private chat" },
      { name: "robots", content: "index, follow" },
      { name: "googlebot", content: "index, follow" },
      { property: "og:title", content: "WhyChat — Connect with Strangers Worldwide | Free & Private" },
      { property: "og:description", content: "Meet new people from around the world. Free, instant, and private. Supports 26+ languages including Hindi, Tamil, Malayalam & more." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://whychat.pages.dev" },
      { property: "og:site_name", content: "WhyChat" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WhyChat — Connect with Strangers Worldwide" },
      { name: "twitter:description", content: "Free global chat to meet people from 150+ countries. No signup, no data stored. Supports 26+ languages." },
      { name: "twitter:site", content: "@whychat" },
      { name: "twitter:creator", content: "@whychat" },
    ],
    links: [
      { rel: "canonical", href: "https://whychat.pages.dev" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "WhyChat",
          url: "https://whychat.pages.dev",
          description: "Free global chat platform to meet strangers, make friends, practice languages, and discover cultures through real-time messaging. Supports 26+ languages with no signup required.",
          applicationCategory: "SocialNetworking",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: { "@type": "Organization", name: "WhyChat" },
          inLanguage: ["English", "Hindi", "Tamil", "Malayalam", "Telugu", "Kannada", "Bengali", "Spanish", "Japanese", "Mandarin", "Arabic", "Portuguese", "French", "German", "Korean"],
        }),
      },
    ],
  }),
  component: Landing,
});

function LandingHero({ onGetStarted, hasSession }: { onGetStarted: () => void; hasSession: boolean }) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-[#7C3AED]/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#EC4899]/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#3B82F6]/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-xs font-semibold text-[#7C3AED] mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Now available worldwide
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6 text-balance">
          <span className="bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#3B82F6] bg-clip-text text-transparent">
            Connect with Strangers
          </span>
          <br />
          <span className="text-foreground">Worldwide</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
          WhyChat is a free, instant messaging platform to meet new people from over 150 countries.
          Practice languages, make friends, and explore cultures — all from your browser.
        </p>

        <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
          <span className="pill-premium inline-flex items-center gap-1.5 text-xs"><Shield className="w-3 h-3 text-green-500" /> No login required</span>
          <span className="pill-premium inline-flex items-center gap-1.5 text-xs"><Shield className="w-3 h-3 text-green-500" /> 100% private — nothing stored</span>
          <span className="pill-premium inline-flex items-center gap-1.5 text-xs"><Shield className="w-3 h-3 text-green-500" /> No email needed</span>
        </div>

        <button onClick={onGetStarted}
          className="btn-gradient px-10 py-5 text-lg font-bold text-center flex items-center gap-3 shadow-xl shadow-[#7C3AED]/30 mx-auto mb-4 animate-in">
          {hasSession ? 'Continue to Chat' : "Create Your Profile — It's Free"} <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-xs text-muted-foreground mb-16">No signup, no download, no data stored. Just pick a name and start.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { value: "150+", label: "Countries" },
            { value: "Real-time", label: "Messaging" },
            { value: "Zero", label: "Data stored" },
          ].map((s) => (
            <div key={s.label} className="card-premium p-4">
              <div className="text-2xl font-black text-[#7C3AED]">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Compass, title: "Instant Matching", desc: "Discover people nearby and around the world in real-time. Filter by gender, country, and language to find your perfect conversation partner." },
    { icon: Languages, title: "Language Exchange", desc: "Practice English, Spanish, Mandarin, Japanese, and 20+ languages with native speakers. Perfect your fluency through real conversations." },
    { icon: Globe2, title: "Global Community", desc: "Connect with people from the United States, Japan, Brazil, Germany, India, Korea, and 150+ countries. Explore cultures without leaving home." },
    { icon: Shield, title: "Private & Secure", desc: "Your data stays on your device. No accounts, no emails, no tracking. Chat anonymously with end-to-end encrypted messaging." },
  ];
  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="badge-gradient mb-4 inline-block">Features</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Everything you need to connect</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">WhyChat makes it easy to meet new people from anywhere in the world, instantly.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <article key={f.title} className={`card-premium-hover p-6 md:p-8 ${i === 0 ? "card-accent-top" : i === 1 ? "card-accent-pink" : i === 2 ? "card-accent-blue" : "card-accent-green"}`}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7C3AED]/20 to-[#EC4899]/20 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection({ onGetStarted }: { onGetStarted: () => void }) {
  const steps = [
    { step: "01", title: "Create Your Profile", desc: "Pick a nickname, your country, and languages you speak. No email, no password — just you." },
    { step: "02", title: "Discover People", desc: "Browse live profiles filtered by gender, country, or language. See who's online right now." },
    { step: "03", title: "Start Chatting", desc: "Send a friend request or message instantly. Make connections that last." },
  ];
  return (
    <section className="px-6 py-24 md:py-32 bg-gradient-to-b from-transparent via-[#7C3AED]/5 to-transparent">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="badge-gradient mb-4 inline-block">How It Works</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Three simple steps</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Start meeting new people in under 30 seconds.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {steps.map((s, i) => (
            <div key={s.step} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white text-2xl font-black flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#7C3AED]/20">
                {s.step}
              </div>
              <h3 className="text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <button onClick={onGetStarted}
            className="btn-gradient px-8 py-4 text-base font-semibold inline-flex items-center gap-2 shadow-lg shadow-[#7C3AED]/25">
            Start Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function CountriesSection() {
  const rows = [
    COUNTRIES.slice(0, 8),
    COUNTRIES.slice(8, 16),
  ];
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-4xl mx-auto text-center">
        <div className="badge-gradient mb-4 inline-block">Global Reach</div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Connect across borders</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">People from 150+ countries use WhyChat to make friends and practice languages.</p>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap justify-center gap-2 mb-3">
            {row.map((c) => (
              <span key={c.name} className="pill-premium inline-flex items-center gap-1.5 cursor-default">
                <span className="text-lg">{c.flag}</span>
                <span className="text-xs font-medium">{c.name}</span>
              </span>
            ))}
          </div>
        ))}
        <p className="text-xs text-muted-foreground mt-6">and many more...</p>
      </div>
    </section>
  );
}

function MiniRegistrationCard({ onComplete }: { onComplete: (p: UserProfile) => void }) {
  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0].name);
  const [gender, setGender] = useState<Gender>("F");
  const [langs, setLangs] = useState<string[]>(["English"]);
  const toggleLang = (l: string) => {
    setLangs((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || langs.length === 0) return;
    const profile: UserProfile = {
      id: `me_${Date.now()}`,
      name: nickname.trim(),
      nickname: nickname.trim(),
      country,
      languages: langs,
      gender,
      avatar: avatarFor(gender, nickname.trim()),
    };
    StorageService.saveProfile(profile);
    onComplete(profile);
  };
  return (
    <section id="register" className="px-6 py-24 md:py-32">
      <div className="max-w-lg mx-auto text-center mb-10">
        <div className="badge-gradient mb-4 inline-block">Join Free</div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Create your profile</h2>
        <p className="text-muted-foreground">No email, no password. Just pick a name and start connecting.</p>
      </div>
      <form onSubmit={submit} className="card-premium card-accent-top p-8 md:p-10 w-full max-w-xl mx-auto animate-in">
        <label className="block mb-5">
          <span className="tag-premium flex items-center gap-1.5 mb-2"><Users className="w-3 h-3" /> Nickname</span>
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="luna" className="input-premium" required />
        </label>
        <label className="block mb-5">
          <span className="tag-premium flex items-center gap-1.5 mb-2"><Globe2 className="w-3 h-3" /> Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="select-premium">
            {COUNTRIES.map((c) => <option key={c.name} value={c.name}>{c.flag} {c.name}</option>)}
          </select>
        </label>
        <div className="mb-5">
          <span className="tag-premium block mb-2">Gender</span>
          <div className="pill-premium inline-flex">
            {(["F", "M"] as Gender[]).map((g) => (
              <button key={g} type="button" onClick={() => setGender(g)}
                className={`pill-premium-item ${gender === g ? "active" : ""}`}>{g === "F" ? "Female" : "Male"}</button>
            ))}
          </div>
        </div>
        <div className="mb-8">
          <span className="tag-premium flex items-center gap-1.5 mb-2"><Languages className="w-3 h-3" /> Languages</span>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => {
              const active = langs.includes(l);
              return <button key={l} type="button" onClick={() => toggleLang(l)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-200 ${active ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] text-white border-transparent shadow-sm" : "bg-secondary text-foreground border-transparent hover:bg-muted"}`}>
                {active ? "✓ " : ""}{l}
              </button>;
            })}
          </div>
        </div>
        <button type="submit" className="btn-gradient w-full py-3.5 text-center text-sm">
          Enter the Hub <ArrowRight className="w-4 h-4 inline ml-1" />
        </button>
      </form>
    </section>
  );
}

function CTASection({ onGetStarted, hasSession }: { onGetStarted: () => void; hasSession: boolean }) {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-3xl mx-auto text-center card-premium card-accent-top p-12 md:p-16">
        <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-balance">
          Ready to meet the world?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-8">
          Join thousands of people already connecting on WhyChat. No signup, no download — just open your browser and start chatting.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={onGetStarted}
            className="btn-gradient px-8 py-4 text-base font-semibold inline-flex items-center gap-2 shadow-lg shadow-[#7C3AED]/25">
            {hasSession ? 'Continue to Chat' : 'Get Started Free'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#7C3AED]" />
          <span className="font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">WhyChat</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>© 2026 WhyChat</span>
          <a href="#" className="hover:text-foreground transition">Privacy</a>
          <a href="#" className="hover:text-foreground transition">Terms</a>
          <a href="#" className="hover:text-foreground transition">Contact</a>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const registerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const p = StorageService.getProfile();
    setHasSession(!!p);
    setReady(true);
  }, []);

  const goToChat = () => navigate({ to: '/chat' });

  const scrollToRegister = () => {
    if (hasSession) {
      goToChat();
      return;
    }
    setShowRegister(true);
    setTimeout(() => {
      registerRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const onRegistered = (profile: UserProfile) => {
    goToChat();
  };

  if (!ready) return <><MeshBackdrop /><div className="min-h-screen" /></>;

  return (
    <>
      <MeshBackdrop />
      <div className="min-h-screen flex flex-col">
        <LandingHero onGetStarted={scrollToRegister} hasSession={hasSession} />
        {!hasSession && (
          <>
            <FeaturesSection />
            <HowItWorksSection onGetStarted={scrollToRegister} />
            <CountriesSection />
            <section ref={registerRef}>
              <MiniRegistrationCard onComplete={onRegistered} />
            </section>
          </>
        )}
        <CTASection onGetStarted={scrollToRegister} hasSession={hasSession} />
        <LandingFooter />
      </div>
    </>
  );
}
