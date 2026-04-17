// AppLayout — Simplified v2 Copilot sidebar, provides DashboardContext for child pages
// Account selector at top (always visible), mobile hamburger menu
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
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
  Zap,
  Clock,
  PenLine,
  Settings,
  LogOut,
  Link2,
  Menu,
  X,
  Building2,
  ChevronDown,
  Plus,
  Users,
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

// ── Nav item ─────────────────────────────────────────────────────────────────
function NavItem({ url, label, icon: Icon, isActive, badge, onClick }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; badge?: string; onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', margin: '1px 0', borderRadius: 7,
        marginLeft: 8, marginRight: 8,
        color: isActive ? '#fff' : hov ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.65)',
        background: isActive
          ? 'rgba(255,255,255,0.10)'
          : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none',
        fontSize: 13.5, fontWeight: isActive ? 600 : 450,
        textDecoration: 'none', transition: 'all 0.15s',
        fontFamily: F, letterSpacing: '-0.01em',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={16} strokeWidth={1.5} style={{
        color: isActive ? '#0da2e7' : 'rgba(255,255,255,0.45)',
        flexShrink: 0, transition: 'color 0.15s',
      }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.50)',
          letterSpacing: '0.04em', fontFamily: F,
        }}>{badge}</span>
      )}
    </NavLink>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '16px 20px 6px', display: 'flex', alignItems: 'center' }}>
      <p style={{
        fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
        fontFamily: F,
      }}>
        {label}
      </p>
    </div>
  );
}

function getNavItems(lang: string) {
  const l: Record<string, Record<string, string>> = {
    history:  { pt: 'Histórico', es: 'Historial', fr: 'Historique', de: 'Verlauf', zh: '历史记录', ar: 'السجل', en: 'History' },
    create:   { pt: 'Criar', es: 'Crear', fr: 'Créer', de: 'Erstellen', zh: '创建', ar: 'إنشاء', en: 'Create' },
    accounts: { pt: 'Contas', es: 'Cuentas', fr: 'Comptes', de: 'Konten', zh: '账户', ar: 'الحسابات', en: 'Accounts' },
    settings: { pt: 'Configurações', es: 'Configuración', fr: 'Paramètres', de: 'Einstellungen', zh: '设置', ar: 'الإعدادات', en: 'Settings' },
  };
  const t = (key: string) => l[key]?.[lang] || l[key]?.en || key;
  return [
    { url: '/dashboard/feed',      label: 'Feed',        icon: Zap,         badge: 'IA' },
    { url: '/dashboard/history',   label: t('history'),   icon: Clock },
    { url: '/dashboard/criar',     label: t('create'),    icon: PenLine },
    { url: '/dashboard/accounts',  label: t('accounts'),  icon: Users },
    { url: '/dashboard/settings',  label: t('settings'),  icon: Settings },
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

      // Load saved personas — select only columns that exist in the table
      const { data: rawPersonas } = await (supabase as any)
        .from('personas')
        .select('id, name, result, brand_kit, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      // Flatten result jsonb into top-level fields for compatibility
      const personas = (rawPersonas || []).map((p: any) => ({
        id: p.id,
        name: p.name || p.result?.name || 'Conta',
        logo_url: p.brand_kit?.logo_data_url || null,
        website: p.result?.website || null,
        description: p.result?.biz_description || null,
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

  // Loading state — wait for auth + profile AND account resolution before
  // rendering the layout, so sidebar never flashes "Conectando..." then updates.
  if (loading || accountResolving) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080C' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#0ea5e9', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Sidebar content ──
  const sidebarContent = (
    <>
      {/* Logo row */}
      <div style={{
        height: 52, padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <button onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Logo size="md" />
        </button>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
            <X size={20} color="rgba(255,255,255,0.50)" />
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
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
            background: selectedPersona
              ? (selectedPersona.logo_url ? 'rgba(255,255,255,0.08)' : avatarGradient(selectedPersona.name || '?'))
              : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selectedPersona?.logo_url
              ? <img src={selectedPersona.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : selectedPersona
                ? <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>
                    {(selectedPersona.name || '?').charAt(0).toUpperCase()}
                  </span>
                : <Building2 size={13} color="rgba(255,255,255,0.25)" />
            }
          </div>

          {/* Name + connection status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: selectedPersona ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.30)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {selectedPersona?.name || 'Selecionar conta'}
            </p>
            {selectedPersona && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: metaConnected ? '#22A3A3' : 'rgba(255,255,255,0.15)',
                  boxShadow: metaConnected ? '0 0 4px rgba(16,185,129,0.6)' : 'none',
                }} />
                <span style={{
                  fontSize: 10.5,
                  color: metaConnected ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {accountResolving
                    ? 'Conectando...'
                    : metaConnected
                      ? `Meta Ads conectado`
                      : 'Não conectado'}
                </span>
              </div>
            )}
          </div>

          <ChevronDown size={12} color="rgba(255,255,255,0.20)"
            style={{ flexShrink: 0, transform: accountsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
        </button>

        {/* Dropdown: personas + Meta ad accounts */}
        {accountsOpen && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: 2, paddingBottom: 2,
          }}>
            {/* Persona switcher (if multiple) */}
            {savedPersonas.length > 1 && (
              <>
                <div style={{ padding: '6px 14px 3px', fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: F }}>
                  Marcas
                </div>
                {savedPersonas.map(p => {
                  const isActive = p.id === selectedPersona?.id;
                  return (
                    <button key={p.id}
                      onClick={() => {
                        setSelectedPersona(p);
                        setAccountsOpen(false);
                        setMobileOpen(false);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: F,
                        transition: 'background 0.1s', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0, overflow: 'hidden',
                        background: p.logo_url ? 'rgba(255,255,255,0.06)' : avatarGradient(p.name || '?'),
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {p.logo_url
                          ? <img src={p.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                              {(p.name || '?').charAt(0).toUpperCase()}
                            </span>
                        }
                      </div>
                      <span style={{
                        flex: 1, fontSize: 12, fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.50)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#22A3A3', letterSpacing: '0.06em' }}>ATIVO</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* Meta ad accounts switcher (if multiple) */}
            {activeAccount && activeAccount.allAccounts.length > 1 && (
              <>
                <div style={{ padding: '8px 14px 3px', fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: F }}>
                  Contas de anúncio
                </div>
                {activeAccount.allAccounts.map(adAcc => {
                  const isActive = adAcc.id === activeAccount.metaAccountId;
                  return (
                    <button key={adAcc.id}
                      onClick={async () => {
                        if (!isActive && switchAccount) {
                          await switchAccount(adAcc.id);
                        }
                        setAccountsOpen(false);
                        setMobileOpen(false);
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 14px', background: isActive ? 'rgba(14,165,233,0.08)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: F,
                        transition: 'background 0.1s', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? '#0ea5e9' : 'rgba(255,255,255,0.12)',
                      }} />
                      <span style={{
                        flex: 1, fontSize: 11.5, fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {adAcc.name || adAcc.id}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

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
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={9} color="rgba(255,255,255,0.30)" />
              </div>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.30)' }}>
                Gerenciar contas
              </span>
            </button>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0 0' }} />
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 8 }}>
        <SectionHeader label="Copilot" />
        <nav>
          {getNavItems(language).map(item => (
            <NavItem
              key={item.url}
              url={item.url}
              label={item.label}
              icon={item.icon}
              isActive={isAt(item.url)}
              badge={item.badge}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </nav>
      </div>

      {/* Footer — CreditBar + Referral + Logout */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 0 4px' }} />
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
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
          <LogOut size={14} strokeWidth={1.5} color="rgba(255,255,255,0.30)" />
          <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.40)' }}>
            Sair
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#060709' }}>
      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          height: 52, background: '#060709',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', padding: '0 12px',
          fontFamily: F,
        }}>
          <button onClick={() => setMobileOpen(true)}
            style={{
              background: 'none', border: 'none', padding: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Menu size={20} color="rgba(255,255,255,0.60)" />
          </button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Logo size="md" />
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
        width: 216,
        height: '100%',
        background: '#060709',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        fontFamily: F, overflow: 'hidden',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 99,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: mobileOpen ? '8px 0 32px rgba(0,0,0,0.5)' : 'none',
        } : {}),
      }}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, overflow: 'auto', background: '#060709',
        ...(isMobile ? { paddingTop: 52 } : {}),
      }}>
        {profile ? (
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
            // v2: active account resolution
            activeAccount,
            metaConnected,
            accountResolving,
          } satisfies DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#0ea5e9', animation: 'spin 0.8s linear infinite' }} />
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
