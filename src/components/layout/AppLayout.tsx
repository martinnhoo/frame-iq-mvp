// AppLayout — Simplified v2 Copilot sidebar, provides DashboardContext for child pages
// Account selector at top (always visible), mobile hamburger menu
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { CreditBar } from '@/components/dashboard/CreditBar';
import { ReferralPopup } from '@/components/dashboard/ReferralPopup';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { useLanguage } from '@/i18n/LanguageContext';
import { useActiveAccount } from '@/hooks/useActiveAccount';
import type { DashboardContext, Profile, Usage, UsageDetails, ActivePersona } from '@/components/dashboard/DashboardLayout';
import type { User } from '@supabase/supabase-js';
import {
  Activity,
  Clock,
  TrendingUp,
  Sparkles,
  Settings,
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
        color: isActive ? '#fff' : hov ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.50)',
        background: isActive
          ? 'rgba(255,255,255,0.10)'
          : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none',
        fontSize: 13.5, fontWeight: isActive ? 600 : 400,
        textDecoration: 'none', transition: 'all 0.15s',
        fontFamily: F, letterSpacing: '-0.01em',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <Icon size={16} strokeWidth={1.5} style={{
        color: isActive ? '#0da2e7' : 'rgba(255,255,255,0.30)',
        flexShrink: 0, transition: 'color 0.15s',
      }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.40)',
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
        fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
        fontFamily: F,
      }}>
        {label}
      </p>
    </div>
  );
}

const NAV_ITEMS = [
  { url: '/dashboard/feed',        label: 'Feed',        icon: Activity,    badge: 'IA' },
  { url: '/dashboard/history',     label: 'Histórico',   icon: Clock },
  { url: '/dashboard/performance', label: 'Padrões',     icon: TrendingUp },
  { url: '/dashboard/criar',      label: 'Criar',       icon: Sparkles },
  { url: '/dashboard/settings',   label: 'Config',      icon: Settings },
];

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
  const [selectedPersona, setSelectedPersonaState] = useState<ActivePersona | null>(() => {
    try {
      const s = storage.get('frameiq_active_persona');
      if (!s) return null;
      const parsed = JSON.parse(s);
      if (!parsed?.id || !parsed?.name) return null;
      return parsed;
    } catch { return null; }
  });

  const setSelectedPersona = (p: ActivePersona | null) => {
    setSelectedPersonaState(p);
    try {
      if (p) storage.setJSON('frameiq_active_persona', p);
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

      // Load saved personas
      const { data: personas } = await (supabase as any)
        .from('personas')
        .select('id, name, logo_url, website, description, preferred_market, industry')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (mounted && personas?.length) {
        setSavedPersonas(personas);
        const stored = selectedPersona;
        if (!stored || !personas.find((p: any) => p.id === stored.id)) {
          setSelectedPersona(personas[0]);
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
    await supabase.auth.signOut();
    navigate('/login');
  };

  const plan = (profile as any)?.plan || 'free';

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060709' }}>
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
          onClick={() => savedPersonas.length > 1 ? setAccountsOpen(o => !o) : navigate('/dashboard/accounts')}
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
            background: selectedPersona ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {selectedPersona?.logo_url
              ? <img src={selectedPersona.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : selectedPersona
                ? <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
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
                  background: metaConnected ? '#10b981' : 'rgba(255,255,255,0.15)',
                  boxShadow: metaConnected ? '0 0 4px rgba(16,185,129,0.6)' : 'none',
                }} />
                <span style={{ fontSize: 10.5, color: metaConnected ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)' }}>
                  {accountResolving ? 'Conectando...' : metaConnected ? 'Conectado' : 'Não conectado'}
                </span>
              </div>
            )}
          </div>

          {savedPersonas.length > 1 && (
            <ChevronDown size={12} color="rgba(255,255,255,0.20)"
              style={{ flexShrink: 0, transform: accountsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }} />
          )}
        </button>

        {/* Account dropdown */}
        {accountsOpen && savedPersonas.length > 1 && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: 2, paddingBottom: 2,
          }}>
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
                    padding: '6px 14px', background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: F,
                    transition: 'background 0.1s', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {p.logo_url
                      ? <img src={p.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                          {(p.name || '?').charAt(0).toUpperCase()}
                        </span>
                    }
                  </div>
                  <span style={{
                    flex: 1, fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.50)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#10b981', letterSpacing: '0.06em' }}>
                      ATIVO
                    </span>
                  )}
                </button>
              );
            })}
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
                width: 22, height: 22, borderRadius: 6,
                background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={10} color="rgba(255,255,255,0.30)" />
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
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
          {NAV_ITEMS.map(item => (
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
    </div>
  );
}

export default AppLayout;
