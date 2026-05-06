// AppLayout — Simplified v2 Copilot sidebar, provides DashboardContext for child pages
// Account selector at top (always visible), mobile hamburger menu
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Logo } from '@/components/Logo';
import { CreditBar } from '@/components/dashboard/CreditBar';
import { ReferralPopup } from '@/components/dashboard/ReferralPopup';
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
import {
  Command,
  Clock,
  MessageSquare,
  LogOut,
  Link2,
  Menu,
  X,
  Building2,
  ChevronDown,
  Plus,
  Image as ImageIcon,
  Clapperboard,
  Video,
  FolderOpen,
  Tag,
  BarChart3,
  Lightbulb,
  Sparkles,
  Layers,
  Film,
  Mic,
  Captions,
  GitBranch,
  GalleryHorizontal,
} from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";
const MOBILE_BP = 768;

// Gradient palette for persona avatars — subtle, dark-first linear gradients
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
  "linear-gradient(135deg, #191924 0%, #2d1b4e 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #1b3a4b 100%)",
  "linear-gradient(135deg, #1c1c1c 0%, #2c1810 100%)",
  "linear-gradient(135deg, #141e20 0%, #0d2818 100%)",
  "linear-gradient(135deg, #1a1520 0%, #2a1a3a 100%)",
];
function avatarGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

// ── Nav item — paleta azul Adbrief, refinamento premium.
//   - Mais respiro (gap 12, padding vertical 9)
//   - Ícones com peso visual (16px strokeWidth 2 quando ativo)
//   - Active state com inner glow sutil (box-shadow inset)
//   - Hover suave + scale microscópico no press
function NavItem({ url, label, icon: Icon, onClick, isActive, soon, soonLabel }: {
  url: string; label: string; icon: React.ElementType;
  onClick?: () => void; isActive: boolean;
  soon?: boolean; soonLabel?: string;
}) {
  const [hov, setHov] = useState(false);
  const handleClick = (e: React.MouseEvent) => {
    if (soon) { e.preventDefault(); return; }
    onClick?.();
  };
  return (
    <NavLink
      to={soon ? "#" : url}
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
        padding: '9px 12px 9px 14px', margin: '2px 10px', borderRadius: 9,
        // Idle mais claro (#E5E7EB > #D1D5DB) pra contraste melhor
        color: isActive ? '#FFFFFF' : hov && !soon ? '#FFFFFF' : soon ? '#9CA3AF' : '#E5E7EB',
        background: isActive
          ? 'rgba(59,130,246,0.18)'
          : hov && !soon ? 'rgba(255,255,255,0.05)' : 'transparent',
        border: isActive ? '1px solid rgba(59,130,246,0.45)' : '1px solid transparent',
        fontSize: 13.5, fontWeight: isActive ? 700 : 500,
        textDecoration: 'none',
        transition: 'all 0.15s ease',
        fontFamily: F, letterSpacing: '-0.005em',
        cursor: soon ? 'not-allowed' : 'pointer',
        opacity: soon ? 0.55 : 1,
        boxShadow: isActive ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : 'none',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={16} strokeWidth={isActive ? 2.2 : 1.7} style={{
        color: isActive ? '#3B82F6' : soon ? '#6B7280' : hov ? '#D1D5DB' : '#9CA3AF',
        flexShrink: 0, transition: 'color 0.15s',
      }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {soon && soonLabel && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '2px 5px', borderRadius: 4,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#9CA3AF',
          flexShrink: 0,
        }}>
          {soonLabel}
        </span>
      )}
    </NavLink>
  );
}

// Sidebar Hub: Painel + 3 seções (Designer / Ferramentas / Biblioteca).
// Cada seção tem subitens. "Em breve" = navega pra mesma rota mas
// fica visualmente desabilitado (opacity + tag).
type NavSection = {
  title?: string; // null = top-level (sem header de seção)
  items: Array<{ url: string; label: string; icon: React.ElementType; soon?: boolean }>;
};

function getNavSections(lang: string): NavSection[] {
  const L = (pt: string, en: string, es: string, zh: string) =>
    lang === "en" ? en : lang === "es" ? es : lang === "zh" ? zh : pt;
  return [
    {
      // Top — Painel
      items: [
        { url: '/dashboard/hub', label: L('Painel', 'Dashboard', 'Panel', '仪表板'), icon: Command },
      ],
    },
    {
      // Workflows isolado — é o FEATURE principal (pipelines reutilizáveis).
      // Conceptualmente diferente dos geradores únicos.
      title: L('Automação', 'Automation', 'Automatización', '自动化'),
      items: [
        { url: '/dashboard/hub/workflows',  label: L('Workflows', 'Workflows', 'Workflows', '工作流'), icon: Sparkles },
      ],
    },
    {
      // Criar — geradores de UM asset único (imagem, PNG transparente, vídeo, áudio)
      title: L('Criar', 'Create', 'Crear', '创建'),
      items: [
        { url: '/dashboard/hub/image', label: L('Imagem',        'Image',           'Imagen',           '图像'),     icon: ImageIcon },
        { url: '/dashboard/hub/png',   label: L('PNG',           'PNG',             'PNG',              'PNG'),       icon: Layers },
        { url: '/dashboard/hub/video', label: L('Vídeo',         'Video',           'Video',            '视频'),     icon: Video },
        { url: '/dashboard/hub/voice', label: L('Voz',           'Voice',           'Voz',              '语音'),     icon: Mic },
      ],
    },
    {
      // Sequências — quando o output é MÚLTIPLO (storyboard, carrossel, AB)
      title: L('Sequências', 'Sequences', 'Secuencias', '序列'),
      items: [
        { url: '/dashboard/hub/storyboard', label: L('Storyboard',    'Storyboard',    'Storyboard',    '故事板'),    icon: Clapperboard },
        { url: '/dashboard/hub/carousel',   label: L('Carrossel',     'Carousel',      'Carrusel',      '轮播'),       icon: GalleryHorizontal },
        { url: '/dashboard/hub/ab',         label: L('Variações AB',  'A/B Variants',  'Variantes A/B', 'A/B 变体'),  icon: GitBranch },
      ],
    },
    {
      // Inteligência — análise + utilitários de dados
      title: L('Inteligência', 'Intelligence', 'Inteligencia', '智能'),
      items: [
        { url: '/dashboard/hub/transcribe', label: L('Transcrição', 'Transcription', 'Transcripción', '转录'),       icon: Captions },
        { url: '/dashboard/hub/analytics',  label: L('Analytics',   'Analytics',     'Analítica',     '数据分析'), icon: BarChart3 },
      ],
    },
    {
      title: L('Biblioteca', 'Library', 'Biblioteca', '资源库'),
      items: [
        { url: '/dashboard/hub/library', label: L('Biblioteca', 'Library', 'Biblioteca', '资源库'), icon: FolderOpen },
      ],
    },
  ];
}

function comingSoonLabel(lang: string): string {
  return lang === "en" ? "Coming soon" : lang === "es" ? "Próximamente" : lang === "zh" ? "即将推出" : "Em breve";
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
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

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BP);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
    setAccountsOpen(false);
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
    switchAccount,
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

      // Load saved personas
      const { data: rawPersonas } = await sb
        .from('personas')
        .select('id, name, logo_url, result, brand_kit, description, website, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }) as { data: PersonaRow[] | null };

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
      .order('created_at', { ascending: false }) as { data: PersonaRow[] | null };

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

  // ── Sidebar content ──
  const sidebarContent = (
    <>
      {/* Logo text — same as landing page header */}
      <div style={{
        height: 56, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}
          title="adbrief"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'baseline' }}>
          <Logo size="lg" />
        </button>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
            <X size={20} color="#94A3B8" />
          </button>
        )}
      </div>

      {/* ── Account selector — escondido nas rotas /dashboard/hub*.
          Hub é produto interno isolado: não mostra conta/persona/plano. */}
      <div style={{ flexShrink: 0, display: location.pathname.startsWith('/dashboard/hub') ? 'none' : 'block' }}>
        <button
          onClick={() => setAccountsOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 14px', background: 'transparent', border: 'none',
            cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
            fontFamily: F,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Avatar with connection dot */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, overflow: 'hidden',
              background: selectedPersona
                ? (selectedPersona.logo_url ? 'rgba(148,163,184,0.08)' : avatarGradient(selectedPersona.name || '?'))
                : 'rgba(148,163,184,0.06)',
              border: '1px solid rgba(148,163,184,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selectedPersona?.logo_url
                ? <img src={selectedPersona.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : selectedPersona
                  ? <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5E1' }}>
                      {(selectedPersona.name || '?').charAt(0).toUpperCase()}
                    </span>
                  : <Building2 size={13} color="#475569" />
              }
            </div>
            {selectedPersona && !accountResolving && (
              <span style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 9, height: 9, borderRadius: '50%',
                background: metaConnected ? '#22C55E' : '#475569',
                border: '2px solid #060A14',
                boxShadow: metaConnected ? '0 0 6px rgba(34,197,94,0.50)' : 'none',
              }} />
            )}
          </div>

          {/* Name + Meta connection badge */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: selectedPersona ? '#F1F5F9' : '#475569',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }}>
              {selectedPersona?.name || 'Selecionar conta'}
            </p>
            {/* Meta connection badge removed per founder request — the
                sidebar account selector is cleaner without the platform
                mark. Connection state still surfaces elsewhere (Feed
                hero, Accounts page). */}
          </div>

          <ChevronDown size={12} color="#475569"
            style={{ flexShrink: 0, transform: accountsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)' }} />
        </button>

        {/* Dropdown: personas + Meta ad accounts */}
        {accountsOpen && (
          <div style={{
            borderTop: '1px solid rgba(148,163,184,0.06)',
            paddingTop: 2, paddingBottom: 2,
          }}>
            {/* Persona switcher — always show */}
            {savedPersonas.length > 0 && (
              <>
                <div style={{ padding: '6px 14px 3px', fontSize: 9.5, fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: F }}>
                  Marcas
                </div>
                {savedPersonas.map(p => {
                  const isActive = p.id === selectedPersona?.id;
                  return (
                    <button key={p.id}
                      onClick={() => {
                        if (!isActive) {
                          // Switch persona via React state + localStorage.
                          // DO NOT dispatch 'persona-updated' here — that
                          // event re-runs reloadPersonas, which captured a
                          // stale closure of selectedPersona and would
                          // overwrite our just-set value 1.5s later. The
                          // persona-updated event is reserved for
                          // AccountsPage create/edit/delete flows where the
                          // persona LIST itself changed.
                          setSelectedPersona(p, user?.id);
                        }
                        setAccountsOpen(false);
                        setMobileOpen(false);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 14px', background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: F,
                        transition: 'all 0.15s cubic-bezier(0.4,0,0.2,1)', textAlign: 'left',
                        borderRadius: 6, margin: '0 4px',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.06)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                        background: p.logo_url ? 'rgba(148,163,184,0.08)' : avatarGradient(p.name || '?'),
                        border: '1px solid rgba(148,163,184,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {p.logo_url
                          ? <img src={p.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>
                              {(p.name || '?').charAt(0).toUpperCase()}
                            </span>
                        }
                      </div>
                      <span style={{
                        flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#F1F5F9' : '#94A3B8',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#60A5FA', letterSpacing: '0.06em' }}>ATIVO</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Ad account switching removed from sidebar — use Accounts page instead */}

            {/* Not connected — nudge */}
            {!metaConnected && selectedPersona && (
              <button
                onClick={() => { navigate('/dashboard/accounts'); setAccountsOpen(false); setMobileOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', background: 'rgba(239,68,68,0.06)', border: 'none',
                  cursor: 'pointer', fontFamily: F, transition: 'background 0.1s',
                  borderRadius: 4, margin: '2px 0',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
              >
                <Link2 size={12} color="#ef4444" />
                <span style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 500 }}>
                  Conectar Meta Ads
                </span>
              </button>
            )}

            {/* Manage accounts link */}
            <button
              onClick={() => { navigate('/dashboard/accounts'); setAccountsOpen(false); setMobileOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: F, transition: 'background 0.1s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: 'rgba(148,163,184,0.06)', border: '1px dashed rgba(148,163,184,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={9} color="#475569" />
              </div>
              <span style={{ fontSize: 11.5, color: '#475569' }}>
                Gerenciar contas
              </span>
            </button>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(148,163,184,0.06)', margin: '4px 0 0' }} />
      </div>

      {/* Nav — Painel + seções DESIGNER / FERRAMENTAS / BIBLIOTECA */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        <nav style={{ paddingTop: 8 }}>
          {getNavSections(language).map((section, sIdx) => (
            <div key={section.title || `top-${sIdx}`} style={{ marginBottom: section.title ? 6 : 16 }}>
              {section.title && (
                <p style={{
                  margin: '20px 18px 8px',
                  // Mais claro que #9CA3AF — contraste melhor no fundo dark
                  fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#D1D5DB',
                }}>
                  {section.title}
                </p>
              )}
              {section.items.map(item => (
                <NavItem
                  key={item.url}
                  url={item.url}
                  label={item.label}
                  icon={item.icon}
                  isActive={isAt(item.url)}
                  soon={item.soon}
                  soonLabel={item.soon ? comingSoonLabel(language) : undefined}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer — CreditBar + Logout. CreditBar (que mostra plano/Studio/etc)
          escondido em rotas /dashboard/hub* — Hub é produto interno isolado. */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, background: 'rgba(148,163,184,0.06)', margin: '0 0 4px' }} />
        {!location.pathname.startsWith('/dashboard/hub') && (
          <CreditBar userId={user?.id} plan={plan} />
        )}
        {/* ReferralPopup escondido no pivô interno — operação Brilliant
            Gaming, sem programa de indicação. Mantém o componente
            importado caso queira reativar no futuro. */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '8px 14px 12px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', transition: 'background 0.12s',
            fontFamily: F,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.04)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          <LogOut size={14} strokeWidth={1.5} color="#475569" />
          <span style={{ fontSize: 13, fontWeight: 400, color: '#64748B' }}>
            {language === "en" ? "Sign out" : language === "es" ? "Cerrar sesión" : language === "zh" ? "退出登录" : "Sair"}
          </span>
        </button>
      </div>
    </>
  );

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

      {/* ── Mobile overlay backdrop ── */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 98,
            background: 'rgba(0,0,0,0.60)',
            transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* ── Sidebar ──
            On mobile the drawer is fixed from edge to edge of the
            viewport, so it must reserve space for the notch (top) and
            the home indicator (bottom). Padding instead of margin so
            the side bg still extends behind the unsafe regions —
            looks like one continuous panel rather than a clipped one. */}
      <aside style={{
        width: 220,
        height: '100%',
        background: 'var(--bg-main)',
        borderRight: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        fontFamily: F, overflow: 'hidden',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 99,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: mobileOpen ? '12px 0 40px rgba(0,0,0,0.6)' : 'none',
        } : {}),
      }}>
        {sidebarContent}
      </aside>

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
