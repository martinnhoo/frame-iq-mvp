/**
 * CockpitDecisionLayer — admin view of the Decision Layer loop.
 *
 * Shows aggregate stats on decisions emitted, actions taken, and outcome
 * measurements across ALL users (admin-gated). Powered by 5 SECURITY
 * DEFINER RPCs (cockpit_dl_*) that handle the admin check inline and
 * return server-side aggregates — no edge function deploy needed.
 *
 * Layout: top row of KPIs → hit-rate cards (by source, by type) →
 * per-user activity table → recent activity stream for spot inspection.
 */

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity, Target, BarChart3, Users as UsersIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, COLORS, F, GhostButton, Kpi, SectionTitle, relativeTime } from './_shared';

interface Totals {
  window_days: number;
  decisions_total: number;
  decisions_acted: number;
  decisions_pending: number;
  decisions_by_source: Record<string, number>;
  actions_executed: number;
  outcomes_total: number;
  outcomes_finalized: number;
  outcomes_wins: number;
  outcomes_losses: number;
}

interface HitRateRow {
  source?: string;
  decision_type?: string;
  confidence?: string;
  total: number;
  wins: number;
  losses: number;
  still_measuring?: number;
  hit_rate_pct: number | null;
}

interface UserRow {
  email: string;
  decisions_received: number;
  actions_taken: number;
  wins: number;
  losses: number;
  last_decision_at: string | null;
  last_action_at: string | null;
}

interface RecentRow {
  decision_id: string;
  type: string;
  headline: string;
  score: number;
  impact_confidence: string | null;
  invalidator: string | null;
  source: string | null;
  decision_status: string;
  created_at: string;
  user_email: string;
  executed_action: string | null;
  execution_result: string | null;
  executed_at: string | null;
  improved: boolean | null;
  measured_24h_at: string | null;
  measured_72h_at: string | null;
}

const WINDOW_DAYS_DEFAULT = 14;

export default function CockpitDecisionLayer() {
  const [windowDays, setWindowDays] = useState(WINDOW_DAYS_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [bySource, setBySource] = useState<HitRateRow[]>([]);
  const [byType, setByType] = useState<HitRateRow[]>([]);
  const [byUser, setByUser] = useState<UserRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);

  const load = useCallback(async (days: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [t, s, ty, u, r] = await Promise.all([
        (supabase as any).rpc('cockpit_dl_totals', { days }),
        (supabase as any).rpc('cockpit_dl_hit_rate_by_source', { days }),
        (supabase as any).rpc('cockpit_dl_hit_rate_by_type', { days }),
        (supabase as any).rpc('cockpit_dl_by_user', { days }),
        (supabase as any).rpc('cockpit_dl_recent', { limit_rows: 50 }),
      ]);
      // Each rpc returns { data, error }. Fail loudly on the first error.
      const errObj = t.error || s.error || ty.error || u.error || r.error;
      if (errObj) throw errObj;
      setTotals((t.data as Totals) || null);
      setBySource((s.data as HitRateRow[]) || []);
      setByType((ty.data as HitRateRow[]) || []);
      setByUser((u.data as UserRow[]) || []);
      setRecent((r.data as RecentRow[]) || []);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(windowDays); }, [load, windowDays]);

  const totalFinalized = totals
    ? Math.max(0, (totals.outcomes_wins || 0) + (totals.outcomes_losses || 0))
    : 0;
  const overallHitRate = totalFinalized > 0
    ? Math.round((totals!.outcomes_wins / totalFinalized) * 1000) / 10
    : null;

  return (
    <div style={{ fontFamily: F, color: '#E2E8F0', padding: '24px 28px 80px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Decision Layer
          </h1>
          <p style={{ fontSize: 12.5, color: COLORS.muted, margin: '4px 0 0' }}>
            Loop de decisão → ação → outcome. Janela: últimos {windowDays} dias.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            style={{
              background: '#0F172A', color: '#CBD5E1',
              border: '1px solid #1E293B', borderRadius: 8,
              padding: '7px 10px', fontSize: 12, fontFamily: F, cursor: 'pointer',
            }}
          >
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
          </select>
          <GhostButton onClick={() => load(windowDays, true)} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span style={{ marginLeft: 6 }}>{refreshing ? 'Atualizando…' : 'Atualizar'}</span>
          </GhostButton>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.32)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 18,
          color: '#FCA5A5', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {loading && !totals ? (
        <div style={{ color: COLORS.muted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Carregando…
        </div>
      ) : (
        <>
          {/* TOP KPIs */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12, marginBottom: 22,
          }}>
            <Kpi
              label="Decisões emitidas"
              value={(totals?.decisions_total ?? 0).toString()}
              hint={`${totals?.decisions_acted ?? 0} acionadas · ${totals?.decisions_pending ?? 0} pendentes`}
            />
            <Kpi
              label="Ações executadas"
              value={(totals?.actions_executed ?? 0).toString()}
              hint="Meta API call success"
            />
            <Kpi
              label="Outcomes em medição"
              value={(totals?.outcomes_total ?? 0).toString()}
              hint={`${totals?.outcomes_finalized ?? 0} finalizados`}
            />
            <Kpi
              label="Hit rate global"
              value={overallHitRate != null ? `${overallHitRate}%` : '—'}
              hint={`${totals?.outcomes_wins ?? 0} acertos · ${totals?.outcomes_losses ?? 0} erros`}
            />
          </div>

          {/* HIT RATE BY SOURCE */}
          <SectionTitle icon={Target}>Hit rate por origem</SectionTitle>
          <Card style={{ marginBottom: 22, padding: 0, overflow: 'hidden' }}>
            {bySource.length === 0 ? (
              <EmptyRow text="Nenhum outcome finalizado ainda. Crons rodam 24h e 72h após a ação." />
            ) : (
              <Table
                cols={['Origem', 'Total', 'Acertos', 'Erros', 'Em medição', 'Hit rate']}
                rows={bySource.map((r) => [
                  badge(r.source || 'unknown', sourceColor(r.source)),
                  r.total.toString(),
                  <span style={{ color: '#34D399' }}>{r.wins}</span>,
                  <span style={{ color: '#F87171' }}>{r.losses}</span>,
                  <span style={{ color: COLORS.muted }}>{r.still_measuring ?? 0}</span>,
                  r.hit_rate_pct != null ? <strong>{r.hit_rate_pct}%</strong> : <span style={{ color: COLORS.muted }}>—</span>,
                ])}
              />
            )}
          </Card>

          {/* HIT RATE BY TYPE + CONFIDENCE */}
          <SectionTitle icon={BarChart3}>Hit rate por tipo + confiança</SectionTitle>
          <Card style={{ marginBottom: 22, padding: 0, overflow: 'hidden' }}>
            {byType.length === 0 ? (
              <EmptyRow text="Sem dados ainda. Aparece quando alguém clicar e o cron 72h finalizar." />
            ) : (
              <Table
                cols={['Tipo', 'Confiança', 'Total', 'Acertos', 'Erros', 'Hit rate']}
                rows={byType.map((r) => [
                  badge(r.decision_type || 'unknown', typeColor(r.decision_type)),
                  badge(r.confidence || 'unset', confidenceColor(r.confidence)),
                  r.total.toString(),
                  <span style={{ color: '#34D399' }}>{r.wins}</span>,
                  <span style={{ color: '#F87171' }}>{r.losses}</span>,
                  r.hit_rate_pct != null ? <strong>{r.hit_rate_pct}%</strong> : <span style={{ color: COLORS.muted }}>—</span>,
                ])}
              />
            )}
          </Card>

          {/* PER-USER ACTIVITY */}
          <SectionTitle icon={UsersIcon}>Atividade por usuário</SectionTitle>
          <Card style={{ marginBottom: 22, padding: 0, overflow: 'hidden' }}>
            {byUser.length === 0 ? (
              <EmptyRow text="Sem decisões emitidas no período." />
            ) : (
              <Table
                cols={['Email', 'Decisões', 'Ações', 'Acertos', 'Erros', 'Última decisão', 'Última ação']}
                rows={byUser.map((r) => [
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{r.email}</span>,
                  r.decisions_received.toString(),
                  r.actions_taken.toString(),
                  <span style={{ color: '#34D399' }}>{r.wins}</span>,
                  <span style={{ color: '#F87171' }}>{r.losses}</span>,
                  r.last_decision_at ? <span style={{ color: COLORS.muted, fontSize: 11.5 }}>{relativeTime(r.last_decision_at)}</span> : '—',
                  r.last_action_at ? <span style={{ color: COLORS.muted, fontSize: 11.5 }}>{relativeTime(r.last_action_at)}</span> : <span style={{ color: COLORS.muted }}>—</span>,
                ])}
              />
            )}
          </Card>

          {/* RECENT STREAM */}
          <SectionTitle icon={Activity}>Atividade recente</SectionTitle>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {recent.length === 0 ? (
              <EmptyRow text="Nenhuma decisão registrada ainda." />
            ) : (
              <Table
                cols={['Quando', 'Usuário', 'Tipo', 'Headline', 'Origem', 'Status', 'Outcome']}
                rows={recent.map((r) => [
                  <span style={{ color: COLORS.muted, fontSize: 11.5, whiteSpace: 'nowrap' }}>{relativeTime(r.created_at)}</span>,
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{(r.user_email || '').split('@')[0]}</span>,
                  badge(r.type, typeColor(r.type)),
                  <span style={{ fontSize: 12, maxWidth: 320, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.headline}</span>,
                  badge(r.source || 'unknown', sourceColor(r.source)),
                  r.executed_action
                    ? badge(`${r.executed_action} · ${r.execution_result || '?'}`, r.execution_result === 'success' ? '#34D399' : '#F87171')
                    : badge('ignorada', '#94A3B8'),
                  r.improved == null
                    ? <span style={{ color: COLORS.muted, fontSize: 11.5 }}>medindo</span>
                    : r.improved
                      ? <span style={{ color: '#34D399', fontWeight: 600 }}>✓ acertou</span>
                      : <span style={{ color: '#F87171', fontWeight: 600 }}>✗ errou</span>,
                ])}
              />
            )}
          </Card>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ── Local helpers ──────────────────────────────────────────────────────

function Table({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'rgba(148,163,184,0.04)', borderBottom: '1px solid rgba(148,163,184,0.10)' }}>
            {cols.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '10px 14px',
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#64748B',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(148,163,184,0.06)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', color: COLORS.muted, fontSize: 12.5 }}>
      {text}
    </div>
  );
}

function badge(text: string, color: string) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: `${color}1f`, color, fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {text}
    </span>
  );
}

function sourceColor(s?: string | null) {
  if (s === 'chat' || s === 'ai_chat') return '#7BB6E5';
  if (s === 'feed' || s === 'engine') return '#7DC79E';
  if (s === 'auto_pilot' || s === 'autopilot') return '#A78BFA';
  return '#94A3B8';
}

function typeColor(t?: string | null) {
  if (t === 'kill') return '#F08770';
  if (t === 'scale') return '#7DC79E';
  if (t === 'fix') return '#D9B26B';
  if (t === 'pattern') return '#A78BFA';
  if (t === 'alert') return '#F87171';
  return '#94A3B8';
}

function confidenceColor(c?: string | null) {
  if (c === 'high') return '#7BC4D8';
  if (c === 'medium') return '#D9B26B';
  if (c === 'low') return '#94A3B8';
  return '#475569';
}
