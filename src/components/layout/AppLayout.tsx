// AppLayout — Simplified v2 Copilot sidebar, provides DashboardContext for child pages
// Account selector at top (always visible), mobile hamburger menu
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Logo, MetaLogo } from '@/components/Logo';
import { CreditBar } from '@/components/dashboard/CreditBar';
import { ReferralPopup } from '@/components/dashboard/ReferralPopup';
import UpgradeWall from '@/components/UpgradeWall';
import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/App';
import { storage } from '@/lib/storage';
import { useLanguage } from '@/i18n/LanguageContext';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import type { DashboardContext, Profile, Usage, UsageDetails, ActivePersona } from '@/components/dashboard/DashboardLayout';
import type { User } from '@supabase/supabase-js';
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

// ── Nav item — alive, with indicator bar + glow ─────────────────────────────
function NavItem({ url, label, icon: Icon, onClick, isActive }: {
  url: string; label: string; icon: React.ElementType;
  onClick?: () => void; isActive: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
        padding: '9px 12px 9px 16px', margin: '1px 8px', borderRadius: 9,
        color: isActive ? '#F1F5F9' : hov ? '#CBD5E1' : '#94A3B8',
        background: isActive
          ? 'linear-gradient(135deg, rgba(37,99,235,0.14), rgba(6,182,212,0.07))'
          : hov ? 'rgba(148,163,184,0.06)' : 'transparent',
        border: 'none',
        fontSize: 13.5, fontWeight: isActive ? 600 : 450,
        textDecoration: 'none', transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: F, letterSpacing: '-0.01em',
        boxShadow: isActive
          ? 'inset 4px 0 12px rgba(37,99,235,0.18), 0 0 20px rgba(37,99,235,0.10)'
          : 'none',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {/* Active indicator bar */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 22, borderRadius: 2,
          background: 'linear-gradient(180deg, #3B82F6, #06B6D4)',
          boxShadow: '0 0 12px rgba(59,130,246,0.50), 0 0 4px rgba(59,130,246,0.30)',
        }}/>
      )}
      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} style={{
        color: isActive ? '#60A5FA' : hov ? '#94A3B8' : '#64748B',
        flexShrink: 0, transition: 'all 0.2s',
        filter: isActive ? 'drop-shadow(0 0 4px rgba(96,165,250,0.30))' : 'none',
      }} />
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

function getNavItems(lang: string) {
  const l: Record<string, Record<string, string>> = {
    ai:       { pt: 'Estrategista', es: 'Estratega', fr: 'Stratège', de: 'Stratege', zh: '策略师', ar: 'الاستراتيجي', en: 'Strategist' },
    history:  { pt: 'Histórico', es: 'Historial', fr: 'Historique', de: 'Verlauf', zh: '历史记录', ar: 'السجل', en: 'History' },
    accounts: { pt: 'Contas', es: 'Cuentas', fr: 'Comptes', de: 'Konten', zh: '账户', ar: 'الحسابات', en: 'Accounts' },
  };
  const t = (key: string) => l[key]?.[lang] || l[key]?.en || key;
  return [
    { url: '/dashboard/feed',     label: 'Comando',      icon: Command },
    { url: '/dashboard/ai',       label: t('ai'),        icon: MessageSquare },
    { url: '/dashboard/history',   label: t('history'),   icon: Clock },
    { url: '/dashboard/accounts',  label: t('accounts'),  icon: Building2 },
  ];
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState<any[]>([]);

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
  const [accountAlerts, setAccountAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiProfile, setAiProfile] = useState<any>(null);
  // Start with null — persona is loaded AFTER auth to prevent cross-account leak
  const [selectedPersona, setSelectedPersonaState] = useState<ActivePersona | null>(null);

  const setSelectedPersona = (p: ActivePersona | null, uid?: string) => {
    setSelectedPersonaState(p);
    try {
      if (p && uid) storage.setJSON('frameiq_active_persona', { ...p, _uid: uid });
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

      // AI profile
      (supabase as any).from('user_ai_profile')
        .select('industry, ai_summary, top_performing_models, best_platforms')
        .eq('user_id', session.user.id).maybeSingle()
        .then(({ data, error }: any) => { if (mounted && !error) setAiProfile(data || null); });

      if (profileData && mounted) {
        setProfile(profileData);
        if (profileData.preferred_language) {
          const localLang = storage.get('adbrief_language');
          if (!localLang || localLang === profileData.preferred_language) {
            setLanguage(profileData.preferred_language as any, false);
          }
        }
        if (!profileData.onboarding_completed) {
          navigate('/onboarding');
          return;
        }
      }

      fetchUsage(session.user.id);

      (supabase as any)
        .from('account_alerts')
        .select('*')
        .eq('user_id', session.user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data, error }: any) => {
          if (mounted && !error) setAccountAlerts(data || []);
        });

      // Load saved personas
      const { data: rawPersonas } = await (supabase as any)
        .from('personas')
        .select('id, name, logo_url, result, brand_kit, description, website, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      // Flatten result jsonb into top-level fields for compatibility
      const personas = (rawPersonas || []).map((p: any) => ({
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
            if (parsed?._uid === session.user.id && parsed?.id && personas.find((p: any) => p.id === parsed.id)) {
              restored = parsed;
            }
          }
        } catch {}
        if (restored) {
          setSelectedPersonaState(restored);
        } else {
          setSelectedPersona(personas[0], session.user.id);
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
    const { data: rawPersonas } = await (supabase as any)
      .from('personas')
      .select('id, name, logo_url, result, brand_kit, description, website, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const personas = (rawPersonas || []).map((p: any) => ({
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
      const updated = personas.find((p: any) => p.id === selectedPersona.id);
      if (updated) {
        setSelectedPersona(updated, user.id);
      } else if (personas.length) {
        // Selected persona was deleted — switch to first available
        setSelectedPersona(personas[0], user.id);
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
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  const handleLogout = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate('/login');
  };

  const plan = (profile as any)?.plan || 'free';

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

      {/* ── Account selector — always visible ── */}
      <div style={{ flexShrink: 0 }}>
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
            {metaConnected && !accountResolving && (
              // Meta-connected badge — used to be a naked MetaLogo with
              // 0.7 opacity, read as a random floating icon with no
              // context ("muito morto, não dá pra entender"). Now it's
              // a tight pill with the Meta mark + "Ads" label so any
              // user knows at a glance: "yes, this account is wired to
              // Meta Ads". Cyan tint matches the rest of the copilot
              // color voice.
              <span
                title="Conta conectada ao Meta Ads"
                style={{
                  flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 6px 2px 4px',
                  borderRadius: 5,
                  background: 'rgba(14,165,233,0.08)',
                  border: '1px solid rgba(14,165,233,0.20)',
                  color: '#7DD3FC',
                }}
              >
                <MetaLogo size={12} />
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  letterSpacing: '0.10em', textTransform: 'uppercase',
                  fontFamily: F, lineHeight: 1,
                }}>
                  Ads
                </span>
              </span>
            )}
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
                          setSelectedPersona(p);
                          window.dispatchEvent(new CustomEvent('persona-updated'));
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

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        <nav style={{ paddingTop: 8 }}>
          {getNavItems(language).map(item => (
            <NavItem
              key={item.url}
              url={item.url}
              label={item.label}
              icon={item.icon}
              isActive={isAt(item.url)}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      </div>

      {/* Footer — CreditBar + Referral + Logout */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, background: 'rgba(148,163,184,0.06)', margin: '0 0 4px' }} />
        <CreditBar userId={user?.id} plan={plan} />
        <ReferralPopup userId={user?.id} />
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
            Sair
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-main)' }}>
      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: 52, background: 'var(--bg-main)',
          borderBottom: '1px solid rgba(148,163,184,0.06)',
          display: 'flex', alignItems: 'center', padding: '0 12px',
          fontFamily: F,
        }}>
          <button onClick={() => setMobileOpen(true)}
            style={{
              background: 'none', border: 'none', padding: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Menu size={20} color="#94A3B8" />
          </button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'baseline' }}>
            <Logo size="lg" />
          </div>
          <div style={{ width: 36 }} />
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

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        height: '100%',
        background: 'var(--bg-main)',
        borderRight: '1px solid rgba(148,163,184,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        fontFamily: F, overflow: 'hidden',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 99,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: mobileOpen ? '12px 0 40px rgba(0,0,0,0.6)' : 'none',
        } : {}),
      }}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, overflow: 'auto', background: 'var(--bg-main)',
        ...(isMobile ? { paddingTop: 52 } : {}),
      }}>
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
          } satisfies DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }} />
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
    </div>
  );
}

export default AppLayout;
