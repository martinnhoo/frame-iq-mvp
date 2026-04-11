// DashboardLayout v3 — build 2026-04-10 — motion primitives
import { useEffect, useState } from "react";
import { storage } from "@/lib/storage";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SectionBoundary } from "@/components/SectionBoundary";
import { DashboardSidebar } from "./DashboardSidebar";
// ReferralPopup now lives inside DashboardSidebar footer
import { supabase } from "@/integrations/supabase/client";
import { Menu, Users, ChevronDown, Sparkles, PartyPopper } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { User } from "@supabase/supabase-js";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashT } from "@/i18n/dashboardTranslations";
import { UserProfilePanel } from "@/components/dashboard/UserProfilePanel";
import { identifyUser } from "@/lib/posthog";


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
  aiProfile: { industry?: string | null; pain_point?: string | null; avg_hook_score?: number | null; creative_style?: string | null } | null;
  lang: string;
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

export interface CreditInfo {
  total: number;
  used: number;
  bonus: number;
  remaining: number;
  pool: number;
}

export interface UsageDetails {
  plan: string;
  credits: CreditInfo;
  usage_pct: number;
  breakdown: Record<string, { count: number; credits: number }>;
  credit_costs: Record<string, number>;
  ad_accounts: number;
  reset_date: string;
  period: string;
  is_over_limit: boolean;
  show_warning: boolean;
  is_trialing: boolean;
  // Legacy compat (old format — will be removed once all consumers migrate)
  analyses?: { used: number; limit: number; remaining: number };
  boards?: { used: number; limit: number; remaining: number };
  translations?: { used: number; limit: number; remaining: number };
}

export default function DashboardLayout() {
  const [user, setUser] = useState<User | null>(null);
  const { language, setLanguage } = useLanguage();
  const dt = useDashT(language);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0 });
  const [usageDetails, setUsageDetails] = useState<UsageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [aiProfile, setAiProfile] = useState<{ industry?: string | null; pain_point?: string | null; avg_hook_score?: number | null; creative_style?: string | null } | null>(null);
  const [telegramConn, setTelegramConn] = useState<any>(null);
  const [telegramPairingLink, setTelegramPairingLink] = useState<string|null>(null);
  const [telegramLinkLoading, setTelegramLinkLoading] = useState(false);
  const [selectedPersona, setSelectedPersonaState] = useState<ActivePersona | null>(() => {
    try {
      const s = storage.get("frameiq_active_persona");
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
  // bannerDismissed removed — limit notifications via email now
  const navigate = useNavigate();
  const location = useLocation();
  // checkout success detection uses window.location directly (inside init callback)

  const setSelectedPersona = (p: ActivePersona | null) => {
    setSelectedPersonaState(p);
    try {
      if (p) storage.setJSON("frameiq_active_persona", p);
      else storage.remove("frameiq_active_persona");
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.)
    }
  };

  const fetchUsage = async (userId: string) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from("usage").select("*").eq("user_id", userId).eq("period", currentPeriod).maybeSingle();
    if (data) setUsage({ analyses_count: data.analyses_count, boards_count: data.boards_count });
    try {
      const { data: d } = await supabase.functions.invoke("check-usage", { body: { user_id: userId } });
      if (d) setUsageDetails(d);
    } catch (e) { console.error("[AdBrief]", e); }
  };

  // ── Close sidebar on mobile route change ──────────────────────────────────
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // Try to get existing session — autoRefreshToken handles JWT renewal automatically
      let { data: { session } } = await supabase.auth.getSession();

      // If no session in memory, try refreshing from stored refresh token
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        session = refreshData.session;
      }

      if (!session) { navigate("/login"); return; }
      if (!mounted) return;
      setUser(session.user);
      identifyUser(session.user.id, { email: session.user.email });

      // Fetch profile in parallel with usage — don't wait sequentially
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      // Load telegram connection status
      (supabase as any).from("telegram_connections").select("chat_id,telegram_username,active")
        .eq("user_id", session.user.id).eq("active", true).maybeSingle()
        .then(({ data }: any) => { if (mounted) setTelegramConn(data || null); });
      // Load ai_profile for tool pre-fill — select only base columns that always exist
      // pain_point/avg_hook_score/creative_style may not exist yet if migration hasn't run
      (supabase as any).from("user_ai_profile")
        .select("industry, ai_summary, top_performing_models, best_platforms")
        .eq("user_id", session.user.id).maybeSingle()
        .then(({ data, error }: any) => { if (mounted && !error) setAiProfile(data || null); });
      if (profileData && mounted) {
        // Test account: reset onboarding every login — BUT skip if arriving from demo flow
        const TEST_EMAIL = "testadbrief@yopmail.com";
        const currentParams = new URLSearchParams(window.location.search);
        const isFromDemo = currentParams.get("from_demo") === "1";
        if (session.user.email === TEST_EMAIL && profileData.onboarding_completed && !isFromDemo) {
          await supabase.from("profiles").update({ onboarding_completed: false, onboarding_data: null }).eq("id", session.user.id);
          profileData.onboarding_completed = false;
        }

        setProfile(profileData);

        // Sync user's preferred language from profile (without overriding explicit localStorage choice)
        if (profileData.preferred_language) {
          const localLang = storage.get("adbrief_language");
          // Only apply profile lang if user hasn't explicitly set a different one
          if (!localLang || localLang === profileData.preferred_language) {
            setLanguage(profileData.preferred_language as any, false);
          }
        }

        // New user — redirect to onboarding (preserve redirect + checkout params)
        if (!profileData.onboarding_completed) {
          const dashParams = new URLSearchParams(window.location.search);
          const checkoutParam = dashParams.get("checkout");
          // Preserve full current path+search so onboarding can redirect back here after completion
          const currentFullPath = window.location.pathname + window.location.search;
          const onboardingParams = new URLSearchParams();
          if (checkoutParam) onboardingParams.set("checkout", checkoutParam);
          // If we're on a dashboard page with params (e.g. /dashboard/ai?from_demo=1), preserve as redirect
          if (currentFullPath !== "/dashboard" && currentFullPath !== "/dashboard/") {
            onboardingParams.set("redirect", currentFullPath);
          }
          const qs = onboardingParams.toString();
          navigate(qs ? `/onboarding?${qs}` : "/onboarding");
          return;
        }
      }
      // Run usage + personas in parallel — don't block render on either
      const [, personaData] = await Promise.all([
        fetchUsage(session.user.id),
        supabase.from("personas").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).then(r => r.data),
      ]);

      // check-subscription fires after render — sync plan from Stripe
      Promise.race([
        supabase.functions.invoke("check-subscription"),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]).then((res: any) => {
        const subData = res?.data;
        if (subData?.plan && profileData && subData.plan !== profileData.plan) {
          setProfile(prev => prev ? { ...prev, plan: subData.plan } : prev);
        }
      }).catch(() => {}); // silent — never blocks UI
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
      // Auto-select persona: if none selected but personas exist, pick the first one
      setSelectedPersonaState(prev => {
        if (!prev && loadedPersonas.length > 0) {
          const first = loadedPersonas[0];
          try { storage.setJSON("frameiq_active_persona", first); } catch {}
          return first;
        }
        if (!prev) return null;
        if (!loadedPersonas.some(p => p.id === prev.id)) {
          // Cached persona was deleted — fallback to first available or null
          if (loadedPersonas.length > 0) {
            try { storage.setJSON("frameiq_active_persona", loadedPersonas[0]); } catch {}
            return loadedPersonas[0];
          }
          try { storage.remove("frameiq_active_persona"); } catch (e) { console.error("[AdBrief]", e); }
          return null;
        }
        return prev;
      });
      // Welcome popups for special accounts
      const WELCOME_POPUPS: Record<string, { key: string; title: string; body: string }> = {
        "victoriafnogueira@hotmail.com": {
          key: "vika_welcome_shown",
          title: "Bem-vinda, Vika! ",
          body: "Sua conta está ativa com acesso vitalício gratuito. Todos os recursos do AdBrief são seus — sem limites, sem cobranças, para sempre.",
        },
        "isadoradblima@gmail.com": {
          key: "isadora_welcome_shown",
          title: "hehe, acesso vitalício pra você, Isadorinha ",
          body: "Sua conta agora tem acesso vitalício gratuito e ilimitado! Tudo liberado, pra sempre. Usa e abusa de todas as ferramentas — você merece! ",
        },
        "denis.magalhaes10@gmail.com": {
          key: "denis_welcome_shown",
          title: "Parabéns, você é gay! ",
          body: "Sua conta agora tem acesso vitalício ao AdBrief Studio. Todos os recursos liberados, pra sempre!",
        },
      };
      const popup = session.user.email ? WELCOME_POPUPS[session.user.email] : null;
      if (popup && !storage.get(popup.key)) {
        setWelcomeMsg({ title: popup.title, body: popup.body });
        setVikaPopup(true);
        storage.set(popup.key, "1");
      }
      // Checkout success — show toast once and clean the URL param
      const checkoutResult = new URLSearchParams(window.location.search).get("checkout");
      if (checkoutResult === "success") {
        const planName = profileData?.plan
          ? (profileData.plan || "").charAt(0).toUpperCase() + (profileData.plan || "").slice(1)
          : "";
        const lang = profileData?.preferred_language || storage.get("adbrief_language") || "pt";
        const msg = lang === "es"
          ? `¡Plan ${planName} activado! 3 días gratis — sin cargo hasta el día 4.`
          : lang === "en"
          ? `${planName} plan activated! 3 days free — no charge until day 4.`
          : `Plano ${planName} ativado! 3 dias grátis — sem cobrança até o 4º dia.`;
        // Remove param from URL without reload
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", url.toString());
        setTimeout(() => toast.success(msg, { duration: 6000 }), 800);
      }
      if (mounted) setLoading(false);
    };
    // Safety timeout — if init takes >6s on mobile, force show dashboard
    const timeout = setTimeout(() => { setLoading(false); }, 6000);
    init().finally(() => clearTimeout(timeout));
    // Handle auth state changes — keep session alive, redirect only on explicit sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { navigate("/login"); return; }
      // On token refresh, update user object silently
      if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh", background: "var(--bg-main)", position: "fixed", inset: 0, zIndex: 9999,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Background radial glow — centered */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 700, height: 700, background: "radial-gradient(ellipse, rgba(14,165,233,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 350, height: 350, background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />

        {/* Center content */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>

          {/* Wordmark only — no icon */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 0 }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: "#eef0f6", letterSpacing: "-0.04em", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>ad</span>
              <span style={{ fontSize: 36, fontWeight: 900, background: "linear-gradient(135deg, #38bdf8, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.04em", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>brief</span>
            </div>
            <p style={{ fontSize: 12, color: "rgba(238,240,246,0.30)", letterSpacing: "0.16em", textTransform: "uppercase", margin: 0, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              {dt("ov_loading")}
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: 180, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0,
              width: "45%", height: "100%",
              background: "linear-gradient(90deg, transparent, #38bdf8, #34d399, #38bdf8, transparent)",
              borderRadius: 99,
              animation: "loadBar 1.8s ease-in-out infinite",
              willChange: "transform",
            }} />
          </div>
        </div>

        <style>{`
        @keyframes tgFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes tgSlideUp { from { opacity:0; transform:translateY(16px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
      `}</style>
      <style>{`
          @keyframes loadBar {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(500%); }
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
    <>
    <style>{`
      /* ── Dashboard Mobile — iPhone 13 (390px) ── */
      /* ─── Mobile-first — iPhone SE (375) → iPhone 16 Pro Max (430) → tablet (768) ─── */
      
      /* Safe area para notch/Dynamic Island */
      .dashboard-root {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
      
      @media (max-width: 768px) {
        /* Base: sem overflow horizontal */
        .dashboard-root, .dashboard-root * { box-sizing: border-box; }
        .dashboard-root { overflow-x: hidden !important; }
        .dashboard-main { overflow-x: hidden !important; min-height: 0; }
        .dashboard-main > * { max-width: 100vw !important; overflow-x: hidden !important; }

        /* Topbar: compacto e limpo */
        .dash-topbar {
          padding-left: 12px !important;
          padding-right: 12px !important;
          gap: 8px !important;
          height: 52px !important;
          /* Glassmorphism mais forte no mobile */
          background: rgba(9,13,24,0.95) !important;
          backdrop-filter: blur(20px) !important;
        }

        /* Tool pages — padding responsivo com clamp */
        .tool-page-wrap {
          padding: clamp(14px, 4vw, 20px) clamp(14px, 4vw, 20px) 80px !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
        }

        /* Todos elementos com min-width grande: auto */
        .dashboard-main * { min-width: 0; }

        /* Cards: sem overflow */
        .dashboard-main [class*="card"], .dashboard-main [class*="Card"] {
          overflow: hidden;
          word-break: break-word;
        }

        /* KPI cards: 2 por linha */
        .lp-kpi { min-width: calc(50% - 6px) !important; flex: 1 1 calc(50% - 6px) !important; }
        .lp-kpis-row { flex-wrap: wrap !important; gap: 6px !important; }

        /* LivePanel bar: chips menores */
        .lp-bar { padding: 0 12px !important; height: 40px !important; }
        .lp-chip { font-size: 11px !important; padding: 4px 8px !important; }

        /* Grids: coluna única */
        .dash-grid-2, .dash-grid-3, .dash-grid-4 { grid-template-columns: 1fr !important; }

        /* Tipografia responsiva */
        .dashboard-main h1 { font-size: clamp(20px, 5.5vw, 28px) !important; }
        .dashboard-main h2 { font-size: clamp(17px, 4.5vw, 22px) !important; }
        .dashboard-main h3 { font-size: clamp(15px, 4vw, 18px) !important; }

        /* Tables: scroll horizontal */
        .table-wrap { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }

        /* Modal: full width */
        .dash-modal {
          width: calc(100vw - 24px) !important;
          max-width: calc(100vw - 24px) !important;
          padding: 20px 16px !important;
          border-radius: 20px !important;
        }

        /* iOS: evitar zoom no input (font >= 16px) */
        .dashboard-main input,
        .dashboard-main textarea,
        .dashboard-main select,
        .chat-textarea { font-size: 16px !important; }

        /* Scrollbar oculta no mobile */
        .suggestions-bar {
          overflow-x: auto !important;
          flex-wrap: nowrap !important;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .suggestions-bar::-webkit-scrollbar { display: none; }

        /* Chat: mensagens mais largas */
        .msg-wrap-inner { padding: 0 16px !important; }
        
        /* Hook items: padding menor */
        .hook-item { padding: 10px 0 !important; }

        /* Botões: tap target mínimo 44px (Apple HIG) */
        .dashboard-main button { min-height: 36px; }
        
        /* Scrollbar global oculta */
        .dashboard-main { scrollbar-width: none; }
        .dashboard-main::-webkit-scrollbar { display: none; }

        /* Content area: full width on mobile, no squeeze */
        .dashboard-content-area {
          width: 100vw !important;
          max-width: 100vw !important;
          flex: 1 !important;
        }

        /* Ferramentas: output cards responsivos */
        .tool-output-card { overflow-x: hidden !important; word-break: break-word !important; }
        
        /* Botões de ação: touch target mínimo */
        .tool-action-btn { min-height: 44px !important; }

        /* Mobile sidebar: posição fixa — não empurra o conteúdo principal */
        .sidebar-layout-slot {
          position: fixed !important;
          top: 0 !important; left: 0 !important; height: 100% !important;
          z-index: 50 !important;
          /* Override inline width/minWidth — sidebar should never push content on mobile */
          width: 216px !important;
          min-width: 0 !important;
          flex-shrink: 0 !important;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1) !important;
        }
        .sidebar-layout-slot.sidebar-mobile-closed {
          transform: translateX(-100%) !important;
          pointer-events: none !important;
        }
        .sidebar-layout-slot.sidebar-mobile-open {
          transform: translateX(0) !important;
          pointer-events: auto !important;
        }
      }
      
      /* Desktop: sidebar no fluxo normal — inline styles control width */
      @media (min-width: 769px) {
        .sidebar-layout-slot {
          position: relative !important;
          transform: none !important;
          pointer-events: auto !important;
        }
        .sidebar-layout-slot.sidebar-mobile-closed,
        .sidebar-layout-slot.sidebar-mobile-open {
          transform: none !important;
          pointer-events: auto !important;
        }
        .sidebar-overlay { display: none !important; }
        .dashboard-content-area {
          width: auto !important;
          max-width: none !important;
        }
      }
      
      /* Dropdowns e calendários: sempre visíveis, nunca cortados pelo overflow */
      .dashboard-main { overflow-x: hidden !important; overflow-y: auto !important; }
      /* Elementos absolutos dentro do dashboard não devem ser cortados */
      .lp [style*="position: absolute"],
      .lp [style*="position:absolute"],
      .perf-page [style*="position: absolute"],
      .perf-page [style*="position:absolute"] {
        z-index: 300 !important;
      }

      @media (max-width: 480px) {
        /* iPhone SE e menores */
        .tool-page-wrap { padding: 12px 12px !important; }
        .lp-kpi { min-width: calc(50% - 4px) !important; }
        .dashboard-main h1 { font-size: clamp(18px, 5.5vw, 22px) !important; }
        .dash-topbar { padding-left: 10px !important; padding-right: 10px !important; }
        .chat-input-wrap { padding: 8px 12px 8px !important; }
      }
      
      @media (max-width: 390px) {
        .tool-page-wrap { padding: 10px !important; }
      }
    `}</style>
    <div className="dashboard-root" style={{ height: "100dvh", background: "var(--bg-main)", display: "flex", overflow: "hidden", maxWidth: "100vw" }}>
      {/* Mobile overlay — tap to close */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          />
        )}
      </AnimatePresence>
      <div style={{
        // Desktop: ocupa espaço no fluxo. Mobile: position:fixed via CSS (não empurra conteúdo)
        width: sidebarOpen ? 216 : 0,
        minWidth: sidebarOpen ? 216 : 0,
        height: "100%",
        flexShrink: 0,
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1), transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
        position: "relative",
        zIndex: 50,
      }}
      className={`sidebar-layout-slot ${sidebarOpen ? "sidebar-mobile-open" : "sidebar-mobile-closed"}`}>
        <DashboardSidebar
          user={user}
          profile={profile}
          onProfileUpdate={(p) => setProfile(p as typeof profile)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onOpenProfile={() => setProfileOpen(true)}
          savedPersonas={savedPersonas}
          selectedPersona={selectedPersona}
          onSelectPersona={(p) => setSelectedPersona(p as ActivePersona)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 dashboard-content-area" style={{ overflowX: "hidden", overflowY: "hidden", maxWidth: "100%", minHeight: 0, width: "100%" }}>

        {/* ══════════════════════════════════════════════════════════════════
            TOPBAR v3 — Completely rewritten from scratch
            Layout: [☰] [Account Picker] ──── spacer ──── [Telegram] [AdBrief Logo]
            ══════════════════════════════════════════════════════════════════ */}
        <header className="dash-topbar" style={{
          height: 48, minHeight: 48, maxHeight: 48, flexShrink: 0,
          display: "flex", alignItems: "center",
          padding: "0 16px", gap: 10,
          position: "sticky", top: 0, zIndex: 100,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
        }}>

          {/* ── Sidebar toggle ── */}
          <button
            onClick={() => { setSidebarOpen(s => !s); if (profileOpen) setProfileOpen(false); }}
            title={sidebarOpen ? "Ocultar menu" : "Mostrar menu"}
            style={{
              width: 34, height: 34, minWidth: 34, display: "flex", alignItems: "center",
              justifyContent: "center", borderRadius: 8, background: "transparent",
              border: "none", cursor: "pointer", color: "rgba(255,255,255,0.45)",
              flexShrink: 0, transition: "color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}>
            <Menu size={17} />
          </button>

          {/* ── Logo wordmark (only when sidebar hidden) ── */}
          {!sidebarOpen && (
            <div style={{ flexShrink: 0, marginRight: 4 }}>
              <Logo size="sm" />
            </div>
          )}

          {/* Account picker moved to sidebar — header is clean */}

          {/* ── Spacer ── */}
          <div style={{ flex: 1 }} />

          {/* ── Telegram (desktop) ── */}
          <button
            className="hidden lg:flex"
            onClick={() => setTelegramModalOpen(true)}
            title="Telegram"
            style={{
              width: 34, height: 34, minWidth: 34, borderRadius: 8, flexShrink: 0,
              alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill={telegramConn ? "#27AEE1" : "rgba(255,255,255,0.3)"}/>
              <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
            </svg>
          </button>

          {/* Logo removed — clean header */}

        </header>

        {/* Usage/limit banners removed — notifications via email instead */}



        <main className="flex-1 dashboard-main" style={{ background: "var(--bg-main)", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
            >
              <ErrorBoundary>
              {profile ? (
                <Outlet context={{ user, profile, usage, usageDetails, refreshUsage: () => fetchUsage(user!.id), selectedPersona, setSelectedPersona, aiProfile, lang: language } satisfies DashboardContext} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Welcome popup */}
      {vikaPopup && welcomeMsg && (
        <div role="button" aria-label="Close" tabIndex={0} className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setVikaPopup(false)} onKeyDown={e => e.key === "Escape" && setVikaPopup(false)}>
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
              <div className="text-6xl" style={{ animation: "modalIn 0.5s cubic-bezier(.23,1,.32,1) 0.2s both" }}></div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {welcomeMsg.title}
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                {welcomeMsg.body}
              </p>
              <p className="text-xs text-white/50">
                Aproveite cada ferramenta, crie sem medo, e brilhe! 
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

      {/* ── Telegram Modal — Premium UI ── */}
      {telegramModalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setTelegramModalOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}>
          <style>{`
            @keyframes tgModalIn { from { opacity:0; transform:scale(0.92) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
            @keyframes tgOverlayIn { from { opacity:0; } to { opacity:1; } }
            @keyframes tgFeatureIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            @keyframes tgPulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(39,174,225,0.15); } 50% { box-shadow: 0 0 40px rgba(39,174,225,0.3); } }
            @keyframes tgShine { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
            @keyframes tgDotPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
          `}</style>
          <div style={{
            width: "100%", maxWidth: 420,
            background: "linear-gradient(165deg, #111827 0%, #0c1220 50%, #0a0f1a 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24, overflow: "hidden",
            boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
            animation: "tgModalIn 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {/* ── Glow accent top ── */}
            <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #27AEE1, #1a8fc2, transparent)", opacity: 0.6 }} />

            {/* ── Header ── */}
            <div style={{ padding: "24px 26px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "linear-gradient(135deg, rgba(39,174,225,0.15), rgba(39,174,225,0.05))",
                border: "1px solid rgba(39,174,225,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                animation: "tgPulseGlow 3s ease-in-out infinite",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="#27AEE1"/>
                  <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
                  AdBrief Alerts
                </p>
                <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0", fontWeight: 500 }}>
                  @AdBriefAlertsBot
                </p>
              </div>
              {telegramConn && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
                  background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "tgDotPulse 2s ease-in-out infinite" }} />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: "#34d399", fontWeight: 700, letterSpacing: "0.02em" }}>
                    {language === "pt" ? "Ativo" : language === "es" ? "Activo" : "Active"}
                  </span>
                </div>
              )}
              <button onClick={() => setTelegramModalOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                  color: "rgba(255,255,255,0.4)", fontSize: 16, lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { const t = e.currentTarget; t.style.background = "rgba(255,255,255,0.08)"; t.style.color = "rgba(255,255,255,0.7)"; }}
                onMouseLeave={e => { const t = e.currentTarget; t.style.background = "rgba(255,255,255,0.04)"; t.style.color = "rgba(255,255,255,0.4)"; }}>
                ×
              </button>
            </div>

            {/* ── Divider ── */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", margin: "0 26px" }} />

            {/* ── Body ── */}
            <div style={{ padding: "22px 26px 28px" }}>
              {telegramConn ? (
                /* ── Connected state ── */
                <div>
                  <div style={{
                    padding: "14px 16px", borderRadius: 14,
                    background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.08)",
                    marginBottom: 20,
                  }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>
                      {telegramConn.telegram_username ? `@${telegramConn.telegram_username}` : (language === "pt" ? "Conta conectada" : "Account connected")}
                      {" — "}
                      {language === "pt" ? "recebendo alertas em tempo real." : language === "es" ? "recibiendo alertas en tiempo real." : "receiving real-time alerts."}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, marginBottom: 22 }}>
                    {[
                      { icon: "🔔", cmd: "", text: language === "pt" ? "Alertas críticos da conta" : language === "es" ? "Alertas críticos" : "Critical account alerts" },
                      { icon: "⏸", cmd: "/pausar", text: language === "pt" ? "Pausar criativo com confirmação" : language === "es" ? "Pausar creativo" : "Pause creative with confirmation" },
                      { icon: "📊", cmd: "/status", text: language === "pt" ? "Resumo completo da conta" : language === "es" ? "Resumen de cuenta" : "Full account summary" },
                    ].map((item, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        borderRadius: 12, background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        animation: `tgFeatureIn 0.3s ease ${0.1 + i * 0.08}s both`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                        <div style={{ flex: 1 }}>
                          {item.cmd && <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#27AEE1", background: "rgba(39,174,225,0.1)", padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{item.cmd}</code>}
                          <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{item.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={async () => {
                    await (supabase as any).from("telegram_connections").update({ active: false }).eq("user_id", user?.id);
                    setTelegramConn(null);
                    setTelegramPairingLink(null);
                  }} style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, fontWeight: 600,
                    color: "rgba(248,113,113,0.7)", background: "rgba(248,113,113,0.04)",
                    border: "1px solid rgba(248,113,113,0.12)", borderRadius: 10,
                    padding: "8px 16px", cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { const t = e.currentTarget; t.style.background = "rgba(248,113,113,0.1)"; t.style.borderColor = "rgba(248,113,113,0.25)"; }}
                  onMouseLeave={e => { const t = e.currentTarget; t.style.background = "rgba(248,113,113,0.04)"; t.style.borderColor = "rgba(248,113,113,0.12)"; }}>
                    {language === "pt" ? "Desconectar" : language === "es" ? "Desconectar" : "Disconnect"}
                  </button>
                </div>
              ) : telegramPairingLink ? (
                /* ── Link generated state ── */
                <div>
                  <div style={{
                    padding: "16px", borderRadius: 14,
                    background: "rgba(39,174,225,0.04)", border: "1px solid rgba(39,174,225,0.1)",
                    marginBottom: 18, textAlign: "center" as const,
                  }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>
                      {language === "pt" ? "Abra o bot no Telegram e toque" : language === "es" ? "Abre el bot en Telegram y toca" : "Open the bot on Telegram and tap"}{" "}
                      <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#27AEE1", background: "rgba(39,174,225,0.12)", padding: "2px 8px", borderRadius: 4 }}>/start</code>
                    </p>
                  </div>
                  <a href={telegramPairingLink} target="_blank" rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      width: "100%", padding: "14px 0", borderRadius: 14,
                      background: "linear-gradient(135deg, #27AEE1, #1a8fc2)",
                      color: "#fff", fontSize: 15, fontWeight: 700,
                      fontFamily: "'Plus Jakarta Sans', sans-serif", textDecoration: "none",
                      boxSizing: "border-box" as const, position: "relative" as const, overflow: "hidden",
                      boxShadow: "0 4px 20px rgba(39,174,225,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={e => { const t = e.currentTarget; t.style.transform = "translateY(-1px)"; t.style.boxShadow = "0 6px 28px rgba(39,174,225,0.4), inset 0 1px 0 rgba(255,255,255,0.15)"; }}
                    onMouseLeave={e => { const t = e.currentTarget; t.style.transform = "translateY(0)"; t.style.boxShadow = "0 4px 20px rgba(39,174,225,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"; }}>
                    {/* Shine effect */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", animation: "tgShine 2.5s ease-in-out infinite" }} />
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ position: "relative" as const, zIndex: 1 }}>
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="white" opacity="0.25"/>
                      <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
                    </svg>
                    <span style={{ position: "relative" as const, zIndex: 1 }}>
                      {language === "pt" ? "Abrir @AdBriefAlertsBot" : language === "es" ? "Abrir @AdBriefAlertsBot" : "Open @AdBriefAlertsBot"}
                    </span>
                  </a>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 2px" }}>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(251,191,36,0.5)", display: "inline-block" }} />
                      {language === "pt" ? "Expira em 10 minutos" : language === "es" ? "Expira en 10 minutos" : "Expires in 10 minutes"}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(telegramPairingLink || "");
                        const btn = document.getElementById("tg-copy-btn");
                        if (btn) { btn.textContent = "✓"; setTimeout(() => { if (btn) btn.textContent = language === "pt" ? "Copiar link" : language === "es" ? "Copiar enlace" : "Copy link"; }, 2000); }
                      }}
                      id="tg-copy-btn"
                      style={{
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, fontWeight: 600,
                        color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
                        padding: "4px 12px", cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { const t = e.currentTarget; t.style.color = "rgba(255,255,255,0.7)"; t.style.background = "rgba(255,255,255,0.08)"; }}
                      onMouseLeave={e => { const t = e.currentTarget; t.style.color = "rgba(255,255,255,0.35)"; t.style.background = "rgba(255,255,255,0.04)"; }}>
                      {language === "pt" ? "Copiar link" : language === "es" ? "Copiar enlace" : "Copy link"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Not connected state ── */
                <div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 20px", lineHeight: 1.7 }}>
                    {language === "pt"
                      ? "Receba alertas críticos da sua conta no Telegram e execute comandos direto por lá."
                      : language === "es"
                      ? "Recibe alertas de tu cuenta en Telegram y ejecuta comandos directamente."
                      : "Get critical ad account alerts on Telegram and run commands directly."}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 24 }}>
                    {[
                      { icon: "🔔", title: language === "pt" ? "Alertas inteligentes" : language === "es" ? "Alertas inteligentes" : "Smart alerts", desc: language === "pt" ? "CTR caiu, CPM explodiu, frequência alta" : language === "es" ? "CTR cayó, CPM explotó, frecuencia alta" : "CTR drops, CPM spikes, high frequency" },
                      { icon: "⏸", title: language === "pt" ? "Controle remoto" : language === "es" ? "Control remoto" : "Remote control", desc: language === "pt" ? "Pause anúncios com 1 toque" : language === "es" ? "Pausa anuncios con 1 toque" : "Pause ads with 1 tap" },
                      { icon: "📊", title: language === "pt" ? "Resumo diário" : language === "es" ? "Resumen diario" : "Daily digest", desc: language === "pt" ? "Performance completa todo dia" : language === "es" ? "Performance completa todos los días" : "Full performance every day" },
                    ].map((item, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                        borderRadius: 14, background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        animation: `tgFeatureIn 0.35s ease ${0.15 + i * 0.1}s both`,
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { const t = e.currentTarget; t.style.background = "rgba(255,255,255,0.04)"; t.style.borderColor = "rgba(255,255,255,0.08)"; }}
                      onMouseLeave={e => { const t = e.currentTarget; t.style.background = "rgba(255,255,255,0.02)"; t.style.borderColor = "rgba(255,255,255,0.04)"; }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                          background: "rgba(39,174,225,0.06)", border: "1px solid rgba(39,174,225,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        }}>
                          {item.icon}
                        </div>
                        <div>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                            {item.title}
                          </p>
                          <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button disabled={telegramLinkLoading} onClick={async () => {
                    if (!user?.id) return;
                    setTelegramLinkLoading(true);
                    try {
                      const tok = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8);
                      await (supabase as any).from("telegram_pairing_tokens").insert({
                        user_id: user.id, token: tok,
                        expires_at: new Date(Date.now() + 10*60*1000).toISOString(),
                      });
                      setTelegramPairingLink("https://t.me/AdBriefAlertsBot?start=" + tok);
                    } catch (e) { console.error("[AdBrief]", e); }
                    setTelegramLinkLoading(false);
                  }} style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: telegramLinkLoading ? "rgba(39,174,225,0.1)" : "linear-gradient(135deg, #27AEE1, #1a8fc2)",
                    border: "none",
                    color: telegramLinkLoading ? "#27AEE1" : "#fff",
                    fontSize: 15, fontWeight: 700,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    cursor: telegramLinkLoading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxSizing: "border-box" as const,
                    boxShadow: telegramLinkLoading ? "none" : "0 4px 20px rgba(39,174,225,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
                    position: "relative" as const, overflow: "hidden",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { if (!telegramLinkLoading) { const t = e.currentTarget; t.style.transform = "translateY(-1px)"; t.style.boxShadow = "0 6px 28px rgba(39,174,225,0.4), inset 0 1px 0 rgba(255,255,255,0.15)"; } }}
                  onMouseLeave={e => { const t = e.currentTarget; t.style.transform = "translateY(0)"; t.style.boxShadow = telegramLinkLoading ? "none" : "0 4px 20px rgba(39,174,225,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"; }}>
                    {!telegramLinkLoading && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", animation: "tgShine 3s ease-in-out infinite" }} />}
                    {telegramLinkLoading ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#27AEE1", animation: `tgDotPulse 1s ease ${i * 0.2}s infinite` }} />)}
                      </div>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ position: "relative" as const, zIndex: 1 }}>
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" fill="white" opacity="0.25"/>
                          <path d="M5.491 11.74l11.57-4.461c.537-.194 1.006.131.832.943l.001-.001-1.97 9.281c-.146.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.158 13.31 4.17 12.4c-.642-.204-.657-.642.136-.95z" fill="white"/>
                        </svg>
                        <span style={{ position: "relative" as const, zIndex: 1 }}>
                          {language === "pt" ? "Conectar Telegram" : language === "es" ? "Conectar Telegram" : "Connect Telegram"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile panel — opened from topbar avatar */}
      {user && (
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          profile={profile as any}
          onProfileUpdate={(p) => setProfile(p as typeof profile)}
          selectedPersona={selectedPersona}
        />
      )}

      {/* Referral now inline in sidebar footer */}
    </div>
    </>
  );
}

// force-sync 2026-03-24T23:23:48Z