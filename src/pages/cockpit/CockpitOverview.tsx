/**
 * CockpitOverview — the business dashboard. Renders everything returned by
 * the `admin-metrics-overview` edge function: KPIs, signup trend, plan
 * distribution, subscription health, engagement, and AI intelligence.
 *
 * Everything on this page is read-only. Any write action happens from the
 * Users / UserDetail pages (dedicated, audited actions).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, Users, Activity, DollarSign,
  AlertTriangle, Sparkles, Zap, Building2, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  COLORS,
  F,
  GhostButton,
  Kpi,
  SectionTitle,
  fmtBrl,
  longDateTime,
  relativeTime,
} from './_shared';

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

export default function CockpitOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('admin-metrics-overview', {});
      if (error) {
        setErr(error.message);
      } else if (res?.data) {
        setData(res.data as Overview);
        setErr(null);
      } else {
        setErr('empty_response');
      }
    } catch (e: any) {
      setErr(e?.message ?? 'unknown');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(false); }, [load]);

  // ── Derived: trends + sparkline data ─────────────────────────────────────
  const signupTrend = useMemo(() => {
    if (!data) return null;
    const series = data.signups_by_day_30d;
    if (series.length < 14) return null;
    const last7 = series.slice(-7).reduce((s, d) => s + d.count, 0);
    const prev7 = series.slice(-14, -7).reduce((s, d) => s + d.count, 0);
    const delta = prev7 === 0 ? (last7 > 0 ? 100 : 0) : ((last7 - prev7) / prev7) * 100;
    return { last7, prev7, delta: Math.round(delta) };
  }, [data]);

  const chatsDeltaPct = useMemo(() => {
    if (!data) return null;
    // rough: compare chats_today against an implied daily avg from 7d window.
    const daily7 = data.engagement.chats_7d / 7;
    if (daily7 === 0) return null;
    const d = ((data.engagement.chats_today - daily7) / daily7) * 100;
    return Math.round(d);
  }, [data]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: F, color: COLORS.textMuted }}>Loading…</div>;
  }
  if (err || !data) {
    return (
      <div style={{ padding: 40, fontFamily: F }}>
        <div style={{ color: COLORS.critical, marginBottom: 10 }}>
          Failed to load overview: {err ?? 'unknown error'}
        </div>
        <GhostButton icon={RefreshCw} onClick={() => void load(false)}>Try again</GhostButton>
      </div>
    );
  }

  // Signup sparkline — compute max for scaling.
  const maxSignup = Math.max(1, ...data.signups_by_day_30d.map(s => s.count));
  const total30d = data.signups_by_day_30d.reduce((s, d) => s + d.count, 0);
  const firstDay = data.signups_by_day_30d[0]?.day;
  const lastDay = data.signups_by_day_30d[data.signups_by_day_30d.length - 1]?.day;

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
      padding: '32px 28px 60px', fontFamily: F, color: COLORS.text,
    }}>
      <SectionTitle
        title="Overview"
        subtitle={
          <span>
            Generated {relativeTime(data.generated_at)}
            <span style={{ color: COLORS.textFaint, marginLeft: 6 }}>
              · {longDateTime(data.generated_at)}
            </span>
          </span>
        }
        right={
          <GhostButton
            icon={RefreshCw}
            onClick={() => void load(true)}
            disabled={refreshing}
            title="Refresh metrics"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </GhostButton>
        }
      />

      {/* Row 1 — headline KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <Kpi label="Total users" value={data.users.total.toLocaleString()} icon={Users}
          trend={signupTrend ? { delta: signupTrend.delta, label: 'vs prev 7d' } : undefined}
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        <Kpi label="AI chats today" value={data.engagement.chats_today.toLocaleString()}
          icon={Sparkles}
          trend={chatsDeltaPct !== null ? { delta: chatsDeltaPct, label: 'vs daily avg' } : undefined}
          sub={`${data.engagement.chats_7d} last 7d`} />
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
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid }}>
              Signups · last 30 days
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.textDim }}>
              {total30d.toLocaleString()} total
              {signupTrend && (
                <span
                  style={{
                    marginLeft: 8,
                    color: signupTrend.delta >= 0 ? COLORS.successSoft : COLORS.criticalSoft,
                    fontWeight: 600,
                  }}
                  title={`last 7d ${signupTrend.last7} · prev 7d ${signupTrend.prev7}`}
                >
                  {signupTrend.delta >= 0 ? '▲' : '▼'} {Math.abs(signupTrend.delta)}%
                </span>
              )}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 3, height: 92,
          }}>
            {data.signups_by_day_30d.map((d) => {
              const h = (d.count / maxSignup) * 100;
              return (
                <div key={d.day}
                  title={`${d.day} — ${d.count} signup${d.count === 1 ? '' : 's'}`}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    minHeight: d.count > 0 ? 3 : 1,
                    borderRadius: 2,
                    background: d.count > 0
                      ? 'linear-gradient(180deg, #60A5FA, #2563EB)'
                      : 'rgba(148,163,184,0.10)',
                    transition: 'opacity 0.2s',
                  }}
                />
              );
            })}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, fontSize: 10.5, color: COLORS.textDim,
          }}>
            <span>{firstDay && formatDayShort(firstDay)}</span>
            <span style={{ color: COLORS.textFaint }}>
              peak {maxSignup}/day
            </span>
            <span>
              Today · <span style={{ color: COLORS.textMid, fontWeight: 600 }}>
                {data.signups_by_day_30d[data.signups_by_day_30d.length - 1]?.count ?? 0}
              </span>{lastDay ? ` · ${formatDayShort(lastDay)}` : ''}
            </span>
          </div>
        </Card>

        <Card>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid }}>
              Plan distribution
            </div>
            <div style={{ fontSize: 11, color: COLORS.textDim }}>
              {planTotal.toLocaleString()} users
            </div>
          </div>
          {planEntries.map(([plan, count]) => {
            const pct = Math.round((count / planTotal) * 100);
            return (
              <div key={plan} style={{ marginBottom: 10 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: COLORS.textMid, marginBottom: 4,
                }}>
                  <span style={{ textTransform: 'capitalize' }}>{plan}</span>
                  <span style={{ color: COLORS.textDim }}>{count} · {pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%',
                    background: plan === 'free'
                      ? 'rgba(148,163,184,0.35)'
                      : 'linear-gradient(90deg, #2563EB, #06B6D4)',
                    transition: 'width 0.4s ease-out',
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
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid, marginBottom: 12 }}>
            Subscriptions by status
          </div>
          {Object.entries(data.subscriptions.by_status)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <StatusRow key={status} status={status} count={count} />
          ))}
        </Card>

        <Card>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid, marginBottom: 12 }}>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid, marginBottom: 12 }}>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMid, marginBottom: 12 }}>
            Plan changes · last 7 days
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.plan_upgrades_7d.map((u, i) => {
              const isUp = planRank(u.to) > planRank(u.from);
              const isDown = planRank(u.to) < planRank(u.from);
              const bg = isUp ? 'rgba(34,197,94,0.06)'
                       : isDown ? 'rgba(239,68,68,0.06)'
                       : 'rgba(37,99,235,0.06)';
              const bd = isUp ? 'rgba(34,197,94,0.18)'
                       : isDown ? 'rgba(239,68,68,0.18)'
                       : 'rgba(37,99,235,0.18)';
              const fg = isUp ? COLORS.successSoft
                       : isDown ? COLORS.criticalSoft
                       : '#93C5FD';
              return (
                <div key={i} style={{
                  padding: '6px 10px',
                  background: bg, border: `1px solid ${bd}`,
                  borderRadius: 999,
                  fontSize: 12, color: fg, fontWeight: 500,
                }}>
                  {u.from} → {u.to}{' '}
                  <span style={{ opacity: 0.65, marginLeft: 4 }}>× {u.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDayShort(day: string): string {
  // day is "YYYY-MM-DD" in UTC — display as "Apr 12".
  const d = new Date(day + 'T00:00:00Z');
  return d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
}

function planRank(p: string): number {
  const o = ['free', 'creator', 'maker', 'starter', 'pro', 'scale', 'studio'];
  const i = o.indexOf(p);
  return i === -1 ? 0 : i;
}

function StatusRow({ status, count }: { status: string; count: number }) {
  const color =
    status === 'past_due' ? COLORS.critical :
    status === 'active' ? COLORS.success :
    status === 'trialing' ? COLORS.warn :
    status === 'canceled' ? COLORS.textMuted :
    COLORS.textMuted;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: `1px solid ${COLORS.divider}`,
      fontSize: 13,
    }}>
      <span style={{ color: COLORS.textMid, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
        {status}
      </span>
      <span style={{ color: COLORS.textMuted, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

function HealthRow({ label, value, critical, warn }: {
  label: string; value: string | number; critical?: boolean; warn?: boolean;
}) {
  const color = critical ? COLORS.critical : warn ? COLORS.warn : COLORS.textMuted;
  const icon = critical ? <AlertTriangle size={12} color={color} /> : null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: `1px solid ${COLORS.divider}`,
      fontSize: 13,
    }}>
      <span style={{ color: COLORS.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{label}
      </span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
