import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Sparkles, Globe2, Shield, Users, ArrowRight, Languages, Compass, ArrowLeft } from "lucide-react";
import { MeshBackdrop } from "@/components/MeshBackdrop";
import { StorageService } from "@/services/storage";
import { COUNTRIES, LANGUAGES, flagFor, avatarFor, type Gender, type UserProfile } from "@/lib/peerStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MetWithStrangers — Chat with Strangers Worldwide | Free Random Chat | No Signup" },
      { name: "description", content: "MetWithStrangers is the best free online chat platform to chat with strangers from 150+ countries. Random chat, language exchange, make friends online, and meet new people. Supports English, Hindi, Tamil, Malayalam, Telugu, Kannada, Bengali, Spanish, Japanese, Arabic & more. Real-time messaging, no signup, 100% private." },
      { name: "keywords", content: "chat with strangers, random chat, free online chat, talk to strangers, stranger chat, online chat rooms, free chat app, meet new people online, make friends online, language exchange, anonymous chat, text chat, international chat, global chat, india chat, hindi chat, tamil chat, malayalam chat, telugu chat, kannada chat, bengali chat, spanish chat, japanese chat, arabic chat, why chat, why chat app, free messaging app, no signup chat, private chat, random video chat, online friends, chat platform, instant messaging, free text chat, chat website, omegle alternative, chat rooms free" },
      { name: "robots", content: "index, follow" },
      { name: "googlebot", content: "index, follow" },
      { property: "og:title", content: "MetWithStrangers — Connect with Strangers Worldwide | Free & Private" },
      { property: "og:description", content: "Chat with strangers from 150+ countries for free. Random chat, language exchange, make friends online. No signup, 100% private. Supports English, Hindi, Tamil, Malayalam & more." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://whychat.pages.dev" },
      { property: "og:site_name", content: "MetWithStrangers" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MetWithStrangers — Connect with Strangers Worldwide" },
      { name: "twitter:description", content: "Chat with strangers worldwide for free. Random chat, make friends online, language exchange. No signup. Supports 26+ languages including Hindi, Tamil & Malayalam." },
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
          name: "MetWithStrangers",
          url: "https://whychat.pages.dev",
          description: "Chat with strangers online for free. Random chat platform to meet new people, make friends, practice languages, and discover cultures. Supports 26+ languages including Hindi, Tamil, Malayalam, Telugu, Bengali with no signup required.",
          applicationCategory: "SocialNetworking",
          operatingSystem: "All",
          browserRequirements: "Requires JavaScript",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: { "@type": "Organization", name: "MetWithStrangers" },
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
          MetWithStrangers is the best free online chat platform to <strong>chat with strangers</strong> from over 150 countries.
          <strong>Random chat</strong> instantly, <strong>make friends online</strong>, practice languages,
          and explore cultures — all from your browser, no signup needed.
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
        <p className="text-xs text-muted-foreground mb-16">No signup, no download, no data stored. Just pick a name and start chatting with strangers instantly. The best Omegle alternative for free random chat.</p>

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
    { icon: Compass, title: "Random Chat & Instant Matching", desc: "Chat with strangers instantly in our free random chat. Discover people nearby and worldwide in real-time. Filter by gender, country, and language to find your perfect conversation partner. The best way to talk to strangers online." },
    { icon: Languages, title: "Language Exchange Practice", desc: "Practice English, Spanish, Mandarin, Japanese, Hindi, Tamil, Malayalam, and 20+ languages with native speakers. Perfect your fluency through real conversations. Free language exchange with strangers from around the world." },
    { icon: Globe2, title: "Global Community", desc: "Connect with people from the United States, Japan, Brazil, Germany, India, Korea, and 150+ countries. Make friends online across borders. Explore cultures without leaving home through international chat." },
    { icon: Shield, title: "Private & Secure Anonymous Chat", desc: "Your data stays on your device. No accounts, no emails, no tracking. Chat anonymously with strangers — 100% private and secure. The safest way to meet new people online." },
  ];
  return (
    <section id="features" className="px-6 py-24 md:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="badge-gradient mb-4 inline-block">Features</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Everything you need to connect</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">MetWithStrangers makes it easy to meet new people from anywhere in the world, instantly.</p>
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
    { step: "01", title: "Create Your Profile", desc: "Pick a nickname, your country, and languages you speak. No email, no password — just you. Ready to chat with strangers in seconds." },
    { step: "02", title: "Discover People", desc: "Browse live profiles filtered by gender, country, or language. See who's online right now and start a random chat instantly." },
    { step: "03", title: "Start Chatting", desc: "Message strangers instantly, make friends online, practice languages. Free random chat with people from 150+ countries." },
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
          <p className="text-muted-foreground max-w-xl mx-auto mb-10">People from 150+ countries use MetWithStrangers to chat with strangers, make friends online, practice languages, and explore new cultures through free random chat. Join the global community today.</p>
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
          Join thousands of people already chatting with strangers on MetWithStrangers. The best free random chat and online chat platform. No signup, no download — just open your browser and start talking to strangers instantly. Make friends online, practice languages, and explore the world.
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

function SEOSection() {
  const faqs = [
    { q: "What is MetWithStrangers?", a: "MetWithStrangers is a free online chat platform to chat with strangers from 150+ countries. It offers random chat, language exchange, and the ability to make friends online without any signup or download." },
    { q: "Is MetWithStrangers free?", a: "Yes, MetWithStrangers is 100% free. No hidden charges, no premium plans. You can chat with strangers online, make friends, and practice languages completely free." },
    { q: "How to chat with strangers online?", a: "Simply pick a nickname, select your country and languages, and start browsing people online. Click Message to begin a random chat instantly. No email or phone number needed." },
    { q: "What languages are supported?", a: "MetWithStrangers supports 26+ languages including English, Hindi, Tamil, Malayalam, Telugu, Kannada, Bengali, Spanish, French, Japanese, Mandarin, Arabic, Portuguese, German, Korean, and more." },
    { q: "Is MetWithStrangers safe for anonymous chat?", a: "Yes. We never store your data on our servers. Your profile stays on your device. No accounts, no tracking, no chat logs. The safest way to talk to strangers online." },
    { q: "Can I use MetWithStrangers on mobile?", a: "MetWithStrangers works on any device with a browser — phone, tablet, or desktop. No app download needed. Instant chat with strangers from anywhere." },
    { q: "MetWithStrangers vs Omegle alternatives?", a: "MetWithStrangers is the best Omegle alternative for free random chat with strangers. Unlike Omegle, we offer language filters, country filters, gender filters, and a global community of real people." },
  ];
  return (
    <section className="px-6 py-24 md:py-32 bg-gradient-to-b from-transparent via-[#7C3AED]/5 to-transparent">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="badge-gradient mb-4 inline-block">FAQs</div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Everything about chat with strangers</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">MetWithStrangers is the best free random chat platform to meet new people online, make friends, and practice languages.</p>
        </div>
        <div className="space-y-4">
          {faqs.map((f) => (
            <details key={f.q} className="card-premium p-5 md:p-6 group open:ring-1 open:ring-[#7C3AED]/20">
              <summary className="font-semibold text-sm md:text-base cursor-pointer list-none flex items-center justify-between gap-4">
                <span>{f.q}</span>
                <span className="text-[#7C3AED] text-lg transition-transform duration-200 group-open:rotate-180">▾</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
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
          <span className="font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">MetWithStrangers</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span>© 2026 MetWithStrangers — Chat with Strangers Worldwide</span>
          <a href="#" className="hover:text-foreground transition">Privacy</a>
          <a href="#" className="hover:text-foreground transition">Terms</a>
          <a href="#" className="hover:text-foreground transition">Contact</a>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60 mt-3 max-w-2xl mx-auto text-center">
          <span>chat with strangers</span> <span>·</span>
          <span>random chat</span> <span>·</span>
          <span>free online chat</span> <span>·</span>
          <span>talk to strangers</span> <span>·</span>
          <span>make friends online</span> <span>·</span>
          <span>language exchange</span> <span>·</span>
          <span>anonymous chat</span> <span>·</span>
          <span>meet new people online</span> <span>·</span>
          <span>india chat</span> <span>·</span>
          <span>hindi chat</span> <span>·</span>
          <span>tamil chat</span> <span>·</span>
          <span>omegle alternative</span>
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
        <SEOSection />
        <CTASection onGetStarted={scrollToRegister} hasSession={hasSession} />
        <LandingFooter />
      </div>
    </>
  );
}
