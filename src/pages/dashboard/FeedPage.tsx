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

const F = "'Plus Jakarta Sans', sans-serif";
const M = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";

// ================================================================
// DEMO MODE — Realistic sample feed for when no real data exists
// Must look like real production output, NOT fake placeholder.
// ================================================================

function buildDemoDecisions(): Decision[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo_kill_1",
      account_id: "demo",
      ad_id: "demo_ad_001",
      type: "kill",
      score: 94,
      priority_rank: 1,
      headline: "R$180/dia em perda potencial identificada",
      reason: "CTR 0.80% — 62% abaixo da mediana\nCPA R$47,50 — 2.8x acima da mediana\nGasto: R$540 em 5 dias sem retorno proporcional",
      impact_type: "waste",
      impact_daily: 18000,
      impact_7d: 126000,
      impact_confidence: "high",
      impact_basis: "Baseado nos últimos 5 dias de performance",
      metrics: [
        { key: "CTR", value: "0.80%", context: "-62% vs mediana", trend: "down" },
        { key: "CPA", value: "R$47,50", context: "2.8x acima", trend: "down" },
        { key: "Gasto", value: "R$540", context: "5 dias", trend: "stable" },
        { key: "Conversões", value: "2", context: "", trend: "down" },
      ],
      actions: [
        { id: "d1a", label: "Pausar anúncio", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d1b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_kill_2",
      account_id: "demo",
      ad_id: "demo_ad_002",
      type: "kill",
      score: 89,
      priority_rank: 2,
      headline: "Estimativa de R$95/dia sem conversão",
      reason: "Gasto: R$665 em 7 dias\nConversões: 0\nCTR 0.80% — abaixo da mediana da conta",
      impact_type: "waste",
      impact_daily: 9500,
      impact_7d: 66500,
      impact_confidence: "high",
      impact_basis: "Baseado em zero conversões com gasto significativo",
      metrics: [
        { key: "Gasto", value: "R$665", context: "7 dias", trend: "down" },
        { key: "Conversões", value: "0", context: "", trend: "down" },
        { key: "CTR", value: "0.80%", context: "-58% vs mediana", trend: "down" },
        { key: "Frequência", value: "3.2x", context: "", trend: "down" },
      ],
      actions: [
        { id: "d2a", label: "Pausar agora", type: "destructive", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d2b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_fix_1",
      account_id: "demo",
      ad_id: "demo_ad_003",
      type: "fix",
      score: 78,
      priority_rank: 3,
      headline: "Fadiga criativa detectada — frequência 4.2x",
      reason: "Frequência: 4.2x — acima do limite recomendado\nCPA R$32,00 — subindo nos últimos 3 dias\nCTR 2.0% — em queda vs início da campanha",
      impact_type: "savings",
      impact_daily: 7200,
      impact_7d: 50400,
      impact_confidence: "medium",
      impact_basis: "Frequência 4.2x — estimativa de 30% de perda por fadiga",
      metrics: [
        { key: "Frequência", value: "4.2x", context: "acima do limite", trend: "down" },
        { key: "CPA", value: "R$32,00", context: "+22% vs semana anterior", trend: "down" },
        { key: "CTR", value: "2.0%", context: "-15% vs início", trend: "down" },
      ],
      actions: [
        { id: "d3a", label: "Pausar 3 dias", type: "neutral", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d3b", label: "Entender impacto", type: "constructive", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_fix_2",
      account_id: "demo",
      ad_id: "demo_ad_004",
      type: "fix",
      score: 72,
      priority_rank: 4,
      headline: "Engajamento alto, conversão abaixo do esperado",
      reason: "Hook rate 68% — top quartil da conta\nCTR 2.4% — acima da mediana\nCPA R$38,00 — 2.2x acima da mediana (possível problema na oferta ou LP)",
      impact_type: "savings",
      impact_daily: 5400,
      impact_7d: 37800,
      impact_confidence: "medium",
      impact_basis: "Baseado na diferença de CPA vs mediana da conta",
      metrics: [
        { key: "Hook rate", value: "68%", context: "top quartil", trend: "up" },
        { key: "CTR", value: "2.4%", context: "+18% vs mediana", trend: "up" },
        { key: "CPA", value: "R$38,00", context: "2.2x acima", trend: "down" },
      ],
      actions: [
        { id: "d4a", label: "Entender impacto", type: "neutral", requires_confirmation: false },
        { id: "d4b", label: "Revisar dados", type: "constructive", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_scale_1",
      account_id: "demo",
      ad_id: "demo_ad_005",
      type: "scale",
      score: 65,
      priority_rank: 5,
      headline: "ROAS 4.8x acima da base — oportunidade de escala",
      reason: "ROAS 4.8x — 3x acima da mediana (1.6x)\nCPA R$18,00 — 79% abaixo do teto da conta\n12 conversões em 7 dias com tendência estável",
      impact_type: "revenue",
      impact_daily: 32000,
      impact_7d: 224000,
      impact_confidence: "high",
      impact_basis: "Projeção com +50% de budget (12 conversões atuais)",
      metrics: [
        { key: "ROAS", value: "4.8x", context: "3x acima da mediana", trend: "up" },
        { key: "CPA", value: "R$18,00", context: "-79% vs teto", trend: "up" },
        { key: "Conversões", value: "12", context: "7 dias", trend: "up" },
      ],
      actions: [
        { id: "d5a", label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
        { id: "d5b", label: "Duplicar anúncio", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_pattern_1",
      account_id: "demo",
      ad_id: "",
      type: "pattern",
      score: 48,
      priority_rank: 6,
      headline: 'Padrão: CTA "Saiba mais" supera outros CTAs',
      reason: "CTR médio 2.8% — +33% vs baseline da conta\n8 anúncios analisados com R$1.200 de gasto total\nPerformance consistente acima da média em todos os conjuntos",
      impact_type: "learning",
      impact_daily: 0,
      impact_7d: 0,
      impact_confidence: "medium",
      impact_basis: "Baseado em 8 anúncios com R$1.200 de gasto total",
      metrics: [
        { key: "CTR médio", value: "2.8%", context: "+33% vs baseline", trend: "up" },
        { key: "Amostra", value: "8 anúncios", context: "", trend: "stable" },
      ],
      actions: [
        { id: "d6a", label: "Priorizar esse padrão", type: "constructive", requires_confirmation: false },
        { id: "d6b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
    {
      id: "demo_pattern_2",
      account_id: "demo",
      ad_id: "",
      type: "pattern",
      score: 42,
      priority_rank: 7,
      headline: "Padrão: vídeo UGC supera outros formatos",
      reason: "CPA médio R$63,75 — 25% menor vs baseline da conta\n6 anúncios analisados com R$890 de gasto total\nFormato UGC superando estúdio e imagem estática",
      impact_type: "learning",
      impact_daily: 0,
      impact_7d: 0,
      impact_confidence: "medium",
      impact_basis: "Baseado em 6 anúncios com R$890 de gasto total",
      metrics: [
        { key: "CPA médio", value: "R$63,75", context: "-25% vs baseline", trend: "up" },
        { key: "Amostra", value: "6 anúncios", context: "", trend: "stable" },
      ],
      actions: [
        { id: "d7a", label: "Priorizar esse formato", type: "constructive", requires_confirmation: false },
      ],
      status: "pending",
      acted_at: null,
      dismissed_at: null,
      created_at: now,
    },
  ];
}

function buildDemoMoneyTracker() {
  return {
    leaking_now: 27500,   // R$275/dia
    capturable_now: 44600, // R$446/dia
    total_saved: 0,
  };
}

/**
 * FeedPage — Copilot Feed: Decision Cards (KILL / FIX / SCALE / PATTERN / INSIGHT)
 * The brain of AdBrief. Prioritized feed of decisions ranked by financial impact.
 */
const FeedPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }>();
  const navigate = useNavigate();

  const { activeAccount, metaConnected, accountResolving } = ctx;

  // Use the v2 ad_accounts UUID for queries
  const accountId = activeAccount?.id ?? null;

  const { decisions: realDecisions, isLoading: decisionsLoading } = useDecisions(accountId);
  const { tracker: realTracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  // Demo mode: show when connected but no real decisions yet
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
    if (isDemo) {
      // In demo mode, dismiss the card visually (no real action)
      return;
    }
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
        try {
          await handleAction(decision.id, primaryAction);
        } catch (err) {
          console.error('Stop loss failed for', decision.id, err);
        }
      }
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ width: 130, height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 6 }} />
            <div style={{ width: 260, height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', padding: '48px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            minHeight: 220,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ width: 200, height: 18, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
            <div style={{ width: 280, height: 13, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
          </div>
        </div>
      </div>
    );
  }

  // ── No Meta connection — nudge to connect ──
  if (!metaConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
              Copilot Feed
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
    <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
                Copilot Feed
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: '4px 0 0', fontFamily: F }}>
                Decisões baseadas no desempenho real da sua conta
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isDemo && (
                <span style={{
                  fontSize: 10.5, fontWeight: 700,
                  color: '#fbbf24',
                  background: 'rgba(245,158,11,0.10)',
                  border: '1px solid rgba(245,158,11,0.20)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  DEMO
                </span>
              )}
              {pendingDecisions.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  fontFamily: F,
                }}>
                  {pendingDecisions.length} pendente{pendingDecisions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Money tracker */}
        {tracker && (
          <div style={{ marginBottom: 24 }}>
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
          <div style={{ marginBottom: 20 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Demo banner — explains what this is */}
        {isDemo && (
          <div style={{
            background: 'rgba(245,158,11,0.04)',
            border: '1px solid rgba(245,158,11,0.12)',
            borderRadius: 10, padding: '14px 20px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: 0, fontFamily: F, lineHeight: 1.5 }}>
                <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Conecte sua conta para identificar perdas na sua operação.</strong>
                {' '}Estes são exemplos do tipo de decisão que o motor gera com dados reais.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard/accounts')}
              style={{
                background: 'rgba(14,165,233,0.10)',
                color: '#38bdf8',
                border: '1px solid rgba(14,165,233,0.20)',
                borderRadius: 8, padding: '8px 16px',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
                whiteSpace: 'nowrap', marginLeft: 16,
              }}
            >
              Sincronizar conta
            </button>
          </div>
        )}

        {/* Decision cards */}
        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
