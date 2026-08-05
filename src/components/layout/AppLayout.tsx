// AppLayout — shell do produto: sidebar (src/components/sidebar) + topbar
// + DashboardContext para as páginas filhas.
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Logo } from '@/components/Logo';
import UpgradeWall from '@/components/UpgradeWall';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/App';
import { storage } from '@/lib/storage';
import { useLanguage } from '@/i18n/LanguageContext';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import type { DashboardContext, Profile, Usage, UsageDetails, ActivePersona, AccountAlert } from '@/components/dashboard/DashboardLayout';
import type { User } from '@supabase/supabase-js';
import { AppTopbarBreadcrumb } from '@/components/dashboard/AppTopbarBreadcrumb';
import { AppTopbarBell } from '@/components/dashboard/AppTopbarBell';
import { AppTopbarUserMenu } from '@/components/dashboard/AppTopbarUserMenu';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { UserProfilePanel } from '@/components/dashboard/UserProfilePanel';
import CreditChip from "./CreditChip";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { SIDEBAR_COLLAPSED_KEY } from "@/components/sidebar/sidebarConfig";

import { Menu } from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";
const MOBILE_BP = 768;


export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  // Estado recolhido da sidebar — persiste entre recargas.
  const [collapsed, setCollapsed] = useState<boolean>(
    () => storage.get(SIDEBAR_COLLAPSED_KEY) === "true",
  );
  useEffect(() => {
    try { storage.set(SIDEBAR_COLLAPSED_KEY, String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  // Antes: useState(false). O primeiro paint sempre desenhava a sidebar fixa
  // de 220px, mesmo num celular de 375px, e só depois trocava pelo drawer —
  // o usuário via a barra "pular". Agora já nasce com o valor certo.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BP,
  );
  const [savedPersonas, setSavedPersonas] = useState<any[]>([]);
  // Topbar overlays — UserProfilePanel slide-out + Cmd+K palette.
  // Both live at the layout level so they sit above page content and
  // can be triggered from anywhere (avatar menu, palette, keyboard).
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isPaletteShortcut = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (!isPaletteShortcut) return;
      e.preventDefault();
      setPaletteOpen(s => !s);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // matchMedia em vez de resize com debounce.
  //
  // O debounce de 150ms era a outra metade do problema: o CSS do index.css
  // troca de layout instantaneamente no breakpoint, e o JS só 150ms depois.
  // Durante esse intervalo — e em toda rotação de celular — os dois
  // discordavam, e a barra oscilava. matchMedia dispara junto com o CSS.
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // ── Auth + profile state ──
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Usage>({ analyses_count: 0, boards_count: 0 });
  const [usageDetails, setUsageDetails] = useState<UsageDetails | null>(null);
  const [accountAlerts, setAccountAlerts] = useState<AccountAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiProfile, setAiProfile] = useState<any>(null);
  // Start with null — persona is loaded AFTER auth to prevent cross-account leak
  const [selectedPersona, setSelectedPersonaState] = useState<ActivePersona | null>(null);

  const setSelectedPersona = (p: ActivePersona | null, uid?: string) => {
    setSelectedPersonaState(p);
    try {
      // Fall back to the current authenticated user's id when caller
      // doesn't pass uid explicitly. Without _uid in the persisted
      // payload, the boot path at line ~292 fails the
      // `parsed._uid === session.user.id` check on next reload and
      // resets to personas[0] (always Adbrief, the first-created).
      // That was the silent bug behind "I switched persona, reloaded,
      // now I'm back on the original" — it persisted across sessions.
      const effectiveUid = uid ?? user?.id;
      if (p && effectiveUid) storage.setJSON('frameiq_active_persona', { ...p, _uid: effectiveUid });
      else if (p) storage.setJSON('frameiq_active_persona', p);
      else storage.remove('frameiq_active_persona');
    } catch {}
  };

  // ── Active account resolution (persona → Meta → v2) ──
  const {
    account: activeAccount,
    isConnected: metaConnected,
    isLoading: accountResolving,
  } = useActiveAccount(user?.id, selectedPersona?.id ?? null);

  const fetchUsage = useCallback(async (userId: string) => {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from('usage').select('*').eq('user_id', userId).eq('period', currentPeriod).maybeSingle();
    if (data) setUsage({ analyses_count: data.analyses_count, boards_count: data.boards_count });
    try {
      const { data: d } = await supabase.functions.invoke('check-usage', { body: { user_id: userId } });
      if (d) setUsageDetails(d);
    } catch {}
  }, []);

  // ── Init: auth + profile fetch ──
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        session = refreshData.session;
      }
      if (!session) { navigate('/login'); return; }
      if (!mounted) return;
      setUser(session.user);

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();

      // user_ai_profile, account_alerts, personas — off-schema in the
      // generated supabase types. Cast the client once and narrow rows
      // with explicit types below.
      type AiProfileLite = {
        industry: string | null;
        ai_summary: string | null;
        top_performing_models: unknown;
        best_platforms: unknown;
      };
      type PersonaRow = {
        id: string;
        name: string | null;
        logo_url: string | null;
        result: {
          name?: string;
          website?: string;
          biz_description?: string;
          preferred_market?: string;
          industry?: string;
          niche?: string;
        } | null;
        brand_kit: { logo_data_url?: string } | null;
        description: string | null;
        website: string | null;
        created_at: string;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      sb.from('user_ai_profile')
        .select('industry, ai_summary, top_performing_models, best_platforms')
        .eq('user_id', session.user.id).maybeSingle()
        .then((res: { data: AiProfileLite | null; error: unknown }) => {
          if (mounted && !res.error) setAiProfile(res.data || null);
        });

      if (profileData && mounted) {
        setProfile(profileData);
        if (profileData.preferred_language) {
          const localLang = storage.get('adbrief_language');
          if (!localLang || localLang === profileData.preferred_language) {
            setLanguage(profileData.preferred_language as Parameters<typeof setLanguage>[0], false);
          }
        }
        // Onboarding desligado — Hub é uso interno por convite, sem
        // questionário inicial. Quem entra cai direto no Painel.
        // (Antes redirecionava pra /onboarding se profile.onboarding_completed
        // = false; agora ignora a flag.)
      }

      fetchUsage(session.user.id);

      sb.from('account_alerts')
        .select('*')
        .eq('user_id', session.user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
        .then((res: { data: AccountAlert[] | null; error: unknown }) => {
          if (mounted && !res.error) setAccountAlerts(res.data || []);
        });

      // Load saved personas — limit(50) pra cortar histórico antigo
      // (sidebar mostra ~5, 50 é folga generosa).
      const { data: rawPersonas } = await sb
        .from('personas')
        .select('id, name, logo_url, result, brand_kit, description, website, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50) as { data: PersonaRow[] | null };

      // Flatten result jsonb into top-level fields for compatibility
      const personas = (rawPersonas || []).map((p) => ({
        id: p.id,
        name: p.name || p.result?.name || 'Conta',
        logo_url: p.logo_url || p.brand_kit?.logo_data_url || null,
        website: p.website || p.result?.website || null,
        description: p.description || p.result?.biz_description || null,
        preferred_market: p.result?.preferred_market || null,
        industry: p.result?.industry || p.result?.niche || null,
      }));

      if (mounted && personas.length) {
        setSavedPersonas(personas);
        // Restore from localStorage only if it belongs to THIS user
        let restored: ActivePersona | null = null;
        try {
          const s = storage.get('frameiq_active_persona');
          if (s) {
            const parsed = JSON.parse(s);
            if (parsed?._uid === session.user.id && parsed?.id && personas.find((p) => p.id === parsed.id)) {
              restored = parsed;
            }
          }
        } catch {}
        if (restored) {
          setSelectedPersonaState(restored);
        } else {
          setSelectedPersona(personas[0] as unknown as ActivePersona, session.user.id);
        }
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, []);

  // ── Reload personas when AccountsPage saves changes ──
  const reloadPersonas = useCallback(async () => {
    if (!user) return;
    type PersonaRow = {
      id: string;
      name: string | null;
      logo_url: string | null;
      result: {
        name?: string;
        website?: string;
        biz_description?: string;
        preferred_market?: string;
        industry?: string;
        niche?: string;
      } | null;
      brand_kit: { logo_data_url?: string } | null;
      description: string | null;
      website: string | null;
      created_at: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawPersonas } = await (supabase as any)
      .from('personas')
      .select('id, name, logo_url, result, brand_kit, description, website, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50) as { data: PersonaRow[] | null };

    const personas = (rawPersonas || []).map((p) => ({
      id: p.id,
      name: p.name || p.result?.name || 'Conta',
      logo_url: p.logo_url || p.brand_kit?.logo_data_url || null,
      website: p.website || p.result?.website || null,
      description: p.description || p.result?.biz_description || null,
      preferred_market: p.result?.preferred_market || null,
      industry: p.result?.industry || p.result?.niche || null,
    }));

    setSavedPersonas(personas);

    // If the currently selected persona was updated, refresh its data too
    if (selectedPersona) {
      const updated = personas.find((p) => p.id === selectedPersona.id);
      if (updated) {
        setSelectedPersona(updated as unknown as ActivePersona, user.id);
      } else if (personas.length) {
        // Selected persona was deleted — switch to first available
        setSelectedPersona(personas[0] as unknown as ActivePersona, user.id);
      } else {
        setSelectedPersona(null);
      }
    }
  }, [user, selectedPersona]);

  useEffect(() => {
    const handler = () => { reloadPersonas(); };
    window.addEventListener('persona-updated', handler);
    return () => window.removeEventListener('persona-updated', handler);
  }, [reloadPersonas]);

  const isAt = (url: string) => {
    if (url === '/dashboard/feed') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/feed';
    }
    // Painel (/dashboard/hub) — só ativa em exact match. Sem isso ele
    // ficava aceso em qualquer rota /dashboard/hub/* (Imagens, Biblioteca,
    // etc.) porque o startsWith pegava o prefixo.
    if (url === '/dashboard/hub') {
      return location.pathname === '/dashboard/hub' || location.pathname === '/dashboard/hub/';
    }
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  const handleLogout = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const plan = profile?.plan || 'free';

  // ── Upgrade wall state ──
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => {
    const handler = () => setUpgradeOpen(true);
    window.addEventListener("adbrief:open-upgrade", handler);
    // also listen to legacy capacity modal event
    window.addEventListener("adbrief:open-capacity-modal", handler);
    return () => {
      window.removeEventListener("adbrief:open-upgrade", handler);
      window.removeEventListener("adbrief:open-capacity-modal", handler);
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080C' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(148,163,184,0.10)', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Sidebar agora vive em src/components/sidebar (config centralizada).


  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-main)' }}>
      {/* ── Mobile top bar ──
            iOS notch / Dynamic Island handling: the bar sits at top:0
            but pads its content down by env(safe-area-inset-top) so
            the menu button + logo never collide with the notch. The
            bar's total height grows accordingly. The main content
            below uses the same calc to reserve space. */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          background: 'var(--bg-main)',
          borderBottom: '1px solid rgba(148,163,184,0.06)',
          display: 'flex', alignItems: 'stretch',
          fontFamily: F,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', flex: 1, padding: '0 12px',
          }}>
            <button onClick={() => setMobileOpen(true)}
              style={{
                background: 'none', border: 'none', padding: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 44, minHeight: 44,
              }}>
              <Menu size={20} color="#94A3B8" />
            </button>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'baseline' }}>
              <Logo size="lg" />
            </div>
            <div style={{ width: 44 }} />
          </div>
        </div>
      )}

      {/* ── Sidebar (drawer no mobile, fixa no desktop) ── */}
      <AppSidebar
        lang={language}
        plan={profile?.plan}
        isMobile={isMobile}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        onLogout={handleLogout}
      />


      {/* Main content
            Mobile: reserve room for the topbar (52) + the iOS notch.
            We DON'T pad bottom here — pages render their own bottom
            sticky elements (chat composer, decision cards) and each
            handles its own home-indicator clearance via the chat-input
            CSS in index.css. Padding bottom here would push everything
            up and create a dead band on phones with no bottom inset. */}
      <main style={{
        flex: 1, overflow: 'auto', background: 'var(--bg-main)',
        display: 'flex', flexDirection: 'column', minWidth: 0,
        ...(isMobile ? {
          paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
        } : {}),
      }}>
        {/* ── Desktop topbar — breadcrumb + spacer + bell + avatar menu.
              Hidden on mobile (the mobile top bar above is its replacement).
              Sticky so it stays during long-page scrolls (Feed, History). */}
        {!isMobile && (
          <header style={{
            height: 52, minHeight: 52, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 20px', gap: 12,
            position: 'sticky', top: 0, zIndex: 50,
            background: 'rgba(10,15,28,0.85)',
            backdropFilter: 'blur(14px) saturate(140%)',
            WebkitBackdropFilter: 'blur(14px) saturate(140%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontFamily: F,
          }}>
            <AppTopbarBreadcrumb />
            <div style={{ flex: 1 }} />
            {/* O produto é medido em créditos e o medidor não existia na
                chrome. Das 52 telas, 7 liam o saldo e nenhuma era o shell. */}
            <CreditChip />
            <AppTopbarBell alerts={accountAlerts.map(a => ({
              id: a.id,
              title: a.ad_name || a.campaign_name || a.type,
              description: a.detail,
              severity: a.urgency,
              created_at: a.created_at,
            }))} />
            <AppTopbarUserMenu
              user={user}
              profile={profile}
              plan={profile?.plan ?? null}
              onOpenProfile={() => setProfileOpen(true)}
            />
          </header>
        )}

        {profile ? (
          <ErrorBoundary>
          <main>
          <Outlet context={{
            user,
            profile,
            usage,
            usageDetails,
            refreshUsage: () => user ? fetchUsage(user.id) : Promise.resolve(),
            selectedPersona,
            setSelectedPersona,
            aiProfile,
            lang: language,
            accountAlerts,
            // v2: active account resolution
            activeAccount,
            metaConnected,
            accountResolving,
          } satisfies DashboardContext & { activeAccount: ReturnType<typeof useActiveAccount>['account']; metaConnected: boolean; accountResolving: boolean }} />
          </main>
          </ErrorBoundary>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(148,163,184,0.10)', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </main>

      {/* ── Upgrade Wall ── */}
      {upgradeOpen && (
        <UpgradeWall
          onClose={() => setUpgradeOpen(false)}
          trigger="sidebar"
        />
      )}

      {/* ── Profile slide-out — opened by topbar avatar OR Cmd+K palette ── */}
      {user && (
        <UserProfilePanel
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          profile={profile as any}
          onProfileUpdate={(p) => setProfile(p as unknown as Profile)}
          selectedPersona={selectedPersona}
        />
      )}

      {/* ── Global Cmd+K palette — Decisões pendentes / Navegar / Conta ── */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        accountId={(selectedPersona?.account_id as string | null | undefined) ?? null}
        onOpenProfile={() => { setPaletteOpen(false); setProfileOpen(true); }}
      />
    </div>
  );
}

export default AppLayout;
