/**
 * CockpitUserDetail — exhaustive per-user view.
 *
 * Hydrated from the admin-user-summary edge function. Layout sections:
 *   1. Identity header (name, email, plan pill, flags)
 *   2. Anomalies banner
 *   3. Usage KPI tiles (chats, actions, decisions, upgrade gates)
 *   4. Meta ad accounts list
 *   5. AI intelligence (profile + top patterns)
 *   6. Billing panel (stripe ids, trial, period end)
 *   7. Timeline (last 50 merged events)
 *   8. Errors list
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, MessageSquare, Zap, TrendingUp, AlertTriangle,
  ExternalLink, Clock, Building2, Sparkles, CreditCard,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Plus Jakarta Sans', sans-serif";

interface Summary {
  identity: {
    user_id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    signup_at: string;
    email_confirmed: boolean;
    last_sign_in_at: string | null;
    last_ai_action_at: string | null;
    onboarding_data: any;
  };
  billing: {
    plan: string;
    subscription_status: string | null;
    stripe_customer_id: string | null;
    trial_end: string | null;
    current_period_end: string | null;
    plan_started_at: string | null;
  };
  ad_accounts: Array<{
    id: string; meta_account_id: string; name: string | null;
    currency: string | null; status: string | null;
    total_spend_30d: number | null; total_ads_synced: number | null;
    last_fast_sync_at: string | null; last_full_sync_at: string | null;
    last_deep_sync_at: string | null; created_at: string;
  }>;
  usage: {
    chats: { last_24h: number; last_7d: number; last_30d: number; all_time: number };
    actions_executed: {
      last_24h: number; last_7d: number; last_30d: number; all_time: number;
      by_type: Record<string, number>;
    };
    decisions: { total: number; acted: number; dismissed: number; pending: number; last24h: number; last7d: number };
    upgrade_gates_triggered: number;
  };
  credits: {
    current: { period: string; total_credits: number; used_credits: number; bonus_credits: number; updated_at: string } | null;
    recent_transactions: Array<{ action: string; credits: number; created_at: string; metadata: any }>;
  };
  free_usage: { chat_count: number; last_reset: string } | null;
  ai_intelligence: {
    profile: any;
    patterns_total: number;
    top_patterns: Array<{ pattern_key: string; avg_ctr: number | null; avg_roas: number | null; confidence: number; is_winner: boolean; insight_text: string; last_updated: string }>;
  };
  timeline: Array<{ kind: string; ts: string; summary: string; data: any }>;
  errors: Array<{ error_type: string; message: string; component: string | null; url: string | null; created_at: string }>;
  anomalies: Array<{ code: string; severity: 'info' | 'warn' | 'critical'; note: string }>;
}

function Card({ children, padding = 18 }: { children: React.ReactNode; padding?: number }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.40)',
      border: '1px solid rgba(148,163,184,0.08)',
      borderRadius: 12, padding, fontFamily: F,
    }}>
      {children}
    </div>
  );
}

export default function CockpitUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: res, error } = await supabase.functions.invoke('admin-user-summary', {
          body: { target_user_id: id },
        });
        if (!mounted) return;
        if (error) setErr(error.message);
        else if (res?.data) setData(res.data as Summary);
        else setErr('empty_response');
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'unknown');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: F, color: '#94A3B8' }}>Loading…</div>;
  }
  if (err || !data) {
    return (
      <div style={{ padding: 40, fontFamily: F }}>
        <button onClick={() => navigate('/cockpit/users')} style={backBtn}>
          <ChevronLeft size={14} /> Back
        </button>
        <div style={{ color: '#EF4444', marginTop: 16 }}>Failed to load user: {err ?? 'unknown'}</div>
      </div>
    );
  }

  const { identity, billing, ad_accounts, usage, credits, free_usage, ai_intelligence, timeline, errors, anomalies } = data;

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '28px 28px 60px', fontFamily: F, color: '#E2E8F0',
    }}>
      <button onClick={() => navigate('/cockpit/users')} style={backBtn}>
        <ChevronLeft size={14} /> Back to users
      </button>

      {/* Identity header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: 'rgba(148,163,184,0.08)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94A3B8', fontSize: 20, fontWeight: 600,
          border: '1px solid rgba(148,163,184,0.10)',
        }}>
          {identity.avatar_url
            ? <img src={identity.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (identity.name ?? identity.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#F1F5F9' }}>
            {identity.name || identity.email || '—'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{identity.email ?? '—'}</span>
            <span style={{ color: '#334155' }}>·</span>
            <span>ID {identity.user_id}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <PlanPill plan={billing.plan} />
            {billing.subscription_status && <SubPill status={billing.subscription_status} />}
            {identity.email_confirmed
              ? <MicroPill tone="success">email confirmed</MicroPill>
              : <MicroPill tone="warn">email unconfirmed</MicroPill>}
            <MicroPill tone="muted">
              signup {new Date(identity.signup_at).toLocaleDateString('pt-BR')}
            </MicroPill>
            {identity.last_sign_in_at && (
              <MicroPill tone="muted">
                last sign-in {relativeTime(identity.last_sign_in_at)}
              </MicroPill>
            )}
          </div>
        </div>
      </div>

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              padding: '10px 14px', borderRadius: 10,
              background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)'
                        : a.severity === 'warn' ? 'rgba(245,158,11,0.08)'
                        : 'rgba(37,99,235,0.06)',
              border: `1px solid ${
                a.severity === 'critical' ? 'rgba(239,68,68,0.25)'
                : a.severity === 'warn' ? 'rgba(245,158,11,0.22)'
                : 'rgba(37,99,235,0.22)'
              }`,
              display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
            }}>
              <AlertTriangle size={14}
                color={a.severity === 'critical' ? '#FCA5A5' : a.severity === 'warn' ? '#FCD34D' : '#93C5FD'} />
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{a.code}</span>
              <span style={{ color: '#94A3B8' }}>— {a.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Usage KPIs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 16,
      }}>
        <UsageKpi label="AI chats" icon={MessageSquare}
          value={usage.chats.all_time}
          breakdown={`24h ${usage.chats.last_24h} · 7d ${usage.chats.last_7d} · 30d ${usage.chats.last_30d}`} />
        <UsageKpi label="Actions executed" icon={Zap}
          value={usage.actions_executed.all_time}
          breakdown={`24h ${usage.actions_executed.last_24h} · 7d ${usage.actions_executed.last_7d}`} />
        <UsageKpi label="Decisions" icon={TrendingUp}
          value={usage.decisions.total}
          breakdown={`${usage.decisions.acted} acted · ${usage.decisions.dismissed} dismissed · ${usage.decisions.pending} pending`} />
        <UsageKpi label="Upgrade gates triggered" icon={Sparkles}
          value={usage.upgrade_gates_triggered} />
      </div>

      {/* Layout: 2 columns — main + side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Meta accounts */}
          <Card>
            <SectionHead icon={Building2} title={`Meta accounts (${ad_accounts.length})`} />
            {ad_accounts.length === 0 ? (
              <div style={{ color: '#64748B', fontSize: 13, padding: '12px 0' }}>No ad accounts connected.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ad_accounts.map(a => (
                  <div key={a.id} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>
                        {a.name || a.meta_account_id}
                      </div>
                      <StatusPill status={a.status ?? '—'} />
                    </div>
                    <div style={{ color: '#64748B', fontSize: 11.5 }}>
                      Meta ID {a.meta_account_id} · {a.currency ?? '—'} · spend 30d: {fmtMoney(a.total_spend_30d, a.currency)} · {a.total_ads_synced ?? 0} ads synced
                    </div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                      last sync {a.last_fast_sync_at ? relativeTime(a.last_fast_sync_at) : 'never'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* AI intelligence */}
          <Card>
            <SectionHead icon={Sparkles} title="AI intelligence" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 12 }}>
              <MiniStat label="Patterns" value={ai_intelligence.patterns_total} />
              <MiniStat label="Top winners" value={ai_intelligence.top_patterns.filter(p => p.is_winner).length} />
              <MiniStat label="Industry"
                value={ai_intelligence.profile?.industry || '—'} />
              <MiniStat label="Avg hook score"
                value={ai_intelligence.profile?.avg_hook_score != null ? Number(ai_intelligence.profile.avg_hook_score).toFixed(2) : '—'} />
            </div>
            {ai_intelligence.top_patterns.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ai_intelligence.top_patterns.map((p, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.06)', borderRadius: 8,
                    fontSize: 12.5,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      {p.is_winner && <span style={{ fontSize: 10.5, color: '#86EFAC', fontWeight: 700 }}>★</span>}
                      <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{p.pattern_key}</span>
                      <span style={{ color: '#64748B' }}>· conf {Number(p.confidence).toFixed(2)}</span>
                      {p.avg_ctr != null && <span style={{ color: '#64748B' }}>· CTR {(p.avg_ctr * 100).toFixed(2)}%</span>}
                      {p.avg_roas != null && <span style={{ color: '#64748B' }}>· ROAS {Number(p.avg_roas).toFixed(2)}</span>}
                    </div>
                    {p.insight_text && (
                      <div style={{ color: '#94A3B8', marginTop: 4 }}>{p.insight_text}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <SectionHead icon={Clock} title={`Recent activity (${timeline.length})`} />
            {timeline.length === 0 ? (
              <div style={{ color: '#64748B', fontSize: 13, padding: '12px 0' }}>No activity recorded.</div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {timeline.map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: i === timeline.length - 1 ? 'none' : '1px solid rgba(148,163,184,0.04)',
                  }}>
                    <TimelineDot kind={ev.kind} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#CBD5E1', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.summary}
                      </div>
                      <div style={{ color: '#475569', fontSize: 10.5, marginTop: 2 }}>
                        {ev.kind} · {relativeTime(ev.ts)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Errors */}
          {errors.length > 0 && (
            <Card>
              <SectionHead icon={AlertTriangle} title={`Client errors (${errors.length})`} tone="critical" />
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {errors.map((e, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.18)', borderRadius: 8, fontSize: 12,
                  }}>
                    <div style={{ color: '#FCA5A5', fontWeight: 600 }}>
                      {e.error_type} {e.component ? <span style={{ opacity: 0.65, fontWeight: 400 }}>@ {e.component}</span> : null}
                    </div>
                    <div style={{ color: '#CBD5E1', marginTop: 2 }}>{e.message}</div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      {e.url && (
                        <span style={{ marginRight: 8 }}>
                          <ExternalLink size={10} style={{ display: 'inline', marginRight: 3 }} />
                          {e.url}
                        </span>
                      )}
                      {relativeTime(e.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Billing */}
          <Card>
            <SectionHead icon={CreditCard} title="Billing" />
            <Row label="Plan" value={billing.plan} />
            <Row label="Status" value={billing.subscription_status ?? '—'} />
            <Row label="Stripe customer" value={billing.stripe_customer_id ?? '—'} mono />
            <Row label="Plan started" value={billing.plan_started_at ? shortDate(billing.plan_started_at) : '—'} />
            <Row label="Period end" value={billing.current_period_end ? shortDate(billing.current_period_end) : '—'} />
            <Row label="Trial end" value={billing.trial_end ? shortDate(billing.trial_end) : '—'} />
          </Card>

          {/* Credits */}
          <Card>
            <SectionHead icon={Sparkles} title="Credits" />
            {credits.current ? (
              <>
                <Row label="Period" value={credits.current.period} />
                <Row label="Used / Total" value={`${credits.current.used_credits} / ${credits.current.total_credits}`} />
                <Row label="Bonus" value={String(credits.current.bonus_credits ?? 0)} />
                <Row label="Updated" value={relativeTime(credits.current.updated_at)} />
              </>
            ) : (
              <div style={{ color: '#64748B', fontSize: 12, padding: '6px 0' }}>No credit record.</div>
            )}
            {free_usage && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                <Row label="Free-tier chats" value={String(free_usage.chat_count)} />
                <Row label="Last reset" value={shortDate(free_usage.last_reset)} />
              </div>
            )}
          </Card>

          {/* Actions by type */}
          {Object.keys(usage.actions_executed.by_type).length > 0 && (
            <Card>
              <SectionHead icon={Zap} title="Actions by type" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(usage.actions_executed.by_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, n]) => (
                    <div key={type} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '5px 0',
                      borderBottom: '1px solid rgba(148,163,184,0.04)', fontSize: 12.5,
                    }}>
                      <span style={{ color: '#CBD5E1' }}>{type}</span>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>{n}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* Onboarding snapshot */}
          {identity.onboarding_data && (
            <Card>
              <SectionHead icon={Building2} title="Onboarding data" />
              <pre style={{
                margin: 0, fontSize: 11, color: '#94A3B8',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 220, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}>
                {JSON.stringify(identity.onboarding_data, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────────
const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 8,
  background: 'rgba(15,23,42,0.70)',
  border: '1px solid rgba(148,163,184,0.10)',
  color: '#94A3B8', fontSize: 12,
  cursor: 'pointer', fontFamily: F,
};

function SectionHead({ icon: Icon, title, tone = 'default' }: {
  icon: React.ElementType; title: string; tone?: 'default' | 'critical';
}) {
  const color = tone === 'critical' ? '#FCA5A5' : '#60A5FA';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={14} color={color} />
      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{title}</div>
    </div>
  );
}

function UsageKpi({ label, value, breakdown, icon: Icon }: {
  label: string; value: number | string; breakdown?: string; icon: React.ElementType;
}) {
  return (
    <Card padding={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <Icon size={12} color="#60A5FA" />
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>{value}</div>
      {breakdown && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{breakdown}</div>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: '1px solid rgba(148,163,184,0.04)', fontSize: 12.5,
      gap: 10,
    }}>
      <span style={{ color: '#64748B', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: '#CBD5E1', fontWeight: 500,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : F,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    free:   { bg: 'rgba(148,163,184,0.08)', fg: '#94A3B8' },
    maker:  { bg: 'rgba(6,182,212,0.10)',   fg: '#67E8F9' },
    creator:{ bg: 'rgba(6,182,212,0.10)',   fg: '#67E8F9' },
    pro:    { bg: 'rgba(37,99,235,0.14)',   fg: '#93C5FD' },
    starter:{ bg: 'rgba(37,99,235,0.14)',   fg: '#93C5FD' },
    studio: { bg: 'rgba(168,85,247,0.14)',  fg: '#D8B4FE' },
    scale:  { bg: 'rgba(168,85,247,0.14)',  fg: '#D8B4FE' },
  };
  const c = colors[plan] ?? colors.free;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 10.5, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {plan}
    </span>
  );
}
function SubPill({ status }: { status: string }) {
  const color = status === 'past_due' ? '#FCA5A5'
              : status === 'active' ? '#86EFAC'
              : status === 'trialing' ? '#FCD34D'
              : '#94A3B8';
  return <MicroPill tone="raw" color={color}>{status}</MicroPill>;
}
function StatusPill({ status }: { status: string }) {
  const color = status === 'connected' ? '#86EFAC'
              : status === 'disconnected' ? '#FCA5A5'
              : '#94A3B8';
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 999,
      background: `${color}15`, color,
      fontSize: 10.5, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {status}
    </span>
  );
}
function MicroPill({ children, tone, color }: {
  children: React.ReactNode;
  tone: 'success' | 'warn' | 'muted' | 'raw';
  color?: string;
}) {
  const map = {
    success: { bg: 'rgba(34,197,94,0.10)', fg: '#86EFAC' },
    warn:    { bg: 'rgba(245,158,11,0.10)', fg: '#FCD34D' },
    muted:   { bg: 'rgba(148,163,184,0.08)', fg: '#94A3B8' },
    raw:     { bg: `${color ?? '#94A3B8'}15`, fg: color ?? '#94A3B8' },
  }[tone];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999,
      background: map.bg, color: map.fg,
      fontSize: 10.5, fontWeight: 500,
    }}>
      {children}
    </span>
  );
}
function TimelineDot({ kind }: { kind: string }) {
  const color = kind === 'chat' ? '#60A5FA'
              : kind === 'action' ? '#22C55E'
              : kind === 'decision' ? '#A78BFA'
              : kind === 'upgrade_event' ? '#FCD34D'
              : '#94A3B8';
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', background: color,
      marginTop: 7, flexShrink: 0, boxShadow: `0 0 8px ${color}70`,
    }} />
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short', day: 'numeric' });
}
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return shortDate(iso);
}
function fmtMoney(v: number | null, currency: string | null): string {
  if (v == null) return '—';
  const cur = (currency ?? 'BRL').toUpperCase();
  if (cur === 'BRL') return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${cur} ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
