import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Menu, AlertCircle, Users, ChevronDown, Sparkles, X, PartyPopper } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";

export interface ActivePersona {
  id: string;
  name: string;
  headline: string;
  avatar_emoji: string;
  age: string;
  gender: string;
  best_platforms: string[];
  best_formats: string[];
  hook_angles: string[];
  pains: string[];
  desires: string[];
  triggers: string[];
  language_style: string;
  cta_style: string;
  bio: string;
  brand_kit?: { logo_data_url?: string; file_name?: string; uploaded_at?: string };
}

export interface DashboardContext {
  user: User;
  profile: Profile;
  usage: Usage;
  usageDetails: UsageDetails | null;
  refreshUsage: () => Promise<void>;
  selectedPersona: ActivePersona | null;
  setSelectedPersona: (p: ActivePersona | null) => void;
}

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string;
  preferred_market: string | null;
  preferred_language: string | null;
  onboarding_data?: unknown;
  [key: string]: unknown;
}

export interface Usage {
  analyses_count: number;
  boards_count: number;
}

export interface UsageDetails {
  plan: string;
  analyses: { used: number; limit: number; remaining: number };
  boards: { used: number; limit: number; remaining: number };
  translations: { used: number; limit: number; remaining: number };
  reset_date: string;
  is_over_limit: boolean;
  show_warning: boolean;
}

export default function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const { language } = useLanguage();
  const dt = useDashT(language);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0 });
  const [usageDetails, setUsageDetails] = useState<UsageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedPersona, setSelectedPersonaState] = useState<ActivePersona | null>(() => {
    try {
      const s = localStorage.getItem("frameiq_active_persona");
      if (!s) return null;
      const parsed = JSON.parse(s);
      // Validate essential fields exist
      if (!parsed || !parsed.id || !parsed.name) return null;
      return parsed;
    } catch { return null; }
  });
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState<ActivePersona[]>([]);
  const [vikaPopup, setVikaPopup] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState<{ title: string; body: string } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const setSelectedPersona = (p: ActivePersona | null) => {
    setSelectedPersonaState(p);
    try {
      if (p) localStorage.setItem("frameiq_active_persona", JSON.stringify(p));
      else localStorage.removeItem("frameiq_active_persona");
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  };

  const fetchUsage = async (userId: string) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from("usage").select("*").eq("user_id", userId).eq("period", currentPeriod).single();
    if (data) setUsage({ analyses_count: data.analyses_count, boards_count: data.boards_count });
    try {
      const { data: d } = await supabase.functions.invoke("check-usage", { body: { user_id: userId } });
      if (d) setUsageDetails(d);
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      if (!mounted) return;
      setUser(session.user);
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData && mounted) {
        // Test account: reset onboarding every login
        const TEST_EMAIL = "testadbrief@yopmail.com";
        if (session.user.email === TEST_EMAIL && profileData.onboarding_completed) {
          await supabase.from("profiles").update({ onboarding_completed: false, onboarding_data: null }).eq("id", session.user.id);
          profileData.onboarding_completed = false;
        }

        setProfile(profileData);

        // New user — redirect to onboarding
        if (!profileData.onboarding_completed) {
          navigate("/onboarding");
          return;
        }
      }
      await fetchUsage(session.user.id);
      // Sync subscription status from Stripe
      try {
        const { data: subData } = await supabase.functions.invoke("check-subscription");
        if (subData?.plan && profileData && subData.plan !== profileData.plan) {
          setProfile(prev => prev ? { ...prev, plan: subData.plan } : prev);
        }
      } catch {}
      // Load personas for picker
      const { data: personaData } = await supabase.from("personas").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
      const loadedPersonas = personaData
        ? (personaData
            .filter((d: Record<string, unknown>) => d.result && typeof d.result === "object")
            .map((d: Record<string, unknown>) => ({
              id: d.id as string,
              ...(d.result as object),
            })) as ActivePersona[])
        : [];
      setSavedPersonas(loadedPersonas);
      // If cached active persona was deleted, clear it
      setSelectedPersonaState(prev => {
        if (!prev) return null;
        if (!loadedPersonas.some(p => p.id === prev.id)) {
          try { localStorage.removeItem("frameiq_active_persona"); } catch {}
          return null;
        }
        return prev;
      });
      // Welcome popups for special accounts
      const WELCOME_POPUPS: Record<string, { key: string; title: string; body: string }> = {
        "victoriafnogueira@hotmail.com": {
          key: "vika_welcome_shown",
          title: "Bem-vinda, Vika! 💜",
          body: "Sua conta está ativa com acesso vitalício gratuito. Todos os recursos do AdBrief são seus — sem limites, sem cobranças, para sempre.",
        },
        "isadoradblima@gmail.com": {
          key: "isadora_welcome_shown",
          title: "hehe, acesso vitalício pra você, Isadorinha 🎊",
          body: "Sua conta agora tem acesso vitalício gratuito e ilimitado! Tudo liberado, pra sempre. Usa e abusa de todas as ferramentas — você merece! 💜✨",
        },
      };
      const popup = session.user.email ? WELCOME_POPUPS[session.user.email] : null;
      if (popup && !localStorage.getItem(popup.key)) {
        setWelcomeMsg({ title: popup.title, body: popup.body });
        setVikaPopup(true);
        localStorage.setItem(popup.key, "1");
      }
      if (mounted) setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (!session) navigate("/login"); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          <p className="text-xs text-white/20 font-mono">{dt("ov_loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <DashboardSidebar
        user={user}
        profile={profile}
        onProfileUpdate={(p) => setProfile(p as typeof profile)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="lg:hidden h-14 flex items-center px-4 border-b border-white/[0.06] bg-[#080808] sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all mr-3"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 flex-1">
            <Logo size="sm" />
          </div>
          {/* Mobile profile shortcut */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-white/10 overflow-hidden"
            style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.4),rgba(236,72,153,0.4))" }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white">{profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
          </button>
        </header>

        {/* Persona context bar — always visible */}
        <div className="sticky top-0 lg:top-0 z-20 px-4 py-2 flex items-center gap-3 border-b border-white/[0.04]"
          style={{ background: "rgba(8,8,8,0.95)", backdropFilter: "blur(12px)" }}>
          <div className="relative">
            <button
              onClick={() => setPersonaPickerOpen(!personaPickerOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={selectedPersona
                ? { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa" }
                : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
              }
            >
              <Users className="h-3.5 w-3.5" />
                <span>{selectedPersona ? `${selectedPersona.avatar_emoji} ${selectedPersona.name}` : dt("cm_no_persona")}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>

            {personaPickerOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 rounded-2xl overflow-hidden z-50 shadow-2xl"
                style={{ background: "#111114", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="px-3 py-2.5 border-b border-white/[0.06]">
                 <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono">{dt("ov_active_persona_label")}</p>
                   <p className="text-[11px] text-white/20 mt-0.5">{dt("ov_set_persona")}</p>
                 </div>
                {savedPersonas.length === 0 ? (
                  <div className="p-4 text-center">
                   <p className="text-xs text-white/30 mb-3">{dt("ov_no_personas_yet")}</p>
                     <button onClick={() => { setPersonaPickerOpen(false); navigate("/dashboard/persona"); }}
                       className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs mx-auto"
                       style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                       <Sparkles className="h-3 w-3" /> {dt("ov_create_first_persona")}
                     </button>
                  </div>
                ) : (
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {selectedPersona && (
                      <button onClick={() => { setSelectedPersona(null); setPersonaPickerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors text-xs text-white/30">
                         <span className="h-7 w-7 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(255,255,255,0.05)" }}>✕</span>
                         {dt("ov_clear_persona")}
                      </button>
                    )}
                    {savedPersonas.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPersona(p); setPersonaPickerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                        style={selectedPersona?.id === p.id ? { background: "rgba(167,139,250,0.08)" } : {}}>
                        <span className="h-7 w-7 rounded-full flex items-center justify-center text-base shrink-0" style={{ background: "rgba(167,139,250,0.1)" }}>{p.avatar_emoji}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                          <p className="text-[10px] text-white/30 truncate">{p.headline}</p>
                        </div>
                        {selectedPersona?.id === p.id && <span className="ml-auto text-[10px] text-purple-400 shrink-0">{dt("pe_active")}</span>}
                      </button>
                    ))}
                    <div className="px-3 py-2 border-t border-white/[0.06]">
                      <button onClick={() => { setPersonaPickerOpen(false); navigate("/dashboard/persona"); }}
                        className="text-[10px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> {dt("cm_manage_personas")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedPersona && (
            <div className="flex items-center gap-2 text-[10px] text-white/20 font-mono overflow-hidden">
              <span className="hidden sm:block truncate">AI targeting: {selectedPersona.age} · {selectedPersona.best_platforms.slice(0,2).join(", ")}</span>
            </div>
          )}

          {/* Close picker on outside click */}
          {personaPickerOpen && <div className="fixed inset-0 z-10" onClick={() => setPersonaPickerOpen(false)} />}
        </div>

        {/* Alerts */}
        {usageDetails?.show_warning && !usageDetails?.is_over_limit && (
          <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {dt("ov_low_quota")}
          </div>
        )}
        {usageDetails?.is_over_limit && (
          <div className="mx-4 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {dt("ov_limit_reached")}
          </div>
        )}

        <main className="flex-1 overflow-auto bg-[#050505]">
          <Outlet context={{ user, profile, usage, usageDetails, refreshUsage: () => fetchUsage(user!.id), selectedPersona, setSelectedPersona } satisfies DashboardContext} />
        </main>
      </div>

      {/* Welcome popup */}
      {vikaPopup && welcomeMsg && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVikaPopup(false)}>
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ background: "linear-gradient(135deg, #1a1025, #0d0d15)", border: "1px solid rgba(167,139,250,0.3)", animation: "modalIn 0.3s cubic-bezier(.23,1,.32,1) both" }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.9) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
              @keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity:1; } 100% { transform: translateY(60px) rotate(360deg); opacity:0; } }
              .confetti-piece { position:absolute; width:8px; height:8px; border-radius:2px; animation: confetti 1.5s ease-out forwards; }
            `}</style>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(167,139,250,0.2), transparent 70%)" }} />
            {/* Confetti */}
            {[...Array(12)].map((_, i) => (
              <div key={i} className="confetti-piece pointer-events-none"
                style={{
                  left: `${10 + Math.random() * 80}%`, top: `${5 + Math.random() * 20}%`,
                  background: ["#a78bfa","#f472b6","#fbbf24","#34d399","#60a5fa"][i % 5],
                  animationDelay: `${i * 0.1}s`, transform: `rotate(${Math.random() * 360}deg)`,
                }} />
            ))}
            <div className="relative p-8 text-center space-y-4">
              <div className="text-6xl" style={{ animation: "modalIn 0.5s cubic-bezier(.23,1,.32,1) 0.2s both" }}>🎉</div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {welcomeMsg.title}
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                {welcomeMsg.body}
              </p>
              <p className="text-xs text-white/30">
                Aproveite cada ferramenta, crie sem medo, e brilhe! ✨
              </p>
              <button onClick={() => setVikaPopup(false)}
                className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #a78bfa, #f472b6)" }}>
                <PartyPopper className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                Vamos lá!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
