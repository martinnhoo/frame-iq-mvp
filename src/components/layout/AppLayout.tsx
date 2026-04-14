// AppLayout — Simplified v2 sidebar, styled to match existing DashboardSidebar theme
import { useState } from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import {
  Activity,
  Clock,
  TrendingUp,
  Sparkles,
  Settings,
  LogOut,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

// ── Section header — matches DashboardSidebar SectionHeader exactly ─────
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
  { url: '/dashboard/feed',     label: 'Feed',      icon: Activity,    badge: 'NEW' },
  { url: '/dashboard/history',  label: 'Histórico', icon: Clock },
  { url: '/dashboard/patterns', label: 'Padrões',   icon: TrendingUp },
  { url: '/dashboard/create',   label: 'Criar',     icon: Sparkles },
  { url: '/dashboard/settings', label: 'Config',    icon: Settings },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

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
        {/* Logo — exact same as DashboardSidebar */}
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

        {/* Footer */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '0 0 4px' }} />
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

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#060709' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
