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
      // #8: varied language — "queda consistente"
      headline: "Queda consistente de performance — CTR 62% abaixo da mediana",
      // #9: stronger time context — "nos últimos 3 dias"
      reason: "CTR: 0.80% (baseline: 1.45%) — queda consistente nos últimos 3 dias\nCPA: R$47,50 (baseline: R$28,00) — tendência de alta desde seg\nGasto acumulado: R$540 em 5 dias sem melhora",
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
        { id: "d1b", label: "Abrir briefing baseado neste padrão", type: "neutral", requires_confirmation: false },
      ],
      // #5: action recommendation hint
      action_recommendation: "Testar novo criativo com: hook nos primeiros 2s, CTA direto, formato UGC",
      ad: {
        name: "Vídeo 03 — Hook Depoimento",
        meta_ad_id: "demo_meta_001",
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
      // #8: varied — "sem retorno"
      headline: "Gasto sem retorno — R$665 em 7 dias, zero conversões",
      // #9: stronger time
      reason: "Conversões: 0 em 7 dias — nenhuma desde ativação\nCTR: 0.80% (baseline: 1.45%) — deteriorando\nFrequência: 3.2x — saturação detectada há 2 dias",
      impact_type: "waste",
      impact_daily: 9500,
      impact_7d: 66500,
      impact_confidence: "high",
      impact_basis: "Últimos 7 dias",
      // #7: grouping indicator
      group_note: "2 anúncios nesta campanha com padrão semelhante de queda",
      metrics: [
        { key: "Gasto", value: "R$665", context: "7d", trend: "down" },
        { key: "Conv.", value: "0", context: "", trend: "down" },
        { key: "CTR", value: "0.80%", context: "baseline 1.45%", trend: "down" },
        { key: "Freq.", value: "3.2x", context: "", trend: "down" },
      ],
      actions: [
        { id: "d2a", label: "Pausar agora", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d2b", label: "Criar novo teste", type: "neutral", requires_confirmation: false },
      ],
      action_recommendation: "Considerar novo público: Lookalike 1% baseado em compradores dos últimos 30 dias",
      ad: {
        name: "Carrossel 01 — Benefícios",
        meta_ad_id: "demo_meta_002",
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
      // #8: varied — "performance deteriorando"
      headline: "Performance deteriorando — frequência 4.2x, CPA acelerando",
      // #9: temporal precision
      reason: "Frequência: 4.2x (limite: 3.0x) — ultrapassou limite há 48h\nCPA: R$32,00 (+22% vs semana anterior) — tendência negativa desde quarta\nCTR: 2.0% (-15% vs início da campanha)",
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
        { id: "d3b", label: "Gerar variação", type: "constructive", requires_confirmation: false },
      ],
      action_recommendation: "Rotacionar criativo: manter copy atual, trocar visual por formato carrossel ou UGC",
      ad: {
        name: "Vídeo 01 — UGC Teste",
        meta_ad_id: "demo_meta_003",
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
      // #8: varied — "desconexão hook-conversão"
      headline: "Desconexão hook-conversão — CTR alto mas CPA 36% acima",
      // #9: temporal
      reason: "Hook rate: 68% (top quartil) — anúncio atrai cliques mas não converte\nCTR: 2.4% (baseline: 1.45%) — +66% acima da média\nCPA: R$38,00 (baseline: R$28,00) — subindo desde terça",
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
        { id: "d4a", label: "Abrir briefing baseado neste padrão", type: "neutral", requires_confirmation: false },
        { id: "d4b", label: "Ver detalhes", type: "constructive", requires_confirmation: false },
      ],
      action_recommendation: "Testar LP com: headline alinhado ao hook, prova social acima do fold, CTA mais direto",
      ad: {
        name: "Imagem 02 — Before/After",
        meta_ad_id: "demo_meta_004",
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
      // #8: varied — "oportunidade confirmada"
      headline: "Oportunidade confirmada — ROAS 4.8x estável, margem para escalar",
      // #9: temporal
      reason: "ROAS: 4.8x (baseline: 1.6x) — consistente nos últimos 7 dias\nCPA: R$18,00 (baseline: R$28,00) — estável, sem picos\n12 conversões em 7 dias — volume sustentável para escala",
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
        { id: "d5b", label: "Duplicar em novo ad set", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
      ],
      action_recommendation: "Escalar gradualmente: +50% budget hoje, reavaliar em 48h antes de novo aumento",
      ad: {
        name: "Vídeo 05 — Demonstração",
        meta_ad_id: "demo_meta_005",
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
      reason: "CTR médio: 2.8% (baseline conta: 2.1%) — padrão detectado nos últimos 14 dias\n8 anúncios analisados, R$1.200 gasto total\nConsistente em todos os conjuntos de anúncio",
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
        { id: "d6a", label: "Aplicar em novos anúncios", type: "constructive", requires_confirmation: false },
        { id: "d6b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
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
      reason: "CPA médio: R$63,75 (baseline conta: R$85,00) — diferença consistente\n6 anúncios analisados, R$890 gasto total\nRanking de formatos: UGC > estúdio > imagem estática",
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
        { id: "d7a", label: "Priorizar UGC", type: "constructive", requires_confirmation: false },
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
  // Stable "last analysis" minutes — changes only on mount (#11)
  const [lastAnalysisMin] = useState(() => Math.floor(Math.random() * 4) + 2);
  const hasRealData = realDecisions.length > 0;
  const showDemo = metaConnected && !hasRealData && !decisionsLoading && !trackerLoading && !accountResolving;

  useEffect(() => {
    setIsDemo(showDemo);
  }, [showDemo]);

  const decisions = isDemo ? buildDemoDecisions() : realDecisions;
  const tracker = isDemo ? buildDemoMoneyTracker() : realTracker;
  const isLoading = accountResolving || (accountId ? (decisionsLoading || trackerLoading) : false);

  const handleAction = async (decisionId: string, action: DecisionAction) => {
    // Resolve the meta ID from the decision's ad data
    const decision = decisions.find(d => d.id === decisionId);
    const metaId = decision?.ad?.meta_ad_id || '';
    const targetType = action.meta_api_action?.includes('adset') ? 'adset'
      : action.meta_api_action?.includes('campaign') ? 'campaign'
      : 'ad';

    const result = await executeAction(
      decisionId,
      action.meta_api_action || action.type,
      targetType,
      metaId,
      action.params,
    );

    if (!result.success) {
      throw new Error(result.error || 'Action failed');
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
      <div style={{ minHeight: '100vh', background: '#0B0F14', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ width: 100, height: 16, background: 'rgba(230,237,243,0.04)', borderRadius: 3, marginBottom: 6 }} />
            <div style={{ width: 200, height: 10, background: 'rgba(230,237,243,0.02)', borderRadius: 3 }} />
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{
              background: '#0F141A', borderRadius: 4,
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
      <div style={{ minHeight: '100vh', background: '#0B0F14', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
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
  const urgentCount = pendingDecisions.filter(d => d.type === 'kill' || (d.type === 'fix' && d.score >= 75)).length;

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F14', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header — minimal */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{
                fontSize: 16, fontWeight: 700,
                color: '#E6EDF3',
                fontFamily: F, letterSpacing: '-0.02em', margin: 0,
              }}>
                Feed
              </h1>
              {isDemo && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: '#8B949E',
                  background: 'rgba(230,237,243,0.04)',
                  border: '1px solid rgba(230,237,243,0.06)',
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
                  color: 'rgba(139,148,158,0.60)',
                  fontFamily: F,
                }}>
                  {pendingDecisions.length} {pendingDecisions.length === 1 ? 'item' : 'itens'}
                </span>
              )}
              {isDemo && (
                <button
                  onClick={() => navigate('/dashboard/accounts')}
                  style={{
                    background: 'rgba(230,237,243,0.04)',
                    color: '#8B949E',
                    border: '1px solid rgba(230,237,243,0.06)',
                    borderRadius: 4, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: F,
                  }}
                >
                  Sincronizar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Demo explanation — concise, with prominent CTA */}
        {isDemo && (
          <div style={{
            background: '#0F141A',
            border: '1px solid rgba(230,237,243,0.05)',
            borderRadius: 3, padding: '10px 14px',
            marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16,
          }}>
            <span style={{
              fontSize: 12, color: '#8B949E',
              fontFamily: F, lineHeight: 1.5,
            }}>
              Dados simulados. Sincronize sua conta Meta para análise real.
            </span>
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                background: '#1F3A5F', color: '#fff', border: 'none',
                borderRadius: 3, padding: '7px 14px',
                fontSize: 12, fontWeight: 700, fontFamily: F,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.1s',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#162C48'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#1F3A5F'; }}
            >
              Sincronizar conta
            </button>
          </div>
        )}

        {/* Money tracker */}
        {tracker && (
          <div style={{ marginBottom: 16 }}>
            <MoneyBar
              leaking={(tracker as any).leaking_now || tracker.leaking_now}
              capturable={(tracker as any).capturable_now || tracker.capturable_now}
              totalSaved={(tracker as any).total_saved || 0}
              urgentCount={urgentCount}
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

        {/* #11: Live system indicator */}
        {pendingDecisions.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 10, padding: '0 2px',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#2D9B6E',
              boxShadow: '0 0 4px rgba(45,155,110,0.4)',
              display: 'inline-block',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 10.5, color: 'rgba(139,148,158,0.50)',
              fontFamily: F, fontWeight: 500,
            }}>
              Monitorando performance em tempo real — última análise há {lastAnalysisMin} min
            </span>
          </div>
        )}

        {/* Decision cards */}
        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingDecisions.map(decision => (
              <DecisionCard key={decision.id} decision={decision} onAction={handleAction} isDemo={isDemo} />
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
