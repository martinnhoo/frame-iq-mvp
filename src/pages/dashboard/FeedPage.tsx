import React, { useState, useCallback, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { MoneyBar } from '../../components/feed/MoneyBar';
import { SummaryBar } from '../../components/feed/SummaryBar';
import { DecisionCard } from '../../components/feed/DecisionCard';
import { EmptyState } from '../../components/feed/EmptyState';
import { useDecisions } from '../../hooks/useDecisions';
import { useMoneyTracker } from '../../hooks/useMoneyTracker';
import { useActions } from '../../hooks/useActions';
import { supabase } from '@/integrations/supabase/client';
import type { Decision, DecisionAction } from '../../types/v2-database';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
const M = "'Space Grotesk', 'Inter', system-ui, sans-serif";

// ================================================================
// DEMO MODE — Must feel indistinguishable from real production data.
// Campaign names, ad set names, ad names — all realistic.
// ================================================================

function buildDemoDecisions(): Decision[] {
  const now = new Date().toISOString();
  const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();

  return [
    {
      id: "demo_kill_1",
      account_id: "demo",
      ad_id: "demo_ad_001",
      type: "kill",
      score: 94,
      priority_rank: 1,
      headline: "Perda potencial identificada — CTR 62% abaixo da mediana",
      reason: "CTR: 0.80% (baseline: 1.45%)\nCPA: R$47,50 (baseline: R$28,00)\nGasto acumulado: R$540 em 5 dias",
      impact_type: "waste",
      impact_daily: 18000,
      impact_7d: 126000,
      impact_confidence: "high",
      impact_basis: "Últimos 5 dias",
      metrics: [
        { key: "CTR", value: "0.80%", context: "baseline 1.45%", trend: "down" },
        { key: "CPA", value: "R$47,50", context: "baseline R$28", trend: "down" },
        { key: "Gasto", value: "R$540", context: "5d", trend: "stable" },
        { key: "Conv.", value: "2", context: "", trend: "down" },
      ],
      actions: [
        { id: "d1a", label: "Pausar anúncio", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d1b", label: "Revisar dados", type: "neutral", requires_confirmation: false },
      ],
      ad: {
        name: "Vídeo 03 — Hook Depoimento",
        ad_set: {
          name: "Broad BR 25-45",
          campaign: { name: "Conversão — Produto X" },
        },
      },
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(12),
    },
    {
      id: "demo_kill_2",
      account_id: "demo",
      ad_id: "demo_ad_002",
      type: "kill",
      score: 89,
      priority_rank: 2,
      headline: "Gasto sem conversão — R$665 em 7 dias",
      reason: "Conversões: 0 em 7 dias\nCTR: 0.80% (baseline: 1.45%)\nFrequência: 3.2x — possível saturação",
      impact_type: "waste",
      impact_daily: 9500,
      impact_7d: 66500,
      impact_confidence: "high",
      impact_basis: "Últimos 7 dias",
      metrics: [
        { key: "Gasto", value: "R$665", context: "7d", trend: "down" },
        { key: "Conv.", value: "0", context: "", trend: "down" },
        { key: "CTR", value: "0.80%", context: "baseline 1.45%", trend: "down" },
        { key: "Freq.", value: "3.2x", context: "", trend: "down" },
      ],
      actions: [
        { id: "d2a", label: "Pausar agora", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d2b", label: "Revisar dados", type: "neutral", requires_confirmation: false },
      ],
      ad: {
        name: "Carrossel 01 — Benefícios",
        ad_set: {
          name: "Interesse Fitness",
          campaign: { name: "Conversão — Produto X" },
        },
      },
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(18),
    },
    {
      id: "demo_fix_1",
      account_id: "demo",
      ad_id: "demo_ad_003",
      type: "fix",
      score: 78,
      priority_rank: 3,
      headline: "Fadiga criativa — frequência 4.2x, CPA subindo",
      reason: "Frequência: 4.2x (limite: 3.0x)\nCPA: R$32,00 (+22% vs semana anterior)\nCTR: 2.0% (-15% vs início)",
      impact_type: "savings",
      impact_daily: 7200,
      impact_7d: 50400,
      impact_confidence: "medium",
      impact_basis: "Últimos 5 dias",
      metrics: [
        { key: "Freq.", value: "4.2x", context: "limite 3.0x", trend: "down" },
        { key: "CPA", value: "R$32", context: "+22%", trend: "down" },
        { key: "CTR", value: "2.0%", context: "-15%", trend: "down" },
      ],
      actions: [
        { id: "d3a", label: "Pausar 3 dias", type: "neutral", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d3b", label: "Revisar dados", type: "constructive", requires_confirmation: false },
      ],
      ad: {
        name: "Vídeo 01 — UGC Teste",
        ad_set: {
          name: "Lookalike 1% Purchase",
          campaign: { name: "Escala — Produto Y" },
        },
      },
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(25),
    },
    {
      id: "demo_fix_2",
      account_id: "demo",
      ad_id: "demo_ad_004",
      type: "fix",
      score: 72,
      priority_rank: 4,
      headline: "Hook forte, conversão fraca — possível problema na LP",
      reason: "Hook rate: 68% (top quartil)\nCTR: 2.4% (baseline: 1.45%)\nCPA: R$38,00 (baseline: R$28,00)",
      impact_type: "savings",
      impact_daily: 5400,
      impact_7d: 37800,
      impact_confidence: "medium",
      impact_basis: "Últimos 5 dias",
      metrics: [
        { key: "Hook", value: "68%", context: "p90", trend: "up" },
        { key: "CTR", value: "2.4%", context: "+66%", trend: "up" },
        { key: "CPA", value: "R$38", context: "baseline R$28", trend: "down" },
      ],
      actions: [
        { id: "d4a", label: "Revisar LP", type: "neutral", requires_confirmation: false },
        { id: "d4b", label: "Revisar dados", type: "constructive", requires_confirmation: false },
      ],
      ad: {
        name: "Imagem 02 — Before/After",
        ad_set: {
          name: "Broad BR 25-45",
          campaign: { name: "Conversão — Produto X" },
        },
      },
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(32),
    },
    {
      id: "demo_scale_1",
      account_id: "demo",
      ad_id: "demo_ad_005",
      type: "scale",
      score: 65,
      priority_rank: 5,
      headline: "ROAS 4.8x — 3x acima da mediana, CPA baixo",
      reason: "ROAS: 4.8x (baseline: 1.6x)\nCPA: R$18,00 (baseline: R$28,00)\n12 conversões em 7 dias, tendência estável",
      impact_type: "revenue",
      impact_daily: 32000,
      impact_7d: 224000,
      impact_confidence: "high",
      impact_basis: "Últimos 7 dias",
      metrics: [
        { key: "ROAS", value: "4.8x", context: "baseline 1.6x", trend: "up" },
        { key: "CPA", value: "R$18", context: "baseline R$28", trend: "up" },
        { key: "Conv.", value: "12", context: "7d", trend: "up" },
      ],
      actions: [
        { id: "d5a", label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
        { id: "d5b", label: "Duplicar anúncio", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
      ],
      ad: {
        name: "Vídeo 05 — Demonstração",
        ad_set: {
          name: "Lookalike 1% Purchase",
          campaign: { name: "Escala — Produto Y" },
        },
      },
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(8),
    },
    {
      id: "demo_pattern_1",
      account_id: "demo",
      ad_id: "",
      type: "pattern",
      score: 48,
      priority_rank: 6,
      headline: 'CTA "Saiba mais" supera outros CTAs em +33% CTR',
      reason: "CTR médio: 2.8% (baseline conta: 2.1%)\n8 anúncios analisados, R$1.200 gasto total\nConsistente em todos os conjuntos de anúncio",
      impact_type: "learning",
      impact_daily: 0,
      impact_7d: 0,
      impact_confidence: "medium",
      impact_basis: "8 anúncios, últimos 14 dias",
      metrics: [
        { key: "CTR médio", value: "2.8%", context: "baseline 2.1%", trend: "up" },
        { key: "Amostra", value: "8 ads", context: "R$1.2k", trend: "stable" },
      ],
      actions: [
        { id: "d6a", label: "Aplicar padrão", type: "constructive", requires_confirmation: false },
        { id: "d6b", label: "Revisar dados", type: "neutral", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(45),
    },
    {
      id: "demo_pattern_2",
      account_id: "demo",
      ad_id: "",
      type: "pattern",
      score: 42,
      priority_rank: 7,
      headline: "Vídeo UGC supera outros formatos em CPA (-25%)",
      reason: "CPA médio: R$63,75 (baseline conta: R$85,00)\n6 anúncios analisados, R$890 gasto total\nUGC > estúdio > imagem estática nesta conta",
      impact_type: "learning",
      impact_daily: 0,
      impact_7d: 0,
      impact_confidence: "medium",
      impact_basis: "6 anúncios, últimos 14 dias",
      metrics: [
        { key: "CPA médio", value: "R$63,75", context: "baseline R$85", trend: "up" },
        { key: "Amostra", value: "6 ads", context: "R$890", trend: "stable" },
      ],
      actions: [
        { id: "d7a", label: "Aplicar padrão", type: "constructive", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: ago(52),
    },
  ];
}

function buildDemoMoneyTracker() {
  return {
    leaking_now: 27500,
    capturable_now: 44600,
    total_saved: 0,
  };
}

/**
 * FeedPage — Copilot Feed
 * Prioritized decisions ranked by financial impact.
 */
const FeedPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }>();
  const navigate = useNavigate();

  const { activeAccount, metaConnected, accountResolving } = ctx;
  const accountId = activeAccount?.id ?? null;

  const { decisions: realDecisions, isLoading: decisionsLoading } = useDecisions(accountId);
  const { tracker: realTracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  const [isDemo, setIsDemo] = useState(false);
  const hasRealData = realDecisions.length > 0;
  const showDemo = metaConnected && !hasRealData && !decisionsLoading && !trackerLoading && !accountResolving;

  useEffect(() => {
    setIsDemo(showDemo);
  }, [showDemo]);

  const decisions = isDemo ? buildDemoDecisions() : realDecisions;
  const tracker = isDemo ? buildDemoMoneyTracker() : realTracker;
  const isLoading = accountResolving || (accountId ? (decisionsLoading || trackerLoading) : false);

  const handleAction = async (decisionId: string, action: DecisionAction) => {
    if (isDemo) return;
    try {
      await executeAction(decisionId, action.meta_api_action || action.type, 'ad', '');
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const handleStopLosses = async () => {
    const killDecisions = decisions.filter(d => d.type === 'kill' && d.status === 'pending');
    for (const decision of killDecisions) {
      const primaryAction = decision.actions?.[0];
      if (primaryAction) {
        try { await handleAction(decision.id, primaryAction); }
        catch (err) { console.error('Stop loss failed for', decision.id, err); }
      }
    }
  };

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#08090b', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ width: 100, height: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 6 }} />
            <div style={{ width: 200, height: 10, background: 'rgba(255,255,255,0.02)', borderRadius: 3 }} />
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.015)', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.04)', padding: 16,
              marginBottom: 8, height: 120,
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ── No Meta connection ──
  if (!metaConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#08090b', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
              Feed
            </h1>
          </div>
          <EmptyState totalAds={0} nextSyncMinutes={0} todaySummary={{ paused: 0, scaled: 0, savedToday: 0, revenueToday: 0 }} />
        </div>
      </div>
    );
  }

  const pendingDecisions = decisions.filter(d => d.status === 'pending');
  const hasKills = pendingDecisions.some(d => d.type === 'kill');

  return (
    <div style={{ minHeight: '100vh', background: '#08090b', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header — minimal */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                fontSize: 16, fontWeight: 700,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: F, letterSpacing: '-0.02em', margin: 0,
              }}>
                Feed
              </h1>
              {isDemo && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: 3,
                  letterSpacing: '0.08em',
                }}>
                  DEMO
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {pendingDecisions.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: M,
                }}>
                  {pendingDecisions.length} item{pendingDecisions.length !== 1 ? 's' : ''}
                </span>
              )}
              {isDemo && (
                <button
                  onClick={() => navigate('/dashboard/accounts')}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 4, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: F,
                  }}
                >
                  Conectar conta
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Money tracker */}
        {tracker && (
          <div style={{ marginBottom: 16 }}>
            <MoneyBar
              leaking={(tracker as any).leaking_now || tracker.leaking_now}
              capturable={(tracker as any).capturable_now || tracker.capturable_now}
              totalSaved={(tracker as any).total_saved || 0}
              onStopLosses={hasKills && !isDemo ? handleStopLosses : undefined}
              onResolve={pendingDecisions.length > 0 ? () => {
                const el = document.querySelector('[data-decision-type]');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } : undefined}
            />
          </div>
        )}

        {/* Summary pills */}
        {pendingDecisions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Decision cards */}
        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingDecisions.map(decision => (
              <DecisionCard key={decision.id} decision={decision} onAction={handleAction} />
            ))}
          </div>
        ) : (
          <EmptyState totalAds={0} nextSyncMinutes={0} connected={metaConnected} todaySummary={{ paused: 0, scaled: 0, savedToday: 0, revenueToday: 0 }} />
        )}
      </div>
    </div>
  );
};

export default FeedPage;
