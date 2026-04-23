/**
 * CockpitLayout — the privileged backoffice shell.
 *
 * Responsibilities:
 *   1. Gate access via the `admin-check` edge function. Non-admins get a 404-
 *      style screen so the endpoint/route can't be used to enumerate admins.
 *   2. Inject `<meta name="robots" content="noindex,nofollow">` so the path
 *      stays out of search engines.
 *   3. Provide a minimal dark sidebar (Overview / Users / Audit / System).
 *   4. Display the signed-in admin email + a sign-out escape hatch that
 *      routes back to the main dashboard (not logging out).
 *
 * This layout is intentionally different from AppLayout — no persona, no
 * account switcher, no credit bar. Cockpit is a different product surface.
 */

import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, NavLink, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  LayoutDashboard,
  Users,
  ScrollText,
  ShieldCheck,
  ArrowLeft,
  Menu,
  X,
  Command,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CommandPalette, MONO, useHotkey } from './_shared';

const F = "'Plus Jakarta Sans', sans-serif";
const MOBILE_BP = 768;

type GateState =
  | { status: 'checking' }
  | { status: 'anon' }                              // not signed in
  | { status: 'ok'; email: string }
  | { status: 'denied' };

function useCockpitGate(): GateState {
  const [state, setState] = useState<GateState>({ status: 'checking' });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      // 1. Need a session.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) setState({ status: 'anon' });
        return;
      }

      // 2. Ask the edge function.
      try {
        const { data, error } = await supabase.functions.invoke('admin-check', {});
        if (!mounted) return;
        if (error) {
          setState({ status: 'denied' });
          return;
        }
        if (data?.admin) {
          setState({ status: 'ok', email: data.email ?? session.user.email ?? '' });
        } else {
          setState({ status: 'denied' });
        }
      } catch {
        if (mounted) setState({ status: 'denied' });
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  return state;
}

function NavItem({ url, label, icon: Icon, end }: {
  url: string; label: string; icon: React.ElementType; end?: boolean;
}) {
  return (
    <NavLink
      to={url}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px 9px 16px', margin: '1px 8px',
        borderRadius: 9, textDecoration: 'none',
        color: isActive ? '#F1F5F9' : '#94A3B8',
        background: isActive
          ? 'linear-gradient(135deg, rgba(37,99,235,0.14), rgba(6,182,212,0.07))'
          : 'transparent',
        fontSize: 13.5, fontWeight: isActive ? 600 : 450,
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        fontFamily: F, letterSpacing: '-0.01em',
        boxShadow: isActive ? 'inset 4px 0 12px rgba(37,99,235,0.18)' : 'none',
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={isActive ? 2 : 1.5}
            color={isActive ? '#60A5FA' : '#64748B'} />
          <span style={{ flex: 1 }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function CockpitLayout() {
  const gate = useCockpitGate();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BP);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Live clock in the sidebar footer. Updates every 30s — enough for a
  // "what time is it for the system" signal without burning renders.
  // Visibility-aware: pauses while the cockpit tab is in the background
  // (admin panels often sit behind prod tabs for hours); resumes with
  // an immediate tick when the user returns so the clock is fresh.
  useEffect(() => {
    let id: number | undefined;
    const tick = () => setNow(new Date());
    const start = () => {
      if (id !== undefined) return;
      id = window.setInterval(tick, 30_000);
    };
    const stop = () => {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') { tick(); start(); }
      else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, []);

  // ⌘K / Ctrl-K opens the palette. Only wire when the gate is 'ok' so the
  // listener never fires on the 404/loading screens.
  useHotkey(
    (e) => gate.status === 'ok' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k',
    (e) => {
      e.preventDefault();
      setPaletteOpen((v) => !v);
    },
    [gate.status],
  );

  const headMeta = useMemo(() => (
    <Helmet>
      <title>Cockpit · adbrief</title>
      <meta name="robots" content="noindex,nofollow,noarchive,nosnippet" />
      <meta name="googlebot" content="noindex,nofollow" />
    </Helmet>
  ), []);

  // ── Loading ────────────────────────────────────────────────────────────
  if (gate.status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080C' }}>
        {headMeta}
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(148,163,184,0.10)', borderTopColor: '#2563EB', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Not signed in → push to login ──────────────────────────────────────
  if (gate.status === 'anon') {
    return <Navigate to="/login" replace />;
  }

  // ── Denied → 404-shaped page. No hint that cockpit exists. ─────────────
  if (gate.status === 'denied') {
    return (
      <>
        {headMeta}
        <div style={{
          minHeight: '100vh', background: '#060A14', color: '#E2E8F0',
          fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 72, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.04em' }}>404</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>Page not found</div>
            <div style={{ fontSize: 14, color: '#64748B', marginTop: 10, lineHeight: 1.6 }}>
              The page you're looking for doesn't exist, or has been moved.
            </div>
            <button
              onClick={() => navigate('/')}
              style={{
                marginTop: 22, padding: '10px 20px', borderRadius: 8,
                background: 'rgba(148,163,184,0.06)', color: '#CBD5E1',
                border: '1px solid rgba(148,163,184,0.12)', cursor: 'pointer',
                fontSize: 13, fontFamily: F, fontWeight: 500,
              }}
            >
              Back to adbrief
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── OK ──────────────────────────────────────────────────────────────────
  const isMac = typeof navigator !== 'undefined'
    ? /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    : true;

  const sidebar = (
    <>
      <div style={{
        height: 56, padding: '0 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(37,99,235,0.35)',
          }}>
            <ShieldCheck size={14} color="#fff" strokeWidth={2.25} />
          </div>
          <span style={{
            fontSize: 14, fontWeight: 700, color: '#F1F5F9',
            fontFamily: F, letterSpacing: '-0.01em',
          }}>
            Cockpit
          </span>
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
            <X size={18} color="#94A3B8" />
          </button>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(148,163,184,0.06)', margin: '2px 0 10px' }} />

      {/* Jump-to / command palette trigger */}
      <div style={{ padding: '0 8px 8px' }}>
        <button
          onClick={() => setPaletteOpen(true)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px 8px 12px', borderRadius: 8,
            background: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.10)',
            color: '#64748B', cursor: 'pointer',
            fontFamily: F, fontSize: 12,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37,99,235,0.40)';
            (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.10)';
            (e.currentTarget as HTMLElement).style.color = '#64748B';
          }}
        >
          <Command size={12} strokeWidth={1.75} />
          <span style={{ flex: 1, textAlign: 'left' }}>Jump to…</span>
          <kbd style={{
            padding: '1px 5px', borderRadius: 4,
            background: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.14)',
            fontFamily: MONO, fontSize: 10,
          }}>
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>
      </div>

      <div style={{
        padding: '0 16px 4px', fontSize: 10,
        color: '#334155', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
      }}>
        Sections
      </div>
      <nav style={{ flex: 1, paddingTop: 2 }}>
        <NavItem url="/cockpit" label="Overview" icon={LayoutDashboard} end />
        <NavItem url="/cockpit/users" label="Users" icon={Users} />
        <NavItem url="/cockpit/audit" label="Audit log" icon={ScrollText} />
      </nav>

      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, background: 'rgba(148,163,184,0.06)', margin: '0 0 4px' }} />
        <div style={{ padding: '10px 16px 2px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Signed in as
          </div>
          <div style={{
            fontSize: 12, color: '#CBD5E1', marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {gate.email}
          </div>
          <div style={{
            fontSize: 10.5, color: '#475569', marginTop: 4,
            fontFamily: MONO,
          }}>
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{' '}
            · {now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '10px 14px 14px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: '100%', fontFamily: F,
          }}
        >
          <ArrowLeft size={14} strokeWidth={1.5} color="#64748B" />
          <span style={{ fontSize: 12.5, color: '#64748B' }}>Back to dashboard</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {headMeta}
      <div style={{ display: 'flex', height: '100vh', background: '#060A14' }}>
        {isMobile && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            height: 52, background: '#060A14',
            borderBottom: '1px solid rgba(148,163,184,0.06)',
            display: 'flex', alignItems: 'center', padding: '0 12px',
            fontFamily: F,
          }}>
            <button onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer' }}>
              <Menu size={18} color="#94A3B8" />
            </button>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
              <ShieldCheck size={13} color="#60A5FA" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>Cockpit</span>
            </div>
            <div style={{ width: 36 }} />
          </div>
        )}

        {isMobile && mobileOpen && (
          <div onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.60)' }} />
        )}

        <aside style={{
          width: 220,
          height: '100%',
          background: '#060A14',
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
          {sidebar}
        </aside>

        <main style={{
          flex: 1, overflow: 'auto', background: '#060A14',
          ...(isMobile ? { paddingTop: 52 } : {}),
        }}>
          <Outlet context={{
            adminEmail: gate.email,
            openPalette: () => setPaletteOpen(true),
          }} />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
