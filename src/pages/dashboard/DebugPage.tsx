/**
 * DebugPage — Internal diagnostics for AdBrief owner
 *
 * Shows at /dashboard/debug:
 * - Auth & profile state
 * - Active persona & Meta connection status
 * - Last sync timestamps
 * - Edge function health checks
 * - Recent error logs
 * - Build info
 * - Custom events log (live)
 *
 * Only accessible to the owner email.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  Activity, CheckCircle2, XCircle, Clock, RefreshCw, Loader2,
  Wifi, WifiOff, Database, Zap, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';

const F = "'Plus Jakarta Sans', sans-serif";
const OWNER_EMAILS = ['martinhovff@gmail.com'];
const BUILD_TIME = import.meta.env.VITE_BUILD_TIME || 'dev';
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || 'local';

// ── Types ────────────────────────────────────────────────────────────────────
interface Check {
  label: string;
  status: 'ok' | 'warn' | 'error' | 'loading' | 'idle';
  detail?: string;
  ts?: string;
}

interface EventEntry {
  type: string;
  detail: string;
  ts: string;
}

// ── Status colors ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  ok: '#22c55e',
  warn: '#eab308',
  error: '#ef4444',
  loading: '#0ea5e9',
  idle: 'rgba(255,255,255,0.25)',
};

const StatusDot = ({ status }: { status: string }) => (
  <div style={{
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
    background: STATUS_COLOR[status] || STATUS_COLOR.idle,
    boxShadow: status === 'ok' ? `0 0 6px ${STATUS_COLOR.ok}40` : 'none',
  }} />
);

const StatusIcon = ({ status }: { status: string }) => {
  const color = STATUS_COLOR[status] || STATUS_COLOR.idle;
  const size = 14;
  if (status === 'ok') return <CheckCircle2 size={size} color={color} />;
  if (status === 'error') return <XCircle size={size} color={color} />;
  if (status === 'warn') return <AlertTriangle size={size} color={color} />;
  if (status === 'loading') return <Loader2 size={size} color={color} className="animate-spin" />;
  return <Clock size={size} color={color} />;
};

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: F,
      }}>
        <Icon size={14} color="rgba(255,255,255,0.45)" />
        <span style={{ flex: 1, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.70)', letterSpacing: '-0.01em' }}>
          {title}
        </span>
        {open
          ? <ChevronDown size={12} color="rgba(255,255,255,0.25)" />
          : <ChevronRight size={12} color="rgba(255,255,255,0.25)" />
        }
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Check row ────────────────────────────────────────────────────────────────
function CheckRow({ check }: { check: Check }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
      borderBottom: '1px solid rgba(255,255,255,0.03)',
    }}>
      <StatusIcon status={check.status} />
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: F, flex: 1 }}>
        {check.label}
      </span>
      {check.detail && (
        <span style={{
          fontSize: 10.5, color: STATUS_COLOR[check.status] || 'rgba(255,255,255,0.35)',
          fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {check.detail}
        </span>
      )}
      {check.ts && (
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
          {check.ts}
        </span>
      )}
    </div>
  );
}

// ── KV row (key-value) ──────────────────────────────────────────────────────
function KV({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontFamily: F, minWidth: 120 }}>{label}</span>
      <span style={{
        fontSize: 11, color: value ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.20)',
        fontFamily: mono ? 'monospace' : F, wordBreak: 'break-all',
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function DebugPage() {
  const ctx = useOutletContext<DashboardContext>();
  const { user, selectedPersona, profile } = ctx || {};

  const [checks, setChecks] = useState<Check[]>([]);
  const [edgeFnChecks, setEdgeFnChecks] = useState<Check[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [metaInfo, setMetaInfo] = useState<Record<string, any>>({});
  const [syncInfo, setSyncInfo] = useState<Record<string, any>>({});
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Gate: only owner can see this page
  const isOwner = user?.email && OWNER_EMAILS.includes(user.email);

  // ── Live event logger ──────────────────────────────────────────────────────
  useEffect(() => {
    const tracked = ['meta-account-changed', 'persona-updated', 'meta-oauth-complete'];
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const entry: EventEntry = {
        type: ce.type,
        detail: JSON.stringify(ce.detail || {}),
        ts: new Date().toLocaleTimeString(),
      };
      eventsRef.current = [entry, ...eventsRef.current].slice(0, 50);
      setEvents([...eventsRef.current]);
    };
    tracked.forEach(t => window.addEventListener(t, handler));
    return () => tracked.forEach(t => window.removeEventListener(t, handler));
  }, []);

  // ── Run all checks ─────────────────────────────────────────────────────────
  const runChecks = useCallback(async () => {
    if (!user) return;
    setRunning(true);

    const results: Check[] = [];
    const edgeResults: Check[] = [];

    // 1. Auth check
    const { data: { session } } = await supabase.auth.getSession();
    results.push({
      label: 'Auth session',
      status: session ? 'ok' : 'error',
      detail: session ? `Expires ${new Date(session.expires_at! * 1000).toLocaleTimeString()}` : 'No session',
    });

    // 2. Profile check
    results.push({
      label: 'Profile loaded',
      status: profile ? 'ok' : 'warn',
      detail: profile ? `Plan: ${(profile as any).plan || 'free'}` : 'No profile',
    });

    // 3. Persona check
    results.push({
      label: 'Active persona',
      status: selectedPersona ? 'ok' : 'warn',
      detail: selectedPersona ? `${selectedPersona.name} (${selectedPersona.id?.slice(0, 8)})` : 'None selected',
    });

    // 4. Meta connection
    try {
      const { data: connData } = await supabase.functions.invoke('meta-oauth', {
        body: { action: 'get_connections', user_id: user.id },
      });
      const connections = connData?.connections || [];
      const metaConn = connections.find((c: any) => c.platform === 'meta' && c.status === 'active');
      if (metaConn) {
        const ads = metaConn.ad_accounts || [];
        const adCount = ads.length;
        // Effective selected: DB → localStorage → first account (same logic as useActiveAccount)
        const dbSel = metaConn.selected_account_id;
        const lsSel = metaConn.persona_id ? localStorage.getItem(`meta_sel_${metaConn.persona_id}`) : null;
        const effectiveSel = dbSel || lsSel || ads[0]?.id || 'none';
        const selSource = dbSel ? 'db' : lsSel ? 'localStorage' : ads[0]?.id ? 'fallback[0]' : 'none';
        setMetaInfo({
          status: 'active',
          adAccounts: adCount,
          selectedId: `${effectiveSel} (${selSource})`,
          tokenExpiry: metaConn.token_expires_at || 'unknown',
          personaId: metaConn.persona_id,
        });
        results.push({
          label: 'Meta Ads connection',
          status: 'ok',
          detail: `${adCount} ad account(s), selected: ${effectiveSel.slice(0, 15)}`,
        });
      } else {
        setMetaInfo({ status: 'disconnected' });
        results.push({ label: 'Meta Ads connection', status: 'warn', detail: 'Not connected' });
      }
    } catch (err: any) {
      results.push({ label: 'Meta Ads connection', status: 'error', detail: err.message });
    }

    // 5. Ad accounts (v2)
    try {
      const { data: adAccounts, error } = await (supabase as any)
        .from('ad_accounts')
        .select('id, meta_account_id, name, status, last_full_sync_at, last_fast_sync_at, total_ads_synced, total_spend_30d')
        .eq('user_id', user.id);
      if (error) throw error;
      const accounts = adAccounts || [];
      results.push({
        label: 'Ad accounts (v2)',
        status: accounts.length > 0 ? 'ok' : 'warn',
        detail: `${accounts.length} account(s)`,
      });
      if (accounts.length > 0) {
        const latest = accounts[0];
        setSyncInfo({
          lastSync: latest.last_full_sync_at || latest.last_fast_sync_at,
          totalAds: latest.total_ads_synced,
          spend30d: latest.total_spend_30d,
          accountName: latest.name,
        });
      }
    } catch (err: any) {
      results.push({ label: 'Ad accounts (v2)', status: 'error', detail: err.message });
    }

    // 6. Last sync check (ad_metrics)
    try {
      const { data: latestMetric } = await (supabase as any)
        .from('ad_metrics')
        .select('date, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestMetric) {
        const daysSince = Math.floor((Date.now() - new Date(latestMetric.date).getTime()) / 86400000);
        results.push({
          label: 'Last ad_metrics sync',
          status: daysSince <= 1 ? 'ok' : daysSince <= 3 ? 'warn' : 'error',
          detail: `${latestMetric.date} (${daysSince}d ago)`,
          ts: latestMetric.created_at ? new Date(latestMetric.created_at).toLocaleString() : undefined,
        });
      } else {
        results.push({ label: 'Last ad_metrics sync', status: 'warn', detail: 'No data yet' });
      }
    } catch (err: any) {
      results.push({ label: 'Last ad_metrics sync', status: 'error', detail: err.message });
    }

    // 7. Decisions check
    try {
      const { count } = await (supabase as any)
        .from('decisions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      results.push({
        label: 'Decisions generated',
        status: (count || 0) > 0 ? 'ok' : 'warn',
        detail: `${count || 0} total`,
      });
    } catch (err: any) {
      results.push({ label: 'Decisions', status: 'error', detail: err.message });
    }

    // 8. Personas count
    try {
      const { count } = await (supabase as any)
        .from('personas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      results.push({
        label: 'Personas / Accounts',
        status: (count || 0) > 0 ? 'ok' : 'warn',
        detail: `${count || 0} account(s)`,
      });
    } catch (err: any) {
      results.push({ label: 'Personas', status: 'error', detail: err.message });
    }

    setChecks(results);

    // ── Edge function health checks ──────────────────────────────────────────
    const fns = [
      { name: 'check-usage', body: { user_id: user.id } },
      { name: 'meta-oauth', body: { action: 'get_connections', user_id: user.id } },
    ];

    for (const fn of fns) {
      edgeResults.push({ label: fn.name, status: 'loading', detail: 'Checking…' });
      setEdgeFnChecks([...edgeResults]);
      try {
        const start = Date.now();
        const { error } = await supabase.functions.invoke(fn.name, { body: fn.body });
        const ms = Date.now() - start;
        edgeResults[edgeResults.length - 1] = {
          label: fn.name,
          status: error ? 'error' : ms > 5000 ? 'warn' : 'ok',
          detail: error ? error.message : `${ms}ms`,
        };
      } catch (err: any) {
        edgeResults[edgeResults.length - 1] = {
          label: fn.name, status: 'error', detail: err.message,
        };
      }
      setEdgeFnChecks([...edgeResults]);
    }

    // ── Error logs (if table exists) ─────────────────────────────────────────
    try {
      const { data: logs } = await (supabase as any)
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setErrorLogs(logs || []);
    } catch {
      // Table may not exist yet
      setErrorLogs([]);
    }

    setRunning(false);
  }, [user, selectedPersona, profile]);

  // Auto-run on mount
  useEffect(() => {
    if (user && isOwner) {
      const timer = setTimeout(runChecks, 300);
      return () => clearTimeout(timer);
    }
  }, [user, isOwner]);

  // ── Gate ────────────────────────────────────────────────────────────────────
  if (!isOwner) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: F }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Access restricted.</p>
      </div>
    );
  }

  const okCount = checks.filter(c => c.status === 'ok').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const errCount = checks.filter(c => c.status === 'error').length;

  return (
    <div style={{
      maxWidth: 680, margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)',
      fontFamily: F, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Activity size={18} color="#0ea5e9" />
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          Diagnóstico
        </h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={runChecks}
          disabled={running}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, cursor: running ? 'wait' : 'pointer', fontFamily: F,
            fontSize: 11, color: 'rgba(255,255,255,0.6)', transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
          {running ? 'A verificar…' : 'Re-verificar'}
        </button>
      </div>

      {/* Summary bar */}
      {checks.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, padding: '8px 14px',
          background: 'rgba(255,255,255,0.03)', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 11, color: STATUS_COLOR.ok }}>✓ {okCount} ok</span>
          {warnCount > 0 && <span style={{ fontSize: 11, color: STATUS_COLOR.warn }}>⚠ {warnCount} warn</span>}
          {errCount > 0 && <span style={{ fontSize: 11, color: STATUS_COLOR.error }}>✕ {errCount} error</span>}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)', fontFamily: 'monospace' }}>
            Build: {BUILD_SHA.slice(0, 7)} · {BUILD_TIME}
          </span>
        </div>
      )}

      {/* System checks */}
      <Section title="System Checks" icon={Wifi}>
        {checks.length === 0 && !running && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0' }}>
            Clique "Re-verificar" para iniciar.
          </p>
        )}
        {checks.map((c, i) => <CheckRow key={i} check={c} />)}
      </Section>

      {/* Meta connection details */}
      {Object.keys(metaInfo).length > 0 && (
        <Section title="Meta Ads" icon={Zap}>
          <KV label="Status" value={metaInfo.status} />
          <KV label="Ad accounts" value={String(metaInfo.adAccounts || 0)} />
          <KV label="Selected ID" value={metaInfo.selectedId} mono />
          <KV label="Persona ID" value={metaInfo.personaId} mono />
          <KV label="Token expiry" value={metaInfo.tokenExpiry} />
        </Section>
      )}

      {/* Sync info */}
      {Object.keys(syncInfo).length > 0 && (
        <Section title="Sync Status" icon={Database}>
          <KV label="Account" value={syncInfo.accountName} />
          <KV label="Last sync" value={syncInfo.lastSync ? new Date(syncInfo.lastSync).toLocaleString() : 'Never'} />
          <KV label="Total ads synced" value={String(syncInfo.totalAds || 0)} />
          <KV label="Spend (30d)" value={syncInfo.spend30d != null ? `R$${Number(syncInfo.spend30d).toFixed(2)}` : '—'} />
        </Section>
      )}

      {/* Edge functions */}
      <Section title="Edge Functions" icon={Zap}>
        {edgeFnChecks.length === 0 && !running && (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0' }}>
            Verificar para testar edge functions.
          </p>
        )}
        {edgeFnChecks.map((c, i) => <CheckRow key={i} check={c} />)}
      </Section>

      {/* Context info */}
      <Section title="Context" icon={Database} defaultOpen={false}>
        <KV label="User ID" value={user?.id} mono />
        <KV label="Email" value={user?.email} />
        <KV label="Plan" value={(profile as any)?.plan || 'free'} />
        <KV label="Persona" value={selectedPersona?.name} />
        <KV label="Persona ID" value={selectedPersona?.id} mono />
        <KV label="Language" value={navigator.language} />
        <KV label="Screen" value={`${window.innerWidth}×${window.innerHeight}`} />
        <KV label="User Agent" value={navigator.userAgent.slice(0, 80)} />
      </Section>

      {/* Error logs */}
      <Section title={`Error Logs (${errorLogs.length})`} icon={AlertTriangle} defaultOpen={false}>
        {errorLogs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0' }}>
            Nenhum erro registado.
          </p>
        ) : (
          errorLogs.map((log, i) => (
            <div key={i} style={{
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.55)',
            }}>
              <div style={{ color: STATUS_COLOR.error, fontWeight: 600, marginBottom: 2 }}>
                {log.error_type || 'error'}: {log.message?.slice(0, 100)}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                {log.component} · {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
              </div>
            </div>
          ))
        )}
      </Section>

      {/* Live events */}
      <Section title={`Live Events (${events.length})`} icon={Activity} defaultOpen={false}>
        {events.length === 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0' }}>
            Nenhum evento capturado nesta sessão. Interaja com o app para ver eventos.
          </p>
        ) : (
          events.map((ev, i) => (
            <div key={i} style={{
              display: 'flex', gap: 8, padding: '3px 0',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <span style={{ fontSize: 10, color: '#0ea5e9', fontFamily: 'monospace', minWidth: 60 }}>{ev.ts}</span>
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{ev.type}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.detail}
              </span>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
