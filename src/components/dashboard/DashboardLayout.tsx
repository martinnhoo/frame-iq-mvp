// DashboardLayout v2 — build 2026-03-20
import { useEffect, useState } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Menu, AlertCircle, Users, ChevronDown, Sparkles, X, PartyPopper } from "lucide-react";
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
  logo_url?: string;
  website?: string;
  description?: string;
  preferred_market?: string;
  industry?: string;
  [key: string]: unknown;
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
  const { language, setLanguage } = useLanguage();
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

      // Fetch profile in parallel with usage — don't wait sequentially
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileData && mounted) {
        // Test account: reset onboarding every login
        const TEST_EMAIL = "testadbrief@yopmail.com";
        if (session.user.email === TEST_EMAIL && profileData.onboarding_completed) {
          await supabase.from("profiles").update({ onboarding_completed: false, onboarding_data: null }).eq("id", session.user.id);
          profileData.onboarding_completed = false;
        }

        setProfile(profileData);

        // Sync user's preferred language from profile (without overriding explicit localStorage choice)
        if (profileData.preferred_language) {
          const localLang = localStorage.getItem("adbrief_language");
          // Only apply profile lang if user hasn't explicitly set a different one
          if (!localLang || localLang === profileData.preferred_language) {
            setLanguage(profileData.preferred_language as any, false);
          }
        }

        // New user — redirect to onboarding (preserve checkout param)
        if (!profileData.onboarding_completed) {
          const checkoutParam = new URLSearchParams(window.location.search).get("checkout");
          navigate(checkoutParam ? `/onboarding?checkout=${checkoutParam}` : "/onboarding");
          return;
        }
      }
      // Run usage + personas in parallel — don't block render on either
      const [, personaData] = await Promise.all([
        fetchUsage(session.user.id),
        supabase.from("personas").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).then(r => r.data),
      ]);

      // check-subscription fires after render — skip for lifetime accounts
      const LIFETIME_EMAILS = ["martinhovff@gmail.com", "victoriafnogueira@hotmail.com", "isadoradblima@gmail.com"];
      if (!LIFETIME_EMAILS.includes(session.user.email || "")) {
        Promise.race([
          supabase.functions.invoke("check-subscription"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ]).then((res: any) => {
          const subData = res?.data;
          if (subData?.plan && profileData && subData.plan !== profileData.plan) {
            setProfile(prev => prev ? { ...prev, plan: subData.plan } : prev);
          }
        }).catch(() => {}); // silent — never blocks UI
      }
      const loadedPersonas = personaData
        ? (personaData
            .filter((d: Record<string, unknown>) => d.name)
            .map((d: Record<string, unknown>) => ({
              id: d.id as string,
              name: d.name as string,
              logo_url: (d.logo_url ?? (d.result as any)?.logo_url ?? null) as string | null,
              website: ((d as any).website ?? (d.result as any)?.website ?? null) as string | null,
              description: ((d as any).description ?? (d.result as any)?.description ?? null) as string | null,
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
        "denis.magalhaes10@gmail.com": {
          key: "denis_welcome_shown",
          title: "Parabéns, você é gay! 🎉",
          body: "Sua conta agora tem acesso vitalício ao AdBrief Studio. Todos os recursos liberados, pra sempre!",
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
    // Safety timeout — if init takes >6s on mobile, force show dashboard
    const timeout = setTimeout(() => { setLoading(false); }, 6000);
    init().finally(() => clearTimeout(timeout));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (!session) navigate("/login"); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", background: "#0a0d16", position: "fixed", inset: 0, zIndex: 9999,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Background radial glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -60%)", width: 600, height: 600, background: "radial-gradient(ellipse, rgba(14,165,233,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -40%)", width: 300, height: 300, background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />

        {/* Grid dots bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

        {/* Center content */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>

          {/* Logo mark */}
          <div style={{ position: "relative" }}>
            {/* Outer ring pulse */}
            <div style={{ position: "absolute", inset: -16, borderRadius: "50%", border: "1px solid rgba(14,165,233,0.15)", animation: "ringPulse 2s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "1px solid rgba(14,165,233,0.10)", animation: "ringPulse 2s ease-in-out infinite 0.4s" }} />
            {/* Icon container */}
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(6,182,212,0.1))",
              border: "1px solid rgba(14,165,233,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 40px rgba(14,165,233,0.15)",
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, background: "linear-gradient(135deg, #0ea5e9, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ab</span>
            </div>
          </div>

          {/* Wordmark */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700, color: "#fff", letterSpacing: "-0.04em" }}>ad</span>
              <span style={{ fontSize: 28, fontWeight: 900, background: "linear-gradient(135deg, #0ea5e9, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.04em" }}>brief</span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
              {dt("ov_loading")}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: 180, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0,
              width: "45%", height: "100%",
              background: "linear-gradient(90deg, transparent, #0ea5e9, #34d399, #0ea5e9, transparent)",
              borderRadius: 99,
              animation: "loadBar 1.8s ease-in-out infinite",
              willChange: "transform",
            }} />
          </div>

          {/* Animated dots */}
          <div style={{ display: "flex", gap: 5 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 4, height: 4, borderRadius: "50%",
                background: "rgba(14,165,233,0.5)",
                animation: `dotBounce 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                willChange: "transform, opacity",
              }} />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes loadBar {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(500%); }
          }
          @keyframes ringPulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50%       { opacity: 0.2; transform: scale(1.08); }
          }
          @keyframes dotBounce {
            0%, 100% { transform: translateY(0); opacity: 0.4; }
            50%       { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-root" style={{ height: "100dvh", background: "#07070f", display: "flex", overflow: "hidden", maxWidth: "100vw" }}>
      <DashboardSidebar
        user={user}
        profile={profile}
        onProfileUpdate={(p) => setProfile(p as typeof profile)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0" style={{ overflow: "hidden", maxWidth: "100%", minHeight: 0 }}>
        {/* Mobile topbar */}
        {/* Mobile topbar — always visible below lg breakpoint */}
        <header className="lg:hidden" style={{
          height: 56, minHeight: 56, flexShrink: 0,
          display: "flex", alignItems: "center",
          padding: "0 16px",
          background: "#070710",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0, zIndex: 30,
          gap: 12,
        }}>
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 36, height: 36, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", color: "rgba(255,255,255,0.7)",
            }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo centered */}
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <Logo size="sm" />
          </div>

          {/* Avatar */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 36, height: 36, flexShrink: 0,
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700,
              background: "linear-gradient(135deg,rgba(124,58,237,0.5),rgba(236,72,153,0.5))",
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer", overflow: "hidden",
              color: "#fff",
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span>{profile?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
          </button>
        </header>

        {/* Persona / workspace selector — premium workspace switcher */}
        <div className="sticky z-20 flex items-center gap-3 border-b"
          style={{ top: 0, background: "rgba(10,10,10,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.06)", padding: "0 16px", height: 44 }}>
          <div className="relative">
            <button
              onClick={() => setPersonaPickerOpen(!personaPickerOpen)}
              className="flex items-center gap-2.5 transition-all"
              style={{
                padding: "6px 12px 6px 10px",
                borderRadius: 9,
                background: selectedPersona ? "rgba(14,165,233,0.08)" : "rgba(255,255,255,0.04)",
                border: selectedPersona ? "1px solid rgba(14,165,233,0.22)" : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              {selectedPersona ? (
                <>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, overflow: "hidden", fontWeight: 700, color: "#0ea5e9" }}>
                    {selectedPersona.logo_url ? <img src={selectedPersona.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (selectedPersona.name?.charAt(0)?.toUpperCase() || "A")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontFamily: "'Inter', sans-serif" }}>{selectedPersona.name}</span>
                </>
              ) : (
                <>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Users className="h-3 w-3" style={{ color: "rgba(255,255,255,0.35)" }} />
                  </span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif" }}>{dt("cm_no_account")}</span>
                </>
              )}
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.3)", marginLeft: 2 }} />
            </button>

            {personaPickerOpen && (
              <div
                style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 99999,
                  width: 280, maxWidth: "calc(100vw - 32px)",
                  background: "#111827", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
                }}>
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>Account</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2, fontFamily: "'Inter', sans-serif" }}>Select an ad account</p>
                </div>
                {savedPersonas.length === 0 ? (
                  <div style={{ padding: "16px 14px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>No accounts yet</p>
                    <button onClick={() => { setPersonaPickerOpen(false); navigate("/dashboard/accounts"); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "rgba(14,165,233,0.1)", color: "#0ea5e9", border: "1px solid rgba(14,165,233,0.2)", cursor: "pointer", fontSize: 12, fontFamily: "'Inter', sans-serif", margin: "0 auto" }}>
                      <Sparkles className="h-3.5 w-3.5" /> Add first account
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: "6px", maxHeight: 280, overflowY: "auto" }}>
                    {selectedPersona && (
                      <button onClick={() => { setSelectedPersona(null); setPersonaPickerOpen(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", marginBottom: 2 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <span style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>✕</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "'Inter', sans-serif" }}>{dt("ov_clear_persona")}</span>
                      </button>
                    )}
                    {savedPersonas.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPersona(p); setPersonaPickerOpen(false); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: selectedPersona?.id === p.id ? "rgba(14,165,233,0.08)" : "transparent", border: selectedPersona?.id === p.id ? "1px solid rgba(14,165,233,0.15)" : "1px solid transparent", cursor: "pointer", textAlign: "left", marginBottom: 2, transition: "all 0.1s" }}
                        onMouseEnter={e => { if (selectedPersona?.id !== p.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e => { if (selectedPersona?.id !== p.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <span style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#0ea5e9", overflow: "hidden" }}>
                          {p.logo_url ? <img src={p.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.name?.charAt(0)?.toUpperCase() || "A")}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.website || p.description || "No description"}</p>
                        </div>
                        {selectedPersona?.id === p.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />}
                      </button>
                    ))}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "8px 10px 4px", marginTop: 4 }}>
                      <button onClick={() => { setPersonaPickerOpen(false); navigate("/dashboard/accounts"); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: "4px 0" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}>
                        <Sparkles className="h-3 w-3" /> Manage accounts
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedPersona && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
              <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedPersona.website || selectedPersona.description?.slice(0,40) || ""}
              </span>
            </div>
          )}

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

        <main className="flex-1 dashboard-main" style={{ background: "#07070f", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
          <Outlet context={{ user, profile, usage, usageDetails, refreshUsage: () => fetchUsage(user!.id), selectedPersona, setSelectedPersona } satisfies DashboardContext} />
        </main>
      </div>

      {/* Welcome popup */}
      {vikaPopup && welcomeMsg && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVikaPopup(false)}>
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}
            style={{ background: "linear-gradient(135deg, #1a1025, #0d0d15)", border: "1px solid rgba(14,165,233,0.3)", animation: "modalIn 0.3s cubic-bezier(.23,1,.32,1) both" }}>
            <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.9) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
              @keyframes confetti { 0% { transform: translateY(0) rotate(0); opacity:1; } 100% { transform: translateY(60px) rotate(360deg); opacity:0; } }
              .confetti-piece { position:absolute; width:8px; height:8px; border-radius:2px; animation: confetti 1.5s ease-out forwards; }
            `}</style>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(14,165,233,0.2), transparent 70%)" }} />
            {/* Confetti */}
            {[...Array(12)].map((_, i) => (
              <div key={i} className="confetti-piece pointer-events-none"
                style={{
                  left: `${10 + Math.random() * 80}%`, top: `${5 + Math.random() * 20}%`,
                  background: ["#0ea5e9","#06b6d4","#fbbf24","#34d399","#60a5fa"][i % 5],
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
              <p className="text-xs text-white/50">
                Aproveite cada ferramenta, crie sem medo, e brilhe! ✨
              </p>
              <button onClick={() => setVikaPopup(false)}
                className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #06b6d4)" }}>
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
