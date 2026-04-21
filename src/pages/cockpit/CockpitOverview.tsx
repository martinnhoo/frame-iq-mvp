/**
 * CockpitOverview — the business dashboard. Renders everything returned by
 * the `admin-metrics-overview` edge function: KPIs, signup trend, plan
 * distribution, subscription health, engagement, and AI intelligence.
 *
 * Everything on this page is read-only. Any write action happens from the
 * Users / UserDetail pages (dedicated, audited actions).
 */

import { useEffect, useState } from 'react';
import {
  TrendingUp, Users, Activity, DollarSign,
  AlertTriangle, Sparkles, Zap, Building2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const F = "'Plus Jakarta Sans', sans-serif";

interface Overview {
  generated_at: string;
  users: { total: number; confirmed_approx: number; signups_24h: number; signups_7d: number; signups_30d: number };
  active_users: { dau: number; wau: number; mau: number; new_vs_returning_7d: { new: number; returning: number } };
  plans: { distribution: Record<string, number> };
  subscriptions: { by_status: Record<string, number>; past_due: number; mrr_brl: number; mrr_usd: number };
  engagement: {
    chats_today: number; chats_7d: number;
    decisions_today: number; decisions_7d: number;
    actions_today: number; actions_7d: number;
    upgrade_gates_24h: number;
  };
  meta: { accounts_connected: number; accounts_synced_24h: number; total_spend_30d_brl: number };
  health: { errors_24h: number; error_spike_users_24h: number; past_due_users: number; trials_ending_3d: number };
  ai: { patterns_total: number; winners: number; avg_hook_score_last_7d: number | null };
  signups_by_day_30d: Array<{ day: string; count: number }>;
  plan_upgrades_7d: Array<{ from: string; to: string; count: number }>;
}

function Card({ children, padding = 18 }: { children: React.ReactNode; padding?: number }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.40)',
      border: '1px solid rgba(148,163,184,0.08)',
      borderRadius: 12,
      padding,
      fontFamily: F,
    }}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType;
  tone?: 'default' | 'success' | 'warn' | 'critical';
}) {
  const toneColor = {
    default: '#60A5FA',
    success: '#22C55E',
    warn: '#F59E0B',
    critical: '#EF4444',
  }[tone];
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${toneColor}14`,
          border: `1px solid ${toneColor}26`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={toneColor} />
        </div>
        <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR')}`;
}

export default function CockpitOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke('admin-metrics-overview', {});
        if (!mounted) return;
        if (error) {
          setErr(error.message);
        } else if (res?.data) {
          setData(res.data as Overview);
        } else {
          setErr('empty_response');
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? 'unknown');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: F, color: '#94A3B8' }}>Loading…</div>
    );
  }
  if (err || !data) {
    return (
      <div style={{ padding: 40, fontFamily: F, color: '#EF4444' }}>
        Failed to load overview: {err ?? 'unknown error'}
      </div>
    );
  }

  // Signup sparkline — compute max for scaling.
  const maxSignup = Math.max(1, ...data.signups_by_day_30d.map(s => s.count));

  // Sort plans in business order.
  const planOrder = ['free', 'creator', 'maker', 'starter', 'pro', 'scale', 'studio'];
  const planEntries = Object.entries(data.plans.distribution).sort(
    ([a], [b]) => {
      const ai = planOrder.indexOf(a); const bi = planOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
  );
  const planTotal = planEntries.reduce((s, [, n]) => s + n, 0) || 1;

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '32px 28px 60px', fontFamily: F, color: '#E2E8F0',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Overview</div>
        <div style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>
          Generated {new Date(data.generated_at).toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Row 1 — headline KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <Kpi label="Total users" value={data.users.total} icon={Users}
          sub={`+${data.users.signups_7d} last 7d · +${data.users.signups_30d} last 30d`} />
        <Kpi label="DAU / WAU / MAU" value={`${data.active_users.dau} / ${data.active_users.wau} / ${data.active_users.mau}`}
          icon={Activity}
          sub={`${data.active_users.new_vs_returning_7d.new} new · ${data.active_users.new_vs_returning_7d.returning} returning (7d)`} />
        <Kpi label="Estimated MRR" value={fmtBrl(data.subscriptions.mrr_brl)}
          icon={DollarSign} tone="success"
          sub={`~US$ ${data.subscriptions.mrr_usd.toLocaleString('en-US')} · ${data.subscriptions.past_due} past due`} />
        <Kpi label="Meta spend managed (30d)" value={fmtBrl(data.meta.total_spend_30d_brl)}
          icon={TrendingUp}
          sub={`${data.meta.accounts_connected} accts · ${data.meta.accounts_synced_24h} synced 24h`} />
      </div>

      {/* Row 2 — engagement */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <Kpi label="AI chats today" value={data.engagement.chats_today}
          icon={Sparkles} sub={`${data.engagement.chats_7d} last 7d`} />
        <Kpi label="Decisions today" value={data.engagement.decisions_today}
          icon={Zap} sub={`${data.engagement.decisions_7d} last 7d`} />
        <Kpi label="Actions executed today" value={data.engagement.actions_today}
          icon={Building2} sub={`${data.engagement.actions_7d} last 7d`} />
        <Kpi label="Upgrade gates (24h)" value={data.engagement.upgrade_gates_24h}
          icon={TrendingUp}
          tone={data.engagement.upgrade_gates_24h > 0 ? 'warn' : 'default'} />
      </div>

      {/* Row 3 — signup trend + plan distribution */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 14 }}>
            Signups · last 30 days
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 3, height: 84,
          }}>
            {data.signups_by_day_30d.map((d) => {
              const h = (d.count / maxSignup) * 100;
              return (
                <div key={d.day}
                  title={`${d.day} — ${d.count} signups`}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    minHeight: d.count > 0 ? 3 : 1,
                    borderRadius: 2,
                    background: d.count > 0
                      ? 'linear-gradient(180deg, #60A5FA, #2563EB)'
                      : 'rgba(148,163,184,0.10)',
                  }}
                />
              );
            })}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 10, fontSize: 11, color: '#64748B',
          }}>
            <span>{data.signups_by_day_30d[0]?.day}</span>
            <span>Today · {data.signups_by_day_30d[data.signups_by_day_30d.length - 1]?.count ?? 0}</span>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
            Plan distribution
          </div>
          {planEntries.map(([plan, count]) => {
            const pct = Math.round((count / planTotal) * 100);
            return (
              <div key={plan} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: '#CBD5E1', marginBottom: 4,
                }}>
                  <span style={{ textTransform: 'capitalize' }}>{plan}</span>
                  <span style={{ color: '#64748B' }}>{count} · {pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: plan === 'free'
                      ? 'rgba(148,163,184,0.35)'
                      : 'linear-gradient(90deg, #2563EB, #06B6D4)',
                  }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Row 4 — subscriptions by status + health */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
            Subscriptions by status
          </div>
          {Object.entries(data.subscriptions.by_status)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.04)',
                fontSize: 13,
              }}>
                <span style={{ color: '#CBD5E1', textTransform: 'capitalize' }}>{status}</span>
                <span style={{ color: '#94A3B8', fontWeight: 600 }}>{count}</span>
              </div>
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
            System health
          </div>
          <HealthRow label="Errors (24h)" value={data.health.errors_24h}
            critical={data.health.errors_24h > 50}
            warn={data.health.errors_24h > 10} />
          <HealthRow label="Users with ≥5 errors (24h)" value={data.health.error_spike_users_24h}
            critical={data.health.error_spike_users_24h > 5}
            warn={data.health.error_spike_users_24h > 0} />
          <HealthRow label="Past-due subscriptions" value={data.health.past_due_users}
            warn={data.health.past_due_users > 0} />
          <HealthRow label="Trials ending ≤ 3 days" value={data.health.trials_ending_3d} />
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
            AI intelligence
          </div>
          <HealthRow label="Patterns learned" value={data.ai.patterns_total} />
          <HealthRow label="Winner patterns" value={data.ai.winners} />
          <HealthRow
            label="Avg hook score (7d)"
            value={data.ai.avg_hook_score_last_7d !== null ? data.ai.avg_hook_score_last_7d.toFixed(2) : '—'}
          />
        </Card>
      </div>

      {/* Row 5 — plan upgrade flow */}
      {data.plan_upgrades_7d.length > 0 && (
        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>
            Plan changes · last 7 days
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.plan_upgrades_7d.map((u, i) => (
              <div key={i} style={{
                padding: '6px 10px',
                background: 'rgba(34,197,94,0.06)',
                border: '1px solid rgba(34,197,94,0.18)',
                borderRadius: 999,
                fontSize: 12,
                color: '#86EFAC',
                fontWeight: 500,
              }}>
                {u.from} → {u.to} <span style={{ opacity: 0.65, marginLeft: 4 }}>× {u.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function HealthRow({ label, value, critical, warn }: {
  label: string; value: string | number; critical?: boolean; warn?: boolean;
}) {
  const color = critical ? '#EF4444' : warn ? '#F59E0B' : '#94A3B8';
  const icon = critical ? <AlertTriangle size={12} color={color} /> : null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.04)',
      fontSize: 13,
    }}>
      <span style={{ color: '#CBD5E1', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{label}
      </span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
