// AppLayout — Simplified v2 Copilot sidebar, provides DashboardContext for child pages
import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { CreditBar } from '@/components/dashboard/CreditBar';
import { ReferralPopup } from '@/components/dashboard/ReferralPopup';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { useLanguage } from '@/i18n/LanguageContext';
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
} from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";

// ── Nav item — matches DashboardSidebar NavItem exactly ─────────────────
function NavItem({ url, label, icon: Icon, isActive, badge }: {
  url: string; label: string; icon: React.ElementType;
  isActive: boolean; badge?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <NavLink to={url}
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
  { url: '/dashboard/feed',     label: 'Feed',      icon: Activity,    badge: 'IA' },
  { url: '/dashboard/history',  label: 'Histórico', icon: Clock },
  { url: '/dashboard/performance', label: 'Padrões', icon: TrendingUp },
  { url: '/dashboard/ai',      label: 'Criar',     icon: Sparkles },
  { url: '/dashboard/settings', label: 'Config',    icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  // ── Auth + profile state (same as DashboardLayout) ──
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

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#060709' }}>
      {/* Sidebar */}
      <aside style={{
        width: 216, height: '100%',
        background: '#060709',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        fontFamily: F, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <Logo size="md" />
          </button>
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
              />
            ))}
          </nav>
        </div>

        {/* Footer — CreditBar + Referral + Logout */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 0 4px' }} />

          {/* Credit usage bar */}
          <CreditBar userId={user?.id} plan={plan} />

          {/* Referral */}
          <ReferralPopup userId={user?.id} />

          {/* Logout */}
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
      </aside>

      {/* Main content — provides DashboardContext so all existing pages work */}
      <main style={{ flex: 1, overflow: 'auto', background: '#060709' }}>
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
          } satisfies DashboardContext} />
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
