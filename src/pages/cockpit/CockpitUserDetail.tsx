/**
 * CockpitUserDetail — exhaustive per-user view.
 *
 * Hydrated from the admin-user-summary edge function. Layout sections:
 *   1. Identity header + actions toolbar (copy, open Stripe/Meta)
 *   2. Anomalies banner
 *   3. Usage KPI tiles (chats, actions, decisions, upgrade gates)
 *   4. Meta ad accounts list
 *   5. AI intelligence (profile + top patterns)
 *   6. Billing panel (stripe ids, trial, period end)
 *   7. Timeline (last 50 merged events) — filterable
 *   8. Errors list
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, MessageSquare, Zap, TrendingUp, AlertTriangle,
  ExternalLink, Clock, Building2, Sparkles, CreditCard,
  User as UserIcon, Copy as CopyIcon, LinkIcon, Gift,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Avatar, Card, COLORS, CopyButton, F, GhostButton, MONO, MicroPill, PlanPill,
  SectionHead, SubPill, StatusPill,
  fmtMoney, longDateTime, relativeTime, shortDate,
} from './_shared';

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
  referrals?: {
    code: string | null;
    referred_by: { id: string; email: string | null; name: string | null } | null;
    total_referrals: number;
    total_bonus_credits_granted: number;
    recent_claims: Array<{
      referee_id: string;
      referee_email: string | null;
      referee_name: string | null;
      referee_plan: string | null;
      bonus_granted: number;
      created_at: string;
    }>;
  };
}

type TimelineFilter = 'all' | 'chat' | 'action' | 'decision' | 'upgrade_event' | 'error';

export default function CockpitUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tlFilter, setTlFilter] = useState<TimelineFilter>('all');

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

  // Count per-kind for filter chips.
  const tlCounts = useMemo(() => {
    if (!data) return { all: 0, chat: 0, action: 0, decision: 0, upgrade_event: 0, error: 0 };
    const out = { all: 0, chat: 0, action: 0, decision: 0, upgrade_event: 0, error: 0 };
    for (const ev of data.timeline) {
      out.all += 1;
      if (ev.kind in out) (out as any)[ev.kind] += 1;
    }
    return out;
  }, [data]);

  const tlFiltered = useMemo(() => {
    if (!data) return [];
    if (tlFilter === 'all') return data.timeline;
    return data.timeline.filter(ev => ev.kind === tlFilter);
  }, [data, tlFilter]);

  if (loading) {
    return <div style={{ padding: 40, fontFamily: F, color: COLORS.textMuted }}>Loading…</div>;
  }
  if (err || !data) {
    return (
      <div style={{ padding: 40, fontFamily: F }}>
        <GhostButton icon={ChevronLeft} onClick={() => navigate('/cockpit/users')}>
          Back
        </GhostButton>
        <div style={{ color: COLORS.critical, marginTop: 16 }}>Failed to load user: {err ?? 'unknown'}</div>
      </div>
    );
  }

  const { identity, billing, ad_accounts, usage, credits, free_usage, ai_intelligence, errors, anomalies, referrals } = data;

  const stripeUrl = billing.stripe_customer_id
    ? `https://dashboard.stripe.com/customers/${billing.stripe_customer_id}`
    : null;

  // Sort ad accounts: connected + synced first, then by spend desc.
  const sortedAdAccounts = [...ad_accounts].sort((a, b) => {
    const aScore = (a.status === 'connected' ? 2 : 0) + (a.last_fast_sync_at ? 1 : 0);
    const bScore = (b.status === 'connected' ? 2 : 0) + (b.last_fast_sync_at ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;
    return (b.total_spend_30d ?? 0) - (a.total_spend_30d ?? 0);
  });

  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto',
      padding: '28px 28px 60px', fontFamily: F, color: COLORS.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <GhostButton icon={ChevronLeft} onClick={() => navigate('/cockpit/users')} size="sm">
          Back to users
        </GhostButton>
        <div style={{ flex: 1 }} />
        {identity.email && (
          <CopyButton text={identity.email} label="Copy email" />
        )}
        <CopyButton text={identity.user_id} label="Copy ID" />
        {stripeUrl && (
          <GhostButton
            icon={ExternalLink}
            onClick={() => window.open(stripeUrl, '_blank', 'noopener,noreferrer')}
            tone="accent" size="sm"
            title="Open in Stripe dashboard"
          >
            Open in Stripe
          </GhostButton>
        )}
      </div>

      {/* Identity header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <Avatar
          src={identity.avatar_url}
          name={identity.name}
          email={identity.email}
          size={52}
          radius={12}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 20, fontWeight: 700,
            letterSpacing: '-0.02em', color: COLORS.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {identity.name || identity.email || '—'}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, color: COLORS.textDim, marginTop: 3, flexWrap: 'wrap',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {identity.email ?? '—'}
            </span>
            <span style={{ color: COLORS.textFaint }}>·</span>
            <span style={{
              fontFamily: MONO, fontSize: 11.5, color: COLORS.textFaint,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {identity.user_id.slice(0, 8)}…
            </span>
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
                color={a.severity === 'critical' ? COLORS.criticalSoft : a.severity === 'warn' ? COLORS.warnSoft : '#93C5FD'} />
              <span style={{ color: COLORS.text, fontWeight: 600, fontFamily: MONO, fontSize: 12 }}>{a.code}</span>
              <span style={{ color: COLORS.textMuted }}>— {a.note}</span>
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
              <div style={{ color: COLORS.textDim, fontSize: 13, padding: '12px 0' }}>
                No ad accounts connected.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedAdAccounts.map(a => {
                  const metaUrl = `https://business.facebook.com/adsmanager/manage/campaigns?act=${a.meta_account_id}`;
                  return (
                    <div key={a.id} style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: COLORS.surfaceStrong,
                      border: `1px solid ${COLORS.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, gap: 8 }}>
                        <div style={{
                          color: COLORS.text, fontSize: 13, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          minWidth: 0, flex: 1,
                        }}>
                          {a.name || a.meta_account_id}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <StatusPill status={a.status ?? '—'} />
                          <a
                            href={metaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            title="Open in Meta Ads Manager"
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: 4, borderRadius: 5,
                              color: COLORS.textDim, textDecoration: 'none',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = COLORS.accent; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = COLORS.textDim; }}
                          >
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                      <div style={{ color: COLORS.textDim, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: MONO }}>{a.meta_account_id}</span>
                        <CopyButton text={a.meta_account_id} size={10} />
                        <span>· {a.currency ?? '—'}</span>
                        <span>· spend 30d: {fmtMoney(a.total_spend_30d, a.currency)}</span>
                        <span>· {a.total_ads_synced ?? 0} ads synced</span>
                      </div>
                      <div style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 4 }}>
                        last sync {a.last_fast_sync_at ? relativeTime(a.last_fast_sync_at) : 'never'}
                      </div>
                    </div>
                  );
                })}
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
                    padding: '8px 10px', background: COLORS.surfaceStrong,
                    border: `1px solid ${COLORS.border}`, borderRadius: 8,
                    fontSize: 12.5,
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      {p.is_winner && <span style={{ fontSize: 10.5, color: COLORS.successSoft, fontWeight: 700 }}>★</span>}
                      <span style={{ color: COLORS.textMid, fontWeight: 600 }}>{p.pattern_key}</span>
                      <span style={{ color: COLORS.textDim }}>· conf {Number(p.confidence).toFixed(2)}</span>
                      {p.avg_ctr != null && <span style={{ color: COLORS.textDim }}>· CTR {(p.avg_ctr * 100).toFixed(2)}%</span>}
                      {p.avg_roas != null && <span style={{ color: COLORS.textDim }}>· ROAS {Number(p.avg_roas).toFixed(2)}</span>}
                    </div>
                    {p.insight_text && (
                      <div style={{ color: COLORS.textMuted, marginTop: 4 }}>{p.insight_text}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <SectionHead
              icon={Clock}
              title={`Recent activity (${tlFiltered.length}${tlFilter !== 'all' ? ` of ${tlCounts.all}` : ''})`}
            />
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <TlChip label={`All · ${tlCounts.all}`} active={tlFilter === 'all'} onClick={() => setTlFilter('all')} color={COLORS.textMuted} />
              <TlChip label={`Chats · ${tlCounts.chat}`} active={tlFilter === 'chat'} onClick={() => setTlFilter('chat')} color={COLORS.accent} />
              <TlChip label={`Actions · ${tlCounts.action}`} active={tlFilter === 'action'} onClick={() => setTlFilter('action')} color={COLORS.success} />
              <TlChip label={`Decisions · ${tlCounts.decision}`} active={tlFilter === 'decision'} onClick={() => setTlFilter('decision')} color={COLORS.purple} />
              <TlChip label={`Upgrades · ${tlCounts.upgrade_event}`} active={tlFilter === 'upgrade_event'} onClick={() => setTlFilter('upgrade_event')} color={COLORS.warn} />
            </div>
            {tlFiltered.length === 0 ? (
              <div style={{ color: COLORS.textDim, fontSize: 13, padding: '12px 0' }}>
                {tlFilter === 'all' ? 'No activity recorded.' : `No ${tlFilter} events.`}
              </div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {tlFiltered.map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: i === tlFiltered.length - 1 ? 'none' : `1px solid ${COLORS.divider}`,
                  }}>
                    <TimelineDot kind={ev.kind} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: COLORS.textMid, fontSize: 12.5,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {ev.summary}
                      </div>
                      <div style={{
                        color: COLORS.textFaint, fontSize: 10.5, marginTop: 2,
                      }}
                        title={longDateTime(ev.ts)}
                      >
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
                    <div style={{ color: COLORS.criticalSoft, fontWeight: 600 }}>
                      {e.error_type} {e.component ? <span style={{ opacity: 0.65, fontWeight: 400 }}>@ {e.component}</span> : null}
                    </div>
                    <div style={{ color: COLORS.textMid, marginTop: 2 }}>{e.message}</div>
                    <div style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 2 }}
                      title={longDateTime(e.created_at)}
                    >
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
            <RowWithCopy
              label="Stripe customer"
              value={billing.stripe_customer_id ?? '—'}
              copyable={!!billing.stripe_customer_id}
              mono
            />
            <Row label="Plan started" value={billing.plan_started_at ? shortDate(billing.plan_started_at) : '—'} />
            <Row label="Period end" value={billing.current_period_end ? shortDate(billing.current_period_end) : '—'} />
            <Row label="Trial end" value={billing.trial_end ? shortDate(billing.trial_end) : '—'} />
            {stripeUrl && (
              <div style={{ marginTop: 10 }}>
                <GhostButton
                  icon={LinkIcon}
                  onClick={() => window.open(stripeUrl, '_blank', 'noopener,noreferrer')}
                  size="sm"
                  tone="accent"
                >
                  View in Stripe
                </GhostButton>
              </div>
            )}
          </Card>

          {/* Credits */}
          <Card>
            <SectionHead icon={Sparkles} title="Credits" />
            {credits.current ? (
              <>
                <Row label="Period" value={credits.current.period} mono />
                <CreditsBar
                  used={credits.current.used_credits}
                  total={credits.current.total_credits + credits.current.bonus_credits}
                />
                <Row label="Used / Total" value={`${credits.current.used_credits.toLocaleString()} / ${(credits.current.total_credits + credits.current.bonus_credits).toLocaleString()}`} />
                {credits.current.bonus_credits > 0 && (
                  <Row label="Bonus" value={String(credits.current.bonus_credits)} />
                )}
                <Row label="Updated" value={relativeTime(credits.current.updated_at)} />
              </>
            ) : (
              <div style={{ color: COLORS.textDim, fontSize: 12, padding: '6px 0' }}>No credit record.</div>
            )}
            {free_usage && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                <Row label="Free-tier chats" value={String(free_usage.chat_count)} />
                <Row label="Last reset" value={shortDate(free_usage.last_reset)} />
              </div>
            )}
          </Card>

          {/* Referrals */}
          {referrals && (
            <Card>
              <SectionHead icon={Gift} title="Referrals" />
              <RowWithCopy label="Code" value={referrals.code ?? '—'} mono copyable={!!referrals.code} />
              <Row
                label="Referred by"
                value={
                  referrals.referred_by
                    ? (referrals.referred_by.email || referrals.referred_by.name || referrals.referred_by.id)
                    : 'Organic signup'
                }
              />
              <Row label="Total referrals made" value={String(referrals.total_referrals)} />
              <Row
                label="Bonus credits granted"
                value={`${referrals.total_bonus_credits_granted.toLocaleString()} cr (~${Math.round(referrals.total_bonus_credits_granted / 30)} melhorias)`}
              />

              {referrals.recent_claims.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Recent referred users
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                    {referrals.recent_claims.map((c) => (
                      <div
                        key={c.referee_id + c.created_at}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 8px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.02)',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                          <span style={{ color: COLORS.textMid, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.referee_email || c.referee_name || c.referee_id.slice(0, 8)}
                          </span>
                          <span style={{ color: COLORS.textDim, fontSize: 10.5 }}>
                            {relativeTime(c.created_at)}
                            {c.referee_plan && c.referee_plan !== 'free' && ` · ${c.referee_plan}`}
                          </span>
                        </div>
                        <span style={{ color: COLORS.textDim, fontSize: 11, fontFamily: MONO, flexShrink: 0, marginLeft: 8 }}>
                          +{c.bonus_granted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

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
                      borderBottom: `1px solid ${COLORS.divider}`, fontSize: 12.5,
                    }}>
                      <span style={{ color: COLORS.textMid, fontFamily: MONO, fontSize: 11.5 }}>{type}</span>
                      <span style={{ color: COLORS.textDim, fontWeight: 600 }}>{n}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {/* User identity — copyable */}
          <Card padding={14}>
            <SectionHead icon={UserIcon} title="Identity" />
            <RowWithCopy label="User ID" value={identity.user_id} copyable mono />
            {identity.email && <RowWithCopy label="Email" value={identity.email} copyable />}
          </Card>

          {/* Onboarding snapshot */}
          {identity.onboarding_data && (
            <Card>
              <SectionHead
                icon={Building2}
                title="Onboarding data"
                right={
                  <CopyButton
                    text={JSON.stringify(identity.onboarding_data, null, 2)}
                    label="JSON"
                  />
                }
              />
              <pre style={{
                margin: 0, fontSize: 11, color: COLORS.textMuted,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 220, overflow: 'auto', fontFamily: MONO,
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
function UsageKpi({ label, value, breakdown, icon: Icon }: {
  label: string; value: number | string; breakdown?: string; icon: React.ElementType;
}) {
  return (
    <Card padding={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <Icon size={12} color={COLORS.accent} />
        <div style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {breakdown && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{breakdown}</div>}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginTop: 2 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: `1px solid ${COLORS.divider}`, fontSize: 12.5,
      gap: 10,
    }}>
      <span style={{ color: COLORS.textDim, flexShrink: 0 }}>{label}</span>
      <span style={{
        color: COLORS.textMid, fontWeight: 500,
        fontFamily: mono ? MONO : F,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

function RowWithCopy({
  label, value, copyable, mono,
}: {
  label: string; value: string; copyable?: boolean; mono?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: `1px solid ${COLORS.divider}`, fontSize: 12.5,
      gap: 10,
    }}>
      <span style={{ color: COLORS.textDim, flexShrink: 0 }}>{label}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6,
        minWidth: 0, flex: 1, justifyContent: 'flex-end',
      }}>
        <span style={{
          color: COLORS.textMid, fontWeight: 500,
          fontFamily: mono ? MONO : F,
          fontSize: mono ? 11.5 : 12.5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
        {copyable && value && value !== '—' && <CopyButton text={value} />}
      </span>
    </div>
  );
}

function CreditsBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color =
    pct >= 100 ? COLORS.critical :
    pct >= 80 ? COLORS.warn :
    COLORS.accent;
  return (
    <div style={{ margin: '6px 0 10px' }}>
      <div style={{
        height: 4, borderRadius: 2,
        background: 'rgba(148,163,184,0.08)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color,
          transition: 'width 0.4s ease-out',
        }} />
      </div>
      <div style={{
        fontSize: 10.5, color: COLORS.textDim, marginTop: 3,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{pct}% used</span>
        {pct >= 80 && <span style={{ color }}>{pct >= 100 ? 'exhausted' : 'near limit'}</span>}
      </div>
    </div>
  );
}

function TlChip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 999,
        background: active ? `${color}20` : 'transparent',
        border: `1px solid ${active ? color + '60' : COLORS.borderStrong}`,
        color: active ? color : COLORS.textMuted,
        fontSize: 11.5, fontFamily: F, fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function TimelineDot({ kind }: { kind: string }) {
  const color = kind === 'chat' ? COLORS.accent
              : kind === 'action' ? COLORS.success
              : kind === 'decision' ? COLORS.purple
              : kind === 'upgrade_event' ? COLORS.warnSoft
              : COLORS.textMuted;
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%', background: color,
      marginTop: 7, flexShrink: 0, boxShadow: `0 0 8px ${color}70`,
    }} />
  );
}
