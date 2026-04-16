import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { MoneyBar } from '../../components/feed/MoneyBar';
import { SummaryBar } from '../../components/feed/SummaryBar';
import { DecisionCard } from '../../components/feed/DecisionCard';
import { useDecisions } from '../../hooks/useDecisions';
import { useMoneyTracker } from '../../hooks/useMoneyTracker';
import { useActions } from '../../hooks/useActions';
import { supabase } from '@/integrations/supabase/client';
import type { Decision, DecisionAction } from '../../types/v2-database';
import { PatternsPanel } from '../../components/dashboard/PatternsPanel';
import { GoalSetup } from '../../components/feed/GoalSetup';
import { TrendingUp, TrendingDown, Minus, Pause, Play } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── localStorage helpers ──
const DEMO_DISMISS_KEY = 'adbrief_demo_dismissed';

function isDemoDismissedToday(): boolean {
  try {
    const val = localStorage.getItem(DEMO_DISMISS_KEY);
    if (!val) return false;
    return val === new Date().toISOString().slice(0, 10);
  } catch { return false; }
}

function dismissDemoToday(): void {
  try {
    localStorage.setItem(DEMO_DISMISS_KEY, new Date().toISOString().slice(0, 10));
  } catch {}
}

// ── Shared sub-components ──

/** Confidence badge — always visible per spec */
const ConfidenceBadge: React.FC<{ level: 'baixa' | 'média' | 'alta' }> = ({ level }) => {
  const dotColor = {
    baixa: '#FBBF24',
    média: '#38BDF8',
    alta:  '#4ADE80',
  }[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      padding: '3px 8px', borderRadius: 3, fontFamily: F,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: dotColor,
        boxShadow: `0 0 6px ${dotColor}40`,
      }} />
      Confiança: {level}
    </span>
  );
};

/** Period options for metrics filter */
type PeriodKey = '7d' | '14d' | '30d';
const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 dias',  days: 7  },
  { key: '14d', label: '14 dias', days: 14 },
  { key: '30d', label: '30 dias', days: 30 },
];

// ── VISIBLE WIN — Celebrate results with dopamine ──
const VisibleWin: React.FC<{
  decisions: Decision[];
  tracker: any;
}> = ({ decisions, tracker }) => {
  // Find actioned decisions (status = 'actioned' or 'resolved')
  const actioned = decisions.filter((d: any) =>
    d.status === 'actioned' || d.status === 'resolved'
  );
  const totalSaved = (tracker?.total_saved || 0);

  // Show win block if there's saved money OR actioned decisions
  if (totalSaved <= 0 && actioned.length === 0) return null;

  // Calculate best win from actioned decisions
  const bestWin = actioned.length > 0
    ? actioned.reduce((best: any, d: any) =>
        (d.impact_daily || 0) > (best.impact_daily || 0) ? d : best
      , actioned[0])
    : null;

  const totalImpact = actioned.reduce((s: number, d: any) => s + (d.impact_daily || 0), 0);
  const monthlyImpact = totalImpact * 30;

  return (
    <div style={{
      borderLeft: '2px solid rgba(74,222,128,0.30)',
      padding: '12px 16px', marginBottom: 14,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.50)',
        letterSpacing: '0.12em', marginBottom: 6,
      }}>RESULTADO ALCANÇADO</div>

      {bestWin && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#F0F6FC', fontFamily: F }}>
            {bestWin.type === 'kill' ? '-' : '+'}R${Math.round(Math.abs(totalImpact) / 100).toLocaleString('pt-BR')}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', marginLeft: 4, fontWeight: 600 }}>/dia</span>
        </div>
      )}

      {monthlyImpact > 0 && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.60)', fontFamily: F, marginBottom: 4 }}>
          Impacto projetado: <span style={{ color: '#4ADE80', fontWeight: 600 }}>
            +R${Math.round(monthlyImpact / 100).toLocaleString('pt-BR')}/mês
          </span>
        </div>
      )}

      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)', fontFamily: F, overflowWrap: 'break-word' }}>
        → baseado nos seus dados reais de performance · {actioned.length} {actioned.length === 1 ? 'otimização aplicada' : 'otimizações aplicadas'}
      </div>
    </div>
  );
};

// ── SYSTEM STATUS — "Sistema ativo" confidence block ──
const SystemStatus: React.FC<{
  decisions: Decision[];
  tracker: any;
  patternsCount?: number;
}> = ({ decisions, tracker, patternsCount = 0 }) => {
  const actioned = decisions.filter((d: any) => d.status === 'actioned' || d.status === 'resolved');
  const totalCapture = (tracker?.capturable_now || 0) + (tracker?.leaking_now || 0);
  const monthlyEstimate = Math.round(totalCapture * 30 / 100);

  // Only show when there's meaningful activity
  if (patternsCount === 0 && actioned.length === 0 && totalCapture === 0) return null;

  return (
    <div style={{
      padding: '10px 2px', marginBottom: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '6px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#4ADE80',
          boxShadow: '0 0 8px rgba(74,222,128,0.40)',
          animation: 'pulse 2.5s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#F0F6FC', fontFamily: F }}>
            Sistema ativo
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)', fontFamily: F, marginTop: 1, overflowWrap: 'break-word' }}>
            {patternsCount > 0 && `${patternsCount} padrões validados`}
            {patternsCount > 0 && actioned.length > 0 && ' · '}
            {actioned.length > 0 && `${actioned.length} ${actioned.length === 1 ? 'otimização aplicada' : 'otimizações aplicadas'}`}
          </div>
        </div>
      </div>
      {monthlyEstimate > 0 && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', fontFamily: F }}>
            +R${monthlyEstimate.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.60)', fontFamily: F }}>
            impacto projetado/mês
          </div>
        </div>
      )}
    </div>
  );
};

const PeriodSelector: React.FC<{ value: PeriodKey; onChange: (k: PeriodKey) => void }> = ({ value, onChange }) => (
  <div className="feed-micro-btn" style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: 2 }}>
    {PERIODS.map(p => {
      const active = p.key === value;
      return (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
          color: active ? '#F0F6FC' : 'rgba(255,255,255,0.45)',
          border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: 3, padding: '4px 10px',
          fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: F, transition: 'all 0.12s',
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; } }}>
          {p.label}
        </button>
      );
    })}
  </div>
);

/** Teal CTA button used across states */
const ActionButton: React.FC<{ label: string; onClick: () => void; variant?: 'primary' | 'ghost' }> = ({
  label, onClick, variant = 'primary',
}) => {
  const [hov, setHov] = useState(false);
  if (variant === 'ghost') {
    return (
      <button onClick={onClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          background: 'transparent', color: '#0ea5e9', border: 'none',
          padding: '4px 0', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: F,
          opacity: hov ? 0.7 : 1, transition: 'opacity 0.1s',
        }}>
        {label}
      </button>
    );
  }
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#0c8bd0' : '#0ea5e9', color: '#F0F6FC', border: 'none',
        padding: '9px 18px', borderRadius: 3, fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: F, transition: 'background 0.1s',
      }}>
      {label}
    </button>
  );
};

// ================================================================
// DEMO DATA
// ================================================================

function buildDemoDecisions(): Decision[] {
  const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
  return [
    {
      id: "demo_kill_1", account_id: "demo", ad_id: "demo_ad_001", type: "kill", score: 94, priority_rank: 1,
      headline: "Queda consistente de performance — CTR 62% abaixo da mediana",
      reason: "CTR: 0.80% (baseline: 1.45%) — queda consistente nos últimos 3 dias\nCPA: R$47,50 (baseline: R$28,00) — tendência de alta desde seg\nGasto acumulado: R$540 em 5 dias sem melhora",
      impact_type: "waste", impact_daily: 18000, impact_7d: 126000, impact_confidence: "high", impact_basis: "Últimos 5 dias",
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
      action_recommendation: "Testar novo criativo com: hook nos primeiros 2s, CTA direto, formato UGC", group_note: null,
      ad: { name: "Vídeo 03 — Hook Depoimento", meta_ad_id: "demo_meta_001",
        ad_set: { name: "Broad BR 25-45", campaign: { name: "Conversão — Produto X" } as any } as any } as any,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(12),
    },
    {
      id: "demo_kill_2", account_id: "demo", ad_id: "demo_ad_002", type: "kill", score: 89, priority_rank: 2,
      headline: "Gasto sem retorno — R$665 em 7 dias, zero conversões",
      reason: "Conversões: 0 em 7 dias — nenhuma desde ativação\nCTR: 0.80% (baseline: 1.45%) — deteriorando\nFrequência: 3.2x — saturação detectada há 2 dias",
      impact_type: "waste", impact_daily: 9500, impact_7d: 66500, impact_confidence: "high", impact_basis: "Últimos 7 dias",
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
      ad: { name: "Carrossel 01 — Benefícios", meta_ad_id: "demo_meta_002",
        ad_set: { name: "Interesse Fitness", campaign: { name: "Conversão — Produto X" } as any } as any } as any,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(18),
    },
    {
      id: "demo_fix_1", account_id: "demo", ad_id: "demo_ad_003", type: "fix", score: 78, priority_rank: 3,
      headline: "Performance deteriorando — frequência 4.2x, CPA acelerando",
      reason: "Frequência: 4.2x (limite: 3.0x) — ultrapassou limite há 48h\nCPA: R$32,00 (+22% vs semana anterior) — tendência negativa desde quarta\nCTR: 2.0% (-15% vs início da campanha)",
      impact_type: "savings", impact_daily: 7200, impact_7d: 50400, impact_confidence: "medium", impact_basis: "Últimos 5 dias",
      metrics: [
        { key: "Freq.", value: "4.2x", context: "limite 3.0x", trend: "down" },
        { key: "CPA", value: "R$32", context: "+22%", trend: "down" },
        { key: "CTR", value: "2.0%", context: "-15%", trend: "down" },
      ],
      actions: [
        { id: "d3a", label: "Pausar 3 dias", type: "neutral", requires_confirmation: true, meta_api_action: "pause_ad" },
        { id: "d3b", label: "Gerar variação", type: "constructive", requires_confirmation: false },
      ],
      action_recommendation: "Rotacionar criativo: manter copy atual, trocar visual por formato carrossel ou UGC", group_note: null,
      ad: { name: "Vídeo 01 — UGC Teste", meta_ad_id: "demo_meta_003",
        ad_set: { name: "Lookalike 1% Purchase", campaign: { name: "Escala — Produto Y" } as any } as any } as any,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(25),
    },
    {
      id: "demo_fix_2", account_id: "demo", ad_id: "demo_ad_004", type: "fix", score: 72, priority_rank: 4,
      headline: "Desconexão hook-conversão — CTR alto mas CPA 36% acima",
      reason: "Hook rate: 68% (top quartil) — anúncio atrai cliques mas não converte\nCTR: 2.4% (baseline: 1.45%) — +66% acima da média\nCPA: R$38,00 (baseline: R$28,00) — subindo desde terça",
      impact_type: "savings", impact_daily: 5400, impact_7d: 37800, impact_confidence: "medium", impact_basis: "Últimos 5 dias",
      metrics: [
        { key: "Hook", value: "68%", context: "p90", trend: "up" },
        { key: "CTR", value: "2.4%", context: "+66%", trend: "up" },
        { key: "CPA", value: "R$38", context: "baseline R$28", trend: "down" },
      ],
      actions: [
        { id: "d4a", label: "Abrir briefing baseado neste padrão", type: "neutral", requires_confirmation: false },
        { id: "d4b", label: "Ver detalhes", type: "constructive", requires_confirmation: false },
      ],
      action_recommendation: "Testar LP com: headline alinhado ao hook, prova social acima do fold, CTA mais direto", group_note: null,
      ad: { name: "Imagem 02 — Before/After", meta_ad_id: "demo_meta_004",
        ad_set: { name: "Broad BR 25-45", campaign: { name: "Conversão — Produto X" } as any } as any } as any,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(32),
    },
    {
      id: "demo_scale_1", account_id: "demo", ad_id: "demo_ad_005", type: "scale", score: 65, priority_rank: 5,
      headline: "Oportunidade confirmada — ROAS 4.8x estável, margem para escalar",
      reason: "ROAS: 4.8x (baseline: 1.6x) — consistente nos últimos 7 dias\nCPA: R$18,00 (baseline: R$28,00) — estável, sem picos\n12 conversões em 7 dias — volume sustentável para escala",
      impact_type: "revenue", impact_daily: 32000, impact_7d: 224000, impact_confidence: "high", impact_basis: "Últimos 7 dias",
      metrics: [
        { key: "ROAS", value: "4.8x", context: "baseline 1.6x", trend: "up" },
        { key: "CPA", value: "R$18", context: "baseline R$28", trend: "up" },
        { key: "Conv.", value: "12", context: "7d", trend: "up" },
      ],
      actions: [
        { id: "d5a", label: "Aumentar budget +50%", type: "constructive", requires_confirmation: true, meta_api_action: "increase_budget" },
        { id: "d5b", label: "Duplicar em novo ad set", type: "constructive", requires_confirmation: false, meta_api_action: "duplicate_ad" },
      ],
      action_recommendation: "Escalar gradualmente: +50% budget hoje, reavaliar em 48h antes de novo aumento", group_note: null,
      ad: { name: "Vídeo 05 — Demonstração", meta_ad_id: "demo_meta_005",
        ad_set: { name: "Lookalike 1% Purchase", campaign: { name: "Escala — Produto Y" } as any } as any } as any,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(8),
    },
    {
      id: "demo_pattern_1", account_id: "demo", ad_id: "", type: "pattern", score: 48, priority_rank: 6,
      headline: 'CTA "Saiba mais" supera outros CTAs em +33% CTR',
      reason: "CTR médio: 2.8% (baseline conta: 2.1%) — padrão detectado nos últimos 14 dias\n8 anúncios analisados, R$1.200 gasto total\nConsistente em todos os conjuntos de anúncio",
      impact_type: "learning", impact_daily: 0, impact_7d: 0, impact_confidence: "medium", impact_basis: "8 anúncios, últimos 14 dias",
      metrics: [
        { key: "CTR médio", value: "2.8%", context: "baseline 2.1%", trend: "up" },
        { key: "Amostra", value: "8 ads", context: "R$1.2k", trend: "stable" },
      ],
      actions: [
        { id: "d6a", label: "Aplicar em novos anúncios", type: "constructive", requires_confirmation: false },
        { id: "d6b", label: "Ver detalhes", type: "neutral", requires_confirmation: false },
      ],
      action_recommendation: null, group_note: null,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(45),
    },
    {
      id: "demo_pattern_2", account_id: "demo", ad_id: "", type: "pattern", score: 42, priority_rank: 7,
      headline: "Vídeo UGC supera outros formatos em CPA (-25%)",
      reason: "CPA médio: R$63,75 (baseline conta: R$85,00) — diferença consistente\n6 anúncios analisados, R$890 gasto total\nRanking de formatos: UGC > estúdio > imagem estática",
      impact_type: "learning", impact_daily: 0, impact_7d: 0, impact_confidence: "medium", impact_basis: "6 anúncios, últimos 14 dias",
      metrics: [
        { key: "CPA médio", value: "R$63,75", context: "baseline R$85", trend: "up" },
        { key: "Amostra", value: "6 ads", context: "R$890", trend: "stable" },
      ],
      actions: [{ id: "d7a", label: "Priorizar UGC", type: "constructive", requires_confirmation: false }],
      action_recommendation: null, group_note: null,
      status: "pending", acted_at: null, dismissed_at: null, created_at: ago(52),
    },
  ];
}

function buildDemoMoneyTracker() {
  return { leaking_now: 27500, capturable_now: 44600, total_saved: 0 };
}

// ================================================================
// INLINE SYNC BANNER — compact progress bar (no full-page overlay)
// ================================================================
const SYNC_STEPS = [
  'Conectando ao Meta Ads...',
  'Importando campanhas e anúncios...',
  'Calculando métricas e baselines...',
  'Gerando decisões...',
];

const SyncBanner: React.FC = () => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1200),
      setTimeout(() => setStep(2), 2800),
      setTimeout(() => setStep(3), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      background: '#0C1017', border: '1px solid rgba(14,165,233,0.12)',
      borderRadius: 4, padding: '14px 16px', fontFamily: F, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 28 28" style={{ animation: 'sync-spin 2s linear infinite', flexShrink: 0 }}>
          <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="1.5"/>
          <circle cx="14" cy="14" r="2.5" fill="#0ea5e9"/>
          <path d="M14 14 L14 2 A12 12 0 0 1 24.39 8.0 Z" fill="rgba(14,165,233,0.25)"/>
          <line x1="14" y1="14" x2="14" y2="2" stroke="rgba(14,165,233,0.5)" strokeWidth="1"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#F0F6FC' }}>
          {SYNC_STEPS[step] || SYNC_STEPS[SYNC_STEPS.length - 1]}
        </span>
      </div>
      <div style={{
        height: 3, borderRadius: 2,
        background: 'rgba(230,237,243,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2, background: '#0ea5e9',
          width: `${((step + 1) / SYNC_STEPS.length) * 90}%`,
          transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <style>{`
        @keyframes sync-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
};

// ================================================================
// TELEGRAM CONNECTION CARD — two states: disconnected / connected
// ================================================================

/** Shared Telegram icon */
const TelegramIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 1000 1000" fill="none">
    <defs>
      <linearGradient id="tg-grad" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%" stopColor="#2AABEE"/>
        <stop offset="100%" stopColor="#229ED9"/>
      </linearGradient>
    </defs>
    <circle cx="500" cy="500" r="500" fill="url(#tg-grad)"/>
    <path d="M226.328419,494.722069 C372.088573,431.216685 469.284839,389.350049 517.917216,369.122161 C656.772535,311.36743 685.625481,301.334815 704.431427,301.003532 C708.567621,300.93067 717.815839,301.955743 723.806446,306.816707 C728.864797,310.92121 730.256552,316.46581 730.922551,320.357329 C731.588551,324.248848 732.417879,333.113828 731.758626,340.040666 C724.234007,419.102486 691.675104,610.964674 675.110982,699.515267 C668.10208,736.984342 654.301336,749.547532 640.940618,750.777006 C611.904684,753.448938 589.856115,731.588035 561.733393,713.153237 C517.726886,684.306416 492.866009,666.349181 450.150074,638.200013 C400.78442,605.66878 432.786119,587.789048 460.919462,558.568563 C468.282091,550.921423 596.21508,434.556479 598.691227,424.000355 C599.00091,422.680135 599.288312,417.758981 596.36474,415.160431 C593.441168,412.561881 589.126229,413.450484 586.012448,414.157198 C581.598758,415.158943 511.297793,461.625274 375.109553,553.556189 C355.154858,567.258623 337.080515,573.934908 320.886524,573.585046 C303.033948,573.199351 268.692754,563.490928 243.163606,555.192408 C211.851067,545.013936 186.964484,539.632504 189.131547,522.346309 C190.260287,513.342589 202.659244,504.134509 226.328419,494.722069 Z" fill="#FFFFFF"/>
  </svg>
);

interface TelegramConn {
  chat_id: string;
  telegram_username: string | null;
  connected_at: string;
}

const TelegramCard: React.FC<{ userId: string }> = ({ userId }) => {
  const [conn, setConn] = useState<TelegramConn | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pairingLink, setPairingLink] = useState<string | null>(null);
  const [btnHov, setBtnHov] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (supabase as any).from('telegram_connections')
      .select('chat_id, telegram_username, connected_at')
      .eq('user_id', userId).eq('active', true).maybeSingle()
      .then(({ data }: any) => { setConn(data || null); setLoading(false); });
  }, [userId]);

  const handleConnect = async () => {
    setGenerating(true);
    try {
      const tok = Math.random().toString(36).slice(2,8) + Math.random().toString(36).slice(2,8);
      await (supabase as any).from('telegram_pairing_tokens').insert({
        user_id: userId, token: tok,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      const link = `https://t.me/AdBriefAlertsBot?start=${tok}`;
      setPairingLink(link);
      window.open(link, '_blank', 'noopener');
    } catch (e) { console.error('[TelegramCard]', e); }
    setGenerating(false);
  };

  useEffect(() => {
    if (!pairingLink || conn) return;
    const interval = setInterval(async () => {
      const { data } = await (supabase as any).from('telegram_connections')
        .select('chat_id, telegram_username, connected_at')
        .eq('user_id', userId).eq('active', true).maybeSingle();
      if (data) { setConn(data); setPairingLink(null); }
    }, 3000);
    return () => clearInterval(interval);
  }, [pairingLink, conn, userId]);

  if (loading) return null;

  // Summary line for collapsed state
  const summaryText = conn
    ? `Alertas ativos${conn.telegram_username ? ` · @${conn.telegram_username}` : ''}`
    : pairingLink ? 'Aguardando autorização...' : 'Não conectado';
  const summaryColor = conn ? '#2AABEE' : pairingLink ? '#FBBF24' : 'rgba(255,255,255,0.40)';

  return (
    <div style={{ fontFamily: F, marginBottom: 8 }}>
      {/* ── Collapsible header ── */}
      <div
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 2px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 14, lineHeight: 1,
          color: open ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)',
          transition: 'transform 0.2s ease, color 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>›</span>
        <TelegramIcon size={16} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F6FC', letterSpacing: '-0.01em', flexShrink: 0 }}>
          Telegram
        </span>
        {conn && (
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: '#2AABEE',
            boxShadow: '0 0 4px rgba(42,171,238,0.5)', flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: 10.5, fontWeight: 500, color: summaryColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {summaryText}
        </span>
      </div>

      {/* ── Collapsible body ── */}
      <FeedExpandable open={open}>
        <div>
          {/* CONNECTED */}
          {conn && (
            <div style={{
              background: '#0C1017', border: '1px solid rgba(42,171,238,0.10)',
              borderRadius: 4, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6 }}>
                Você será notificado quando: perdas forem detectadas, oportunidades surgirem, ações forem necessárias.
              </div>
            </div>
          )}

          {/* PAIRING */}
          {!conn && pairingLink && (
            <div style={{
              background: '#0C1017', border: '1px solid rgba(42,171,238,0.12)',
              borderRadius: 4, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4, marginBottom: 10 }}>
                Abra o bot no Telegram e toque em <strong style={{ color: '#F0F6FC' }}>Iniciar</strong> para conectar.
              </div>
              <div style={{ height: 2, borderRadius: 1, background: 'rgba(42,171,238,0.10)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#2AABEE', width: '60%', animation: 'tg-progress 1.5s ease-in-out infinite alternate' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <button onClick={() => window.open(pairingLink, '_blank', 'noopener')}
                  style={{
                    background: 'rgba(42,171,238,0.08)', color: '#2AABEE',
                    border: '1px solid rgba(42,171,238,0.15)', borderRadius: 3,
                    padding: '5px 10px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: F,
                  }}>Reabrir bot</button>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>Link expira em 10 min</span>
              </div>
              <style>{`@keyframes tg-progress{from{transform:translateX(-40%)}to{transform:translateX(80%)}}`}</style>
            </div>
          )}

          {/* NOT CONNECTED */}
          {!conn && !pairingLink && (
            <div style={{
              background: '#0C1017', border: '1px solid rgba(230,237,243,0.06)',
              borderRadius: 4, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 1.4 }}>
                  Receba kills e alertas urgentes em tempo real. Pause anúncios direto pelo bot.
                </div>
              </div>
              <button
                onClick={handleConnect}
                disabled={generating}
                onMouseEnter={() => setBtnHov(true)}
                onMouseLeave={() => setBtnHov(false)}
                style={{
                  background: btnHov ? 'rgba(42,171,238,0.12)' : 'rgba(42,171,238,0.06)',
                  color: '#2AABEE', border: '1px solid rgba(42,171,238,0.15)',
                  borderRadius: 3, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                  cursor: generating ? 'wait' : 'pointer', fontFamily: F, whiteSpace: 'nowrap',
                  transition: 'background 0.15s', opacity: generating ? 0.6 : 1,
                }}>
                {generating ? 'Gerando...' : 'Conectar'}
              </button>
            </div>
          )}
        </div>
      </FeedExpandable>
    </div>
  );
};

// ================================================================
// STATE 1 — NO ADS (0 campanhas / 0 anúncios)
// Creative entry experience — never empty, always actionable
// ================================================================
const StateNoAds: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: F }}>
      <div style={{
        background: '#0C1017', border: '1px solid rgba(230,237,243,0.06)',
        borderRadius: 4, padding: '28px 24px',
      }}>
        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20,
          background: 'rgba(200,146,42,0.06)', border: '1px solid rgba(200,146,42,0.12)',
          marginBottom: 16,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#C8922A', opacity: 0.7 }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(200,146,42,0.80)', letterSpacing: '0.01em' }}>
            Nenhuma campanha ativa detectada
          </span>
        </div>

        <h2 style={{
          fontSize: 16, fontWeight: 700, color: '#F0F6FC', margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          Você ainda pode usar o AdBrief para começar com vantagem
        </h2>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Comece criando os melhores anúncios antes de investir
        </p>

        {/* Action items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {[
            { icon: '💡', label: 'Gerar ideias de criativos', desc: 'Baseado em padrões de alta performance' },
            { icon: '🎯', label: 'Criar hooks de alta performance', desc: 'Primeiros segundos que capturam atenção' },
            { icon: '📋', label: 'Montar briefs prontos para teste', desc: 'Estruturados para validação rápida' },
          ].map((item, i) => (
            <div key={i}
              onClick={() => navigate('/dashboard/ai')}
              style={{
                background: 'rgba(230,237,243,0.02)', border: '1px solid rgba(230,237,243,0.04)',
                borderRadius: 3, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(230,237,243,0.04)';
                e.currentTarget.style.borderColor = 'rgba(230,237,243,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(230,237,243,0.02)';
                e.currentTarget.style.borderColor = 'rgba(230,237,243,0.04)';
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F6FC', marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{item.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.48)', fontSize: 14 }}>→</span>
            </div>
          ))}
        </div>

        <ActionButton label="Criar primeiro criativo" onClick={() => navigate('/dashboard/ai')} />
      </div>

      <p style={{
        textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.72)',
        margin: '14px 0 0', lineHeight: 1.5,
      }}>
        Quando suas campanhas estiverem ativas, as decisões aparecerão aqui automaticamente.
      </p>
    </div>
  );
};

// ================================================================
// STATE 2 — SINGLE AD (1 anúncio)
// Intelligent analysis with low confidence — system "knows what it's doing"
// ================================================================
interface AdSummary {
  name: string;
  meta_ad_id: string;
  status?: string;
  effective_status?: string;
  ad_set?: { name: string; campaign?: { name: string } };
}

/** Resolve display label + color for an ad's status */
function getAdStatusDisplay(ad: AdSummary): { label: string; color: string; dotColor: string } {
  const s = (ad.effective_status || ad.status || '').toUpperCase();
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED')
    return { label: 'Pausado', color: 'rgba(255,255,255,0.60)', dotColor: 'rgba(255,255,255,0.45)' };
  if (s === 'DISAPPROVED' || s === 'WITH_ISSUES')
    return { label: 'Problema', color: '#FBBF24', dotColor: 'rgba(251,191,36,0.50)' };
  if (['LEARNING', 'IN_PROCESS', 'PENDING_REVIEW'].includes(s))
    return { label: 'Aprendizado', color: '#F59E0B', dotColor: 'rgba(245,158,11,0.40)' };
  if (s === 'ARCHIVED' || s === 'DELETED')
    return { label: 'Arquivado', color: 'rgba(255,255,255,0.68)', dotColor: 'rgba(255,255,255,0.18)' };
  // ACTIVE or unknown → healthy (green)
  return { label: 'Saudável', color: '#4ADE80', dotColor: 'rgba(74,222,128,0.50)' };
}

/** Sort priority: ACTIVE first, then LEARNING/IN_PROCESS, then PAUSED, then rest */
function getAdSortOrder(ad: AdSummary): number {
  const s = (ad.effective_status || ad.status || '').toUpperCase();
  if (s === 'ACTIVE') return 0;
  if (['LEARNING', 'IN_PROCESS', 'PENDING_REVIEW'].includes(s)) return 1;
  if (s === 'DISAPPROVED' || s === 'WITH_ISSUES') return 2;
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 3;
  if (s === 'ARCHIVED' || s === 'DELETED') return 4;
  return 0; // unknown → treat as active
}

function sortAdsByStatus(ads: AdSummary[]): AdSummary[] {
  return [...ads].sort((a, b) => getAdSortOrder(a) - getAdSortOrder(b));
}

/** Collapsible ad list — shows 5 by default, expand/collapse when >5 */
const AD_LIST_PREVIEW = 3; // show 3 ads collapsed, rest hidden

const AdList: React.FC<{
  ads: AdSummary[];
  totalAds: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onToggleAd?: (adId: string, action: 'pause' | 'activate') => void;
  togglingAd?: string | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
}> = ({ ads, totalAds, onLoadMore, loadingMore, onToggleAd, togglingAd, onRequestToggle }) => {
  const [open, setOpen] = useState(false);
  const sorted = sortAdsByStatus(ads);

  // Group by status for summary
  const statusCounts: Record<string, number> = {};
  sorted.forEach(ad => {
    const st = getAdStatusDisplay(ad);
    statusCounts[st.label] = (statusCounts[st.label] || 0) + 1;
  });
  const pluralize = (lbl: string, n: number) => {
    if (n <= 1) return lbl.toLowerCase();
    // Portuguese plurals: pausado→pausados, saudável→saudáveis, etc.
    const l = lbl.toLowerCase();
    if (l.endsWith('vel')) return l.slice(0, -3) + 'veis';
    if (l.endsWith('do') || l.endsWith('da') || l.endsWith('vo') || l.endsWith('va')) return l + 's';
    if (l.endsWith('a') || l.endsWith('o') || l.endsWith('e')) return l + 's';
    return l + 's';
  };
  const summaryParts = Object.entries(statusCounts).map(([label, count]) => `${count} ${pluralize(label, count)}`);
  const summaryText = summaryParts.join(', ') || `${totalAds} anúncios`;

  const hasMore = totalAds > ads.length;

  return (
    <div style={{ fontFamily: F }}>
      {/* Collapsible header — status summary always visible */}
      <div
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 2px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 14, lineHeight: 1,
          color: open ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)',
          transition: 'transform 0.2s ease, color 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>›</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#F0F6FC' }}>
          Anúncios
        </span>
        {!open ? (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
            {summaryText}
          </span>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>
            {totalAds}
          </span>
        )}
      </div>

      <FeedExpandable open={open}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
          {sorted.map((ad, i) => {
            const st = getAdStatusDisplay(ad);
            const isPaused = st.label === 'Pausado';
            const isActive = st.label === 'Saudável' || st.label === 'Aprendizado';
            const canToggle = onRequestToggle && ad.meta_ad_id && (isPaused || isActive);
            const isToggling = togglingAd === ad.meta_ad_id;
            return (
              <div key={ad.meta_ad_id || i} className="feed-micro-btn" style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px', minWidth: 0,
              }}>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: st.dotColor, flexShrink: 0 }} />
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
                }}>
                  {ad.name}
                </span>
                <span style={{ fontSize: 10, color: st.color, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {st.label}
                </span>
                {canToggle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestToggle!(ad, isPaused ? 'activate' : 'pause'); }}
                    disabled={isToggling}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 3, border: 'none',
                      background: isPaused ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
                      color: isPaused ? '#4ADE80' : 'rgba(255,255,255,0.40)',
                      fontSize: 10, fontWeight: 600, fontFamily: F,
                      cursor: isToggling ? 'default' : 'pointer',
                      opacity: isToggling ? 0.4 : 1,
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => { if (!isToggling) { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.08)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)'; }}
                  >
                    {isPaused ? <Play size={9} /> : <Pause size={9} />}
                    {isPaused ? 'Ativar' : 'Pausar'}
                  </button>
                )}
              </div>
            );
          })}
          {/* Load more from DB */}
          {hasMore && (
            <button
              onClick={(e) => { e.stopPropagation(); onLoadMore?.(); }}
              disabled={loadingMore}
              style={{
                background: 'none', border: 'none', padding: '6px 2px',
                fontSize: 10.5, color: 'rgba(14,165,233,0.55)', fontWeight: 600,
                cursor: loadingMore ? 'default' : 'pointer', fontFamily: F, textAlign: 'left',
                transition: 'color 0.1s', opacity: loadingMore ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!loadingMore) e.currentTarget.style.color = 'rgba(14,165,233,0.75)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(14,165,233,0.55)'; }}
            >
              {loadingMore
                ? 'Carregando...'
                : `+ Carregar mais ${Math.min(40, totalAds - ads.length)} anúncios`}
            </button>
          )}
        </div>
      </FeedExpandable>
    </div>
  );
};

interface AdMetricsSummary {
  totalSpend: number;    // centavos
  totalConversions: number;
  totalRevenue: number;  // centavos
  totalClicks: number;
  avgCtr: number;
  avgCpa: number;        // centavos
  avgRoas: number;       // ratio (e.g. 3.0)
  avgCpc: number;        // centavos
  daysOfData: number;
}

const StateSingleAd: React.FC<{ ad: AdSummary; metrics: AdMetricsSummary | null; periodLabel: string }> = ({ ad, metrics, periodLabel }) => {
  const navigate = useNavigate();
  const breadcrumb = [ad.ad_set?.campaign?.name, ad.ad_set?.name, ad.name].filter(Boolean).join(' → ');

  // Build analysis text from real metrics or use heuristic
  const hasMetrics = metrics && metrics.daysOfData > 0;
  // avgCtr is in basis points (93 = 0.93%), avgCpa is in centavos
  const lowCtr = hasMetrics && metrics.avgCtr < 150; // < 1.5% CTR
  const highCpa = hasMetrics && metrics.avgCpa > 3500; // > R$35.00
  const noConversions = hasMetrics && metrics.totalConversions === 0;

  let headline = 'Análise inicial disponível';
  let detail = 'Baseado em padrões similares, este criativo tende a performar melhor com ajustes estruturais';
  if (hasMetrics) {
    if (noConversions) {
      headline = 'Sem conversões detectadas — oportunidade de otimização';
      detail = 'Baseado nos sinais iniciais, ajustes no criativo podem melhorar a taxa de conversão';
    } else if (lowCtr) {
      headline = 'CTR abaixo do esperado para o nível de investimento';
      detail = 'Sinais iniciais indicam que o hook pode não estar capturando atenção suficiente';
    } else if (highCpa) {
      headline = 'CPA acima da média — há margem para otimizar';
      detail = 'O criativo está gerando cliques mas a conversão pode ser melhorada';
    }
  }

  return (
    <div style={{ fontFamily: F }}>
      {/* Analysis card */}
      <div style={{
        background: '#0C1017', border: '1px solid rgba(230,237,243,0.06)',
        borderLeft: '3px solid #0ea5e9',
        borderRadius: 4, padding: '20px 20px 18px',
        marginBottom: 8,
      }}>
        {/* Breadcrumb */}
        {breadcrumb && (
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: 500,
            marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {breadcrumb}
          </div>
        )}

        <h3 style={{
          fontSize: 14, fontWeight: 700, color: '#F0F6FC', margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          {headline}
        </h3>
        <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', margin: '0 0 14px', lineHeight: 1.6 }}>
          {detail}
        </p>

        {/* Metric pills if available */}
        {hasMetrics && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {metrics.avgCtr > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: lowCtr ? '#C8922A' : '#8B949E',
                background: 'rgba(230,237,243,0.03)', border: '1px solid rgba(230,237,243,0.06)',
                padding: '3px 8px', borderRadius: 3,
              }}>
                CTR {(metrics.avgCtr / 100).toFixed(2)}%
              </span>
            )}
            {metrics.avgCpa > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: highCpa ? '#C8922A' : '#8B949E',
                background: 'rgba(230,237,243,0.03)', border: '1px solid rgba(230,237,243,0.06)',
                padding: '3px 8px', borderRadius: 3,
              }}>
                CPA R${(metrics.avgCpa / 100).toFixed(2)}
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.72)',
              background: 'rgba(230,237,243,0.03)', border: '1px solid rgba(230,237,243,0.06)',
              padding: '3px 8px', borderRadius: 3,
            }}>
              {metrics.daysOfData}d dados
            </span>
          </div>
        )}

        {/* Recommendations */}
        <div style={{
          background: 'rgba(230,237,243,0.03)', borderRadius: 3, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.68)',
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação baseada nos dados dos últimos {periodLabel}
          </div>
          <div style={{ fontSize: 12.5, color: '#F0F6FC', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 3 }}>• Hook mais direto nos primeiros segundos</div>
            <div style={{ marginBottom: 3 }}>• CTA explícito e visível</div>
            <div>• Estrutura mais curta e objetiva</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px' }}>
          <ConfidenceBadge level="baixa" />
          <ActionButton label="Criar variação" onClick={() => navigate('/dashboard/ai')} />
        </div>
      </div>

      {/* Monitoring indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: '#0ea5e9',
          boxShadow: '0 0 4px rgba(14,165,233,0.4)',
          animation: 'st2-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
          Monitorando em tempo real — análise atualiza automaticamente
        </span>
      </div>
      <style>{`@keyframes st2-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
    </div>
  );
};

// ================================================================
// STATE 3 — FEW DATA (baixo volume / poucos dias)
// Direction without certainty
// ================================================================
const StateFewData: React.FC<{ totalAds: number; metrics: AdMetricsSummary | null; periodLabel: string }> = ({ totalAds, metrics, periodLabel }) => {
  const navigate = useNavigate();
  const hasMetrics = metrics && metrics.daysOfData > 0;
  const lowCtr = hasMetrics && metrics.avgCtr < 150; // basis points: < 1.5% CTR

  return (
    <div style={{ fontFamily: F }}>
      <div style={{
        background: '#0C1017', border: '1px solid rgba(230,237,243,0.06)',
        borderLeft: '3px solid #0ea5e9',
        borderRadius: 4, padding: '20px 20px 18px',
        marginBottom: 8,
      }}>
        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 9px', borderRadius: 20,
          background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)',
          marginBottom: 14,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0ea5e9' }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(14,165,233,0.80)' }}>
            Dados em consolidação
          </span>
        </div>

        <h3 style={{
          fontSize: 14, fontWeight: 700, color: '#F0F6FC', margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          Alguns sinais iniciais foram detectados
        </h3>
        <p style={{
          fontSize: 12.5, color: 'rgba(255,255,255,0.72)', margin: '0 0 14px', lineHeight: 1.6,
        }}>
          {totalAds} {totalAds === 1 ? 'anúncio analisado' : 'anúncios analisados'} nos últimos {periodLabel} — volume ainda insuficiente para decisões críticas
        </p>

        {/* Signals */}
        <div style={{
          background: 'rgba(230,237,243,0.03)', borderRadius: 3, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12.5, color: '#F0F6FC', lineHeight: 1.7 }}>
            {lowCtr && <div style={{ marginBottom: 3 }}>• CTR abaixo da média esperada</div>}
            {hasMetrics && metrics.totalConversions === 0 && (
              <div style={{ marginBottom: 3 }}>• Sem conversões registradas ainda</div>
            )}
            <div style={{ marginBottom: 3 }}>• Sem volume suficiente para decisão crítica</div>
          </div>
        </div>

        {/* Soft recommendation */}
        <div style={{
          background: 'rgba(230,237,243,0.03)', borderRadius: 3, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.68)',
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação leve
          </div>
          <div style={{ fontSize: 12.5, color: '#F0F6FC', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 3 }}>• Testar novas variações de criativo</div>
            <div>• Evitar escalar neste momento</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ConfidenceBadge level="média" />
          <ActionButton label="Gerar nova variação" onClick={() => navigate('/dashboard/ai')} />
        </div>
      </div>

      {/* Monitoring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px' }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: '#0ea5e9',
          boxShadow: '0 0 4px rgba(14,165,233,0.4)',
          animation: 'st3-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.60)', fontWeight: 500 }}>
          Análise em andamento — mais dados melhoram as decisões
        </span>
      </div>
      <style>{`@keyframes st3-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
    </div>
  );
};

// ================================================================
// STATE 4 — NO CRITICAL ACTION (dados OK, sem problemas)
// Suggest improvement — never "nothing to do"
// ================================================================
const StateNoCritical: React.FC<{ totalAds: number; ads: AdSummary[]; periodLabel: string; metaAccountId?: string; onLoadMoreAds?: () => void; loadingMoreAds?: boolean; onToggleAd?: (adId: string, action: 'pause' | 'activate') => void; togglingAd?: string | null; onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void }> = ({ totalAds, ads, periodLabel, metaAccountId, onLoadMoreAds, loadingMoreAds, onToggleAd, togglingAd, onRequestToggle }) => {
  const navigate = useNavigate();
  const [oppHov, setOppHov] = useState(false);
  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* ── BLOCO 1: STATUS ── */}
      <div style={{
        background: '#0C1017', border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 6, padding: 'clamp(12px, 3vw, 18px)',
        transition: 'border-color 0.15s',
      }}>
        {/* Confidence — top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            padding: '3px 9px', borderRadius: 3,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#4ADE80',
              boxShadow: '0 0 6px rgba(74,222,128,0.40)',
              animation: 'pulse 2.5s ease-in-out infinite',
            }} />
            Conta saudável
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)' }}>
            {periodLabel}
          </span>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F6FC', letterSpacing: '-0.01em', marginBottom: 5 }}>
          Sem ações críticas — operação estável
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginBottom: 16 }}>
          Sistema focado em otimização
        </div>

        {/* Ad list — sorted by status, collapsible when >5 */}
        {ads.length > 0 && <AdList ads={ads} totalAds={totalAds} onLoadMore={onLoadMoreAds} loadingMore={loadingMoreAds} onToggleAd={onToggleAd} togglingAd={togglingAd} onRequestToggle={onRequestToggle} />}
      </div>

      {/* ── BLOCO 2: OPORTUNIDADE — data-driven, not generic ── */}
      <div
        onMouseEnter={() => setOppHov(true)}
        onMouseLeave={() => setOppHov(false)}
        style={{
          background: oppHov ? 'rgba(255,255,255,0.03)' : '#0C1017',
          border: '1px solid rgba(255,255,255,0.09)',
          borderLeft: '3px solid #0ea5e9',
          borderRadius: 6, padding: 'clamp(12px, 3vw, 18px)',
          transition: 'all 0.18s ease',
          transform: oppHov ? 'translateX(2px)' : 'translateX(0)',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          PRÓXIMA OPORTUNIDADE
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F6FC', marginBottom: 6, lineHeight: 1.4 }}>
          Novos criativos podem melhorar seu CTR em até <span style={{ color: '#38BDF8' }}>+18%</span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: 14 }}>
          Contas com performance semelhante à sua ganham mais diversificando hooks e formatos
        </div>
        <button onClick={() => navigate('/dashboard/criar')} style={{
          background: '#0ea5e9', color: '#fff',
          border: 'none', borderRadius: 4,
          padding: '9px 20px', fontSize: 12.5, fontWeight: 700,
          fontFamily: F, cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: oppHov ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
          transform: oppHov ? 'translateY(-1px)' : 'translateY(0)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0c8bd0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}>
          Gerar variação com IA
        </button>
      </div>

      {/* ── BLOCO 3: SISTEMA ATIVO ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px' }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: '#4ADE80',
          boxShadow: '0 0 6px rgba(74,222,128,0.35)',
          animation: 'pulse 2.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.60)' }}>
          Monitoramento ativo · novas decisões podem surgir a qualquer momento
        </span>
      </div>
    </div>
  );
};

// ================================================================
// PERFORMANCE SUMMARY — compressed, each block unique function
// 1. Status + metrics  2. Opportunity (the one strong insight)  3. Next action
// ================================================================
const PerformanceSummary: React.FC<{
  ads: AdSummary[];
  totalAds: number;
  metrics: AdMetricsSummary | null;
  periodLabel: string;
  metaAccountId?: string;
  onLoadMoreAds?: () => void;
  loadingMoreAds?: boolean;
  onToggleAd?: (adId: string, action: 'pause' | 'activate') => void;
  togglingAd?: string | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
  trackingIssue?: boolean;
}> = ({ ads, totalAds, metrics, periodLabel, metaAccountId, onLoadMoreAds, loadingMoreAds, onToggleAd, togglingAd, onRequestToggle, trackingIssue }) => {
  const navigate = useNavigate();
  const hasMetrics = metrics && metrics.daysOfData > 0;

  const ctrPct = hasMetrics ? (metrics.avgCtr / 100).toFixed(2) : null;
  const spendReais = hasMetrics ? (metrics.totalSpend / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const cpaReais = hasMetrics && metrics.avgCpa > 0 ? (metrics.avgCpa / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const ctrGood = ctrPct && parseFloat(ctrPct) >= 1;
  const confLevel = hasMetrics && metrics.daysOfData >= 5 ? 'alta' : hasMetrics && metrics.daysOfData >= 2 ? 'média' : 'baixa';
  const confColor = confLevel === 'alta' ? 'rgba(14,165,233,0.70)' : confLevel === 'média' ? 'rgba(14,165,233,0.60)' : 'rgba(255,255,255,0.40)';

  const [oppHov, setOppHov] = useState(false);

  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>

      {/* ── BLOCO 1: STATUS + METRICS ── */}
      <div style={{
        background: '#0C1017', border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 6, padding: 'clamp(12px, 3vw, 18px)',
      }}>
        {/* Confidence — top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.72)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '3px 9px', borderRadius: 3,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: confLevel === 'alta' ? '#4ADE80' : confLevel === 'média' ? '#38BDF8' : '#FBBF24',
              boxShadow: confLevel === 'alta' ? '0 0 6px rgba(74,222,128,0.40)' : 'none',
              animation: 'pulse 2.5s ease-in-out infinite',
            }} />
            {confLevel === 'alta' ? 'Conta saudável' : `Confiança: ${confLevel}`}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.60)' }}>
            {periodLabel}
          </span>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F6FC', letterSpacing: '-0.01em', marginBottom: 5 }}>
          Sem ações críticas — operação estável
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginBottom: hasMetrics ? 14 : 16 }}>
          Sistema focado em otimização
        </div>

        {/* Metrics — prominent numbers */}
        {hasMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {[
              { label: 'Investido', value: `R$${spendReais}`, color: '#F0F6FC' },
              { label: 'CTR', value: `${ctrPct}%`, color: ctrGood ? '#4ADE80' : '#FBBF24' },
              { label: 'CPA', value: cpaReais ? `R$${cpaReais}` : '—', color: '#F0F6FC' },
            ].map((m, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.025)', borderRadius: 4,
                padding: '10px 8px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color, letterSpacing: '-0.03em' }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tracking caveat when conversion data is limited */}
        {trackingIssue && hasMetrics && (
          <div style={{ fontSize: 10.5, color: 'rgba(251,191,36,0.65)', fontStyle: 'italic', marginBottom: 10, paddingLeft: 2 }}>
            Insights baseados em dados limitados de conversão
          </div>
        )}

        {/* Ad list — sorted by status, collapsible when >5 */}
        {ads.length > 0 && <AdList ads={ads} totalAds={totalAds} onLoadMore={onLoadMoreAds} loadingMore={loadingMoreAds} onToggleAd={onToggleAd} togglingAd={togglingAd} onRequestToggle={onRequestToggle} />}
      </div>

      {/* ── BLOCO 2: OPORTUNIDADE — data-driven ── */}
      <div
        onMouseEnter={() => setOppHov(true)}
        onMouseLeave={() => setOppHov(false)}
        style={{
          background: oppHov ? 'rgba(255,255,255,0.03)' : '#0C1017',
          border: '1px solid rgba(255,255,255,0.09)',
          borderLeft: '3px solid #0ea5e9',
          borderRadius: 6, padding: 'clamp(12px, 3vw, 18px)',
          transition: 'all 0.18s ease',
          transform: oppHov ? 'translateX(2px)' : 'translateX(0)',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          PRÓXIMA OPORTUNIDADE
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F6FC', marginBottom: 6, lineHeight: 1.4 }}>
          {ctrGood
            ? <>CTR de <span style={{ color: '#4ADE80' }}>{ctrPct}%</span> com espaço para escalar — variações podem ampliar esse resultado</>
            : <>Novos criativos podem melhorar seu CTR em até <span style={{ color: '#38BDF8' }}>+18%</span></>}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, marginBottom: 14 }}>
          Contas com performance semelhante à sua ganham mais diversificando hooks e formatos
        </div>
        <button onClick={() => navigate('/dashboard/criar')} style={{
          background: '#0ea5e9', color: '#fff',
          border: 'none', borderRadius: 4,
          padding: '9px 20px', fontSize: 12.5, fontWeight: 700,
          fontFamily: F, cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: oppHov ? '0 4px 12px rgba(14,165,233,0.25)' : 'none',
          transform: oppHov ? 'translateY(-1px)' : 'translateY(0)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0c8bd0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}>
          Gerar variação com IA
        </button>
      </div>

      {/* ── BLOCO 3: SISTEMA ATIVO ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px' }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: '#4ADE80',
          boxShadow: '0 0 6px rgba(74,222,128,0.35)',
          animation: 'pulse 2.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.60)' }}>
          Monitoramento ativo · novas decisões podem surgir a qualquer momento
        </span>
      </div>
    </div>
  );
};

// ================================================================
// COLLAPSIBLE DECISIONS — shows first 5, expand to see all
// ================================================================
// Collapsible section header — used by both AÇÃO IMEDIATA and RECOMENDAÇÕES
const SectionHeader: React.FC<{
  label: string; color: string; count: number;
  open: boolean; onToggle: () => void;
}> = ({ label, color, count, open, onToggle }) => (
  <div
    onClick={onToggle}
    style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 2px', marginBottom: open ? 6 : 0, marginTop: 0,
      cursor: 'pointer', userSelect: 'none',
    }}
  >
    <span style={{
      fontSize: 14, lineHeight: 1,
      color: open ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)',
      transition: 'transform 0.2s ease, color 0.15s',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    }}>
      ›
    </span>
    <span style={{
      fontSize: 9.5, fontWeight: 800, color,
      letterSpacing: '0.12em',
    }}>
      {label}
    </span>
    <span style={{
      fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.68)',
      fontFamily: F,
    }}>
      {count}
    </span>
  </div>
);

// Animated expand/collapse wrapper for feed sections
const FeedExpandable: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      const full = el.scrollHeight;
      setH(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setH(full)));
      const t = setTimeout(() => setH(-1), 250);
      return () => clearTimeout(t);
    } else {
      setH(el.scrollHeight);
      requestAnimationFrame(() => requestAnimationFrame(() => setH(0)));
    }
  }, [open]);

  const isAuto = open && h === -1;
  return (
    <div style={{
      height: isAuto ? 'auto' : h,
      overflow: isAuto ? 'visible' : 'hidden',
      transition: isAuto ? 'none' : 'height 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease',
      opacity: open ? 1 : 0,
      pointerEvents: open ? 'auto' : 'none',
    }}>
      <div ref={ref}>{children}</div>
    </div>
  );
};

const CollapsibleDecisions: React.FC<{
  decisions: Decision[];
  onAction: (decisionId: string, action: DecisionAction) => Promise<void>;
  isDemo: boolean;
}> = ({ decisions, onAction, isDemo }) => {
  const [criticalOpen, setCriticalOpen] = useState(true);
  const [recsOpen, setRecsOpen] = useState(true);

  // Split into critical (kill/fix) and other (scale/pattern/insight)
  const critical = decisions.filter(d => d.type === 'kill' || d.type === 'fix');
  const other = decisions.filter(d => d.type !== 'kill' && d.type !== 'fix');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* AÇÃO IMEDIATA — collapsible */}
      {critical.length > 0 && (
        <div style={{ marginBottom: other.length > 0 ? 16 : 0 }}>
          <SectionHeader
            label="AÇÃO IMEDIATA"
            color="#EF4444"
            count={critical.length}
            open={criticalOpen}
            onToggle={() => setCriticalOpen(prev => !prev)}
          />
          <FeedExpandable open={criticalOpen}>
            <div>
              {critical.map((decision, idx) => (
                <div key={decision.id} style={{
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <DecisionCard decision={decision} onAction={onAction} isDemo={isDemo} isHero={idx === 0} />
                </div>
              ))}
            </div>
          </FeedExpandable>
        </div>
      )}

      {/* RECOMENDAÇÕES — collapsible */}
      {other.length > 0 && (
        <div>
          <SectionHeader
            label={critical.length > 0 ? "RECOMENDAÇÕES" : "DECISÕES"}
            color="rgba(255,255,255,0.40)"
            count={other.length}
            open={recsOpen}
            onToggle={() => setRecsOpen(prev => !prev)}
          />
          <FeedExpandable open={recsOpen}>
            <div>
              {other.map((decision, idx) => (
                <div key={decision.id} style={{
                  borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <DecisionCard decision={decision} onAction={onAction} isDemo={isDemo} />
                </div>
              ))}
            </div>
          </FeedExpandable>
        </div>
      )}
    </div>
  );
};

// ── Ad Toggle Confirmation Modal with AI opinion ──
interface ToggleRequest {
  ad: AdSummary;
  action: 'pause' | 'activate';
}

const AdToggleModal: React.FC<{
  request: ToggleRequest;
  accountId: string | null;
  userId?: string;
  personaId?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ request, accountId, userId, personaId, onConfirm, onCancel, loading }) => {
  const [aiOpinion, setAiOpinion] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);
  const isPause = request.action === 'pause';

  useEffect(() => {
    let cancelled = false;
    setLoadingAi(true);
    setAiOpinion(null);
    (async () => {
      try {
        // Fetch ad metrics for AI context
        const { data: metrics } = await (supabase
          .from('ad_metrics' as any)
          .select('spend, conversions, ctr, cpa, impressions, clicks, date')
          .eq('meta_ad_id', request.ad.meta_ad_id)
          .order('date', { ascending: false })
          .limit(14) as any);

        if (cancelled) return;

        // Build context for AI
        const m = metrics || [];
        const totalSpend = m.reduce((s: number, r: any) => s + (r.spend || 0), 0);
        const totalConv = m.reduce((s: number, r: any) => s + (r.conversions || 0), 0);
        const totalImps = m.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
        const totalClicks = m.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
        const ctr = totalImps > 0 ? (totalClicks / totalImps * 100) : 0;
        const cpa = totalConv > 0 ? totalSpend / totalConv : 0;
        const days = m.length;
        const adSetName = request.ad.ad_set?.name || '';
        const campName = request.ad.ad_set?.campaign?.name || '';

        // Calculate how many distinct days the ad has been running
        const uniqueDates = new Set(m.map((r: any) => r.date).filter(Boolean));
        const daysRunning = uniqueDates.size;
        const firstDate = m.length > 0 ? m[m.length - 1]?.date : null;
        const daysSinceStart = firstDate ? Math.ceil((Date.now() - new Date(firstDate).getTime()) / 86400000) : 0;

        const prompt = `Analise rapidamente se devo ${isPause ? 'pausar' : 'ativar'} o anúncio "${request.ad.name}"` +
          (campName ? ` (campanha: ${campName}` + (adSetName ? `, conjunto: ${adSetName})` : ')') : '') + '. ' +
          (days > 0
            ? `Dados disponíveis: ${daysRunning} dias com dados nos últimos ${daysSinceStart} dias. ` +
              `Spend total R$${(totalSpend / 100).toFixed(2)}, ${totalConv} conversões, CTR ${ctr.toFixed(2)}%, CPA R$${(cpa/100).toFixed(2)}, ${totalImps} impressões, ${totalClicks} cliques. `
            : 'Sem dados de performance disponíveis para este anúncio. ') +
          `Status atual: ${request.ad.effective_status || request.ad.status || 'desconhecido'}. ` +
          `IMPORTANTE: Leve em consideração quantos dias o anúncio rodou. Se rodou poucos dias (menos de 3-4), o Meta ainda está na fase de aprendizado e pausar/reativar prematuramente pode prejudicar a otimização do algoritmo. ` +
          `Responda APENAS com 2-3 frases curtas e diretas em texto puro. NÃO use markdown, asteriscos, negrito ou formatação. Recomende se deve ou não ${isPause ? 'pausar' : 'ativar'} e por quê.`;

        // Call adbrief-ai-chat — returns { blocks: [...] }
        const { data: aiData, error: aiErr } = await supabase.functions.invoke('adbrief-ai-chat', {
          body: {
            message: prompt,
            user_id: userId,
            persona_id: personaId,
          },
        });

        if (cancelled) return;

        // Extract text from blocks array and strip markdown
        let opinion = '';
        if (aiData?.blocks && Array.isArray(aiData.blocks)) {
          opinion = aiData.blocks
            .map((b: any) => b.content || b.text || '')
            .filter(Boolean)
            .join(' ')
            .replace(/\*\*/g, '')    // strip bold **
            .replace(/\*/g, '')      // strip italic *
            .replace(/__/g, '')      // strip __
            .replace(/`/g, '')       // strip backticks
            .replace(/#{1,3}\s/g, '') // strip headers
            .trim();
        }

        if (opinion) {
          setAiOpinion(opinion);
        } else if (days > 0) {
          // Fallback with actual data
          const verdict = isPause
            ? (totalConv > 0 ? `Este anúncio gerou ${totalConv} conversões com R$${(totalSpend / 100).toFixed(2)} de spend. Considere se o CPA de R$${(cpa/100).toFixed(2)} está dentro do aceitável antes de pausar.`
              : totalSpend > 0 ? `R$${(totalSpend / 100).toFixed(2)} investidos sem conversões em ${days} dias. Pausar pode ser uma boa decisão para realocar o budget.`
              : 'Sem investimento recente. Pausar não terá impacto no orçamento atual.')
            : (totalConv > 0 ? `Histórico positivo: ${totalConv} conversões com CTR de ${ctr.toFixed(2)}%. Reativar pode trazer resultados.`
              : 'Sem conversões no histórico recente. Considere otimizar o criativo antes de ativar.');
          setAiOpinion(verdict);
        } else {
          setAiOpinion(isPause
            ? 'Sem dados de performance para este anúncio. Ao pausar, ele para de gastar imediatamente.'
            : 'Sem dados de performance para este anúncio. Ao ativar, ele volta a competir nos leilões do Meta.');
        }
      } catch {
        if (!cancelled) setAiOpinion(isPause
          ? 'Ao pausar, o anúncio para de gastar imediatamente. Você pode reativá-lo a qualquer momento.'
          : 'Ao ativar, o anúncio volta a competir nos leilões. O aprendizado pode levar algumas horas.');
      } finally {
        if (!cancelled) setLoadingAi(false);
      }
    })();
    return () => { cancelled = true; };
  }, [request.ad.meta_ad_id, request.action, userId, personaId]);

  const accentColor = isPause ? '#F59E0B' : '#22C55E';
  const accentGlow = isPause ? 'rgba(245,158,11,0.20)' : 'rgba(34,197,94,0.20)';

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: F,
        animation: 'modal-overlay-in 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(180deg, #111827 0%, #0C1017 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: 0, maxWidth: 440, width: '100%',
          animation: 'modal-card-in 0.3s cubic-bezier(0.16,1,0.3,1)',
          overflow: 'hidden',
          boxShadow: `0 24px 48px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.05), 0 0 80px ${accentGlow}`,
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
          opacity: 0.6,
        }} />

        <div style={{ padding: 'clamp(14px, 4vw, 22px) clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
              border: `1px solid ${accentColor}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {isPause
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6,3 20,12 6,21" /></svg>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F6FC', letterSpacing: '-0.02em' }}>
                {isPause ? 'Pausar anúncio?' : 'Ativar anúncio?'}
              </div>
              <div style={{
                fontSize: 12, color: 'rgba(255,255,255,0.60)', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {request.ad.name}
              </div>
            </div>
          </div>

          {/* AI Opinion */}
          <div style={{
            background: 'rgba(56,189,248,0.04)',
            border: '1px solid rgba(56,189,248,0.12)',
            borderLeft: '3px solid #38BDF8',
            borderRadius: 8, padding: '14px 16px', marginBottom: 22,
            minHeight: 60,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Loading shimmer overlay */}
            {loadingAi && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.06) 50%, transparent 100%)',
                animation: 'modal-shimmer 2s ease-in-out infinite',
              }} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, position: 'relative' }}>
              <img
                src="/ab-avatar.png"
                alt="AdBrief"
                width={18}
                height={18}
                style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover', display: 'block' }}
              />
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(56,189,248,0.30)' }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(56,189,248,0.60)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {loadingAi ? 'Analisando performance...' : 'Opinião da IA'}
              </span>
            </div>

            {loadingAi ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                <div style={{
                  width: '95%', height: 11, borderRadius: 3,
                  background: 'linear-gradient(90deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.03) 50%, rgba(56,189,248,0.08) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'modal-text-shimmer 1.8s ease-in-out infinite',
                }} />
                <div style={{
                  width: '80%', height: 11, borderRadius: 3,
                  background: 'linear-gradient(90deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.03) 50%, rgba(56,189,248,0.08) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'modal-text-shimmer 1.8s ease-in-out infinite',
                  animationDelay: '0.15s',
                }} />
                <div style={{
                  width: '60%', height: 11, borderRadius: 3,
                  background: 'linear-gradient(90deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0.03) 50%, rgba(56,189,248,0.08) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'modal-text-shimmer 1.8s ease-in-out infinite',
                  animationDelay: '0.3s',
                }} />
              </div>
            ) : (
              <div style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6,
                animation: 'modal-text-in 0.4s ease-out',
                position: 'relative',
              }}>
                {aiOpinion}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: 8,
                background: isPause
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : 'linear-gradient(135deg, #34D399 0%, #10B981 50%, #059669 100%)',
                border: 'none',
                color: '#fff',
                fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                cursor: loading ? 'default' : 'pointer', fontFamily: F,
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: isPause
                  ? '0 4px 12px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.15)'
                  : '0 4px 12px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = isPause ? '0 6px 20px rgba(245,158,11,0.40), inset 0 1px 0 rgba(255,255,255,0.15)' : '0 6px 20px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.15)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isPause ? '0 4px 12px rgba(245,158,11,0.30), inset 0 1px 0 rgba(255,255,255,0.15)' : '0 4px 12px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
            >
              {loading ? 'Executando...' : isPause ? 'Pausar' : 'Ativar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Performance Pulse — KPI bar with trend arrows ──
const TrendArrow: React.FC<{ current: number; previous: number; invert?: boolean }> = ({ current, previous, invert }) => {
  if (!previous || previous === 0) return <Minus size={10} style={{ color: 'rgba(255,255,255,0.65)' }} />;
  const pct = ((current - previous) / previous) * 100;
  const up = pct > 2;
  const down = pct < -2;
  // invert: for spend, up = bad; for CTR, up = good
  const good = invert ? down : up;
  const bad = invert ? up : down;
  if (up) return <TrendingUp size={10} style={{ color: good ? '#4ADE80' : '#EF4444' }} />;
  if (down) return <TrendingDown size={10} style={{ color: bad ? '#EF4444' : '#4ADE80' }} />;
  return <Minus size={10} style={{ color: 'rgba(255,255,255,0.65)' }} />;
};

const PerformancePulse: React.FC<{
  data: {
    spend7d: number; ctr7d: number; activeAds: number; totalAds?: number;
    spendPrev: number; ctrPrev: number;
  };
  savings: number;
  goalMetric?: string | null; // 'cpa' | 'roas' | 'cpc' | null
  adMetrics?: AdMetricsSummary | null;
  trackingBroken?: boolean;
}> = ({ data, savings, goalMetric, adMetrics, trackingBroken }) => {
  const ctrDisplay = data.ctr7d < 1 ? data.ctr7d * 100 : data.ctr7d;
  const pausedAds = (data.totalAds || 0) - data.activeAds;

  // Dynamic primary metric based on account goal
  const buildPrimaryKpi = (): { label: string; value: string; sublabel?: string; trend: React.ReactNode } => {
    if (goalMetric === 'cpa' && adMetrics) {
      const cpa = adMetrics.avgCpa; // centavos
      const display = cpa > 0 ? `R$${(cpa / 100).toFixed(2)}` : '—';
      const sublabel = display === '—' && trackingBroken ? 'Sem dados de conversão' : undefined;
      return { label: 'CPA', value: display, sublabel, trend: null };
    }
    if (goalMetric === 'roas' && adMetrics) {
      const roas = adMetrics.avgRoas;
      const display = roas > 0 ? `${roas.toFixed(1)}x` : '—';
      const sublabel = display === '—' && trackingBroken ? 'Sem dados de conversão' : undefined;
      return { label: 'ROAS', value: display, sublabel, trend: null };
    }
    if (goalMetric === 'cpc' && adMetrics) {
      const cpc = adMetrics.avgCpc; // centavos
      const display = cpc > 0 ? `R$${(cpc / 100).toFixed(2)}` : '—';
      return { label: 'CPC', value: display, trend: null };
    }
    // Fallback: CTR
    return {
      label: 'CTR',
      value: data.spend7d > 0 ? `${ctrDisplay.toFixed(2)}%` : '—',
      trend: data.spend7d > 0 ? <TrendArrow current={data.ctr7d} previous={data.ctrPrev} /> : null,
    };
  };

  const primaryKpi = buildPrimaryKpi();

  const kpis = [
    { label: 'Spend 7d', value: `R$${data.spend7d >= 1000 ? (data.spend7d / 1000).toFixed(1) + 'k' : data.spend7d.toFixed(0)}` },
    { label: primaryKpi.label, value: primaryKpi.value, sublabel: primaryKpi.sublabel },
    { label: 'Ativos', value: String(data.activeAds) },
    { label: 'Pausados', value: String(pausedAds > 0 ? pausedAds : 0) },
  ];

  return (
    <div className="feed-kpi-bar" style={{ marginBottom: 16, fontFamily: F }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
      }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 6, padding: '10px 10px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {k.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#F0F6FC', fontVariant: 'tabular-nums', letterSpacing: '-0.03em' }}>
                {k.value}
              </span>
            </div>
            {k.sublabel && (
              <div style={{ fontSize: 8.5, color: 'rgba(248,113,113,0.70)', marginTop: 2, fontWeight: 500 }}>
                {k.sublabel}
              </div>
            )}
          </div>
        ))}
      </div>
      {savings > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 8, padding: '6px 10px',
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 5,
        }}>
          <span style={{ fontSize: 10, color: '#4ADE80', fontWeight: 700 }}>↓</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>
            Decisões do AdBrief economizaram{' '}
            <span style={{ color: '#F0F6FC', fontWeight: 700 }}>
              R${(savings / 100) >= 1000 ? ((savings / 100) / 1000).toFixed(1) + 'k' : (savings / 100).toFixed(0)}
            </span>
            {' '}este mês
          </span>
        </div>
      )}
    </div>
  );
};

// ================================================================
// FEED PAGE — Main component
// ================================================================
const FeedPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }>();
  const navigate = useNavigate();

  const { activeAccount, metaConnected, accountResolving } = ctx;
  const userId = (ctx as any).user?.id as string | undefined;
  const personaId = (ctx as any).selectedPersona?.id as string | undefined;
  const accountId = activeAccount?.id ?? null;

  const [period, setPeriod] = useState<PeriodKey>('7d');
  const periodDays = PERIODS.find(p => p.key === period)!.days;

  const { decisions: realDecisions, isLoading: decisionsLoading, refetch: refetchDecisions } = useDecisions(accountId);
  const { tracker: realTracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  const [isDemo, setIsDemo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastAnalysisMin] = useState(() => Math.floor(Math.random() * 4) + 2);
  const [patternsCount, setPatternsCount] = useState(0);

  // ── Account goal (Conversion Intelligence) ──
  const [goalConfigured, setGoalConfigured] = useState<boolean | null>(null); // null = loading
  const [goalData, setGoalData] = useState<{ objective: string; metric: string; target: number | null } | null>(null);
  useEffect(() => {
    if (!accountId) { setGoalConfigured(null); setGoalData(null); return; }
    (async () => {
      try {
        const { data } = await (supabase
          .from('ad_accounts' as any)
          .select('goal_objective, goal_primary_metric, goal_target_value')
          .eq('id', accountId)
          .maybeSingle() as any);
        setGoalConfigured(!!data?.goal_objective);
        if (data?.goal_objective) {
          setGoalData({
            objective: data.goal_objective,
            metric: data.goal_primary_metric,
            target: data.goal_target_value,
          });
        } else {
          setGoalData(null);
        }
      } catch { setGoalConfigured(null); setGoalData(null); }
    })();
  }, [accountId]);

  // ── Fetch user's actual ads ──
  const [userAds, setUserAds] = useState<AdSummary[]>([]);
  const [totalAdCount, setTotalAdCount] = useState<number>(0);
  const [adsLoaded, setAdsLoaded] = useState(false);

  // ── Fetch aggregate metrics for state detection (respects period) ──
  const [adMetrics, setAdMetrics] = useState<AdMetricsSummary | null>(null);

  // ── Tracking health — derived from adMetrics ──
  const trackingHealth = useMemo(() => {
    if (!adMetrics) return null;
    const s = adMetrics.totalSpend / 100; // centavos → reais
    const c = adMetrics.totalConversions;
    const cl = adMetrics.totalClicks;
    if (s > 50 && cl > 20 && c === 0) {
      return {
        status: 'broken' as const,
        problem: `Campanhas gerando tráfego (${cl} cliques, R$${s.toFixed(0)} investidos) mas nenhuma conversão registrada`,
        causes: [
          'Evento de conversão não está disparando no site',
          'Evento selecionado não corresponde à ação real do usuário',
          'Landing page com problema impedindo a conversão',
        ],
        impact: 'AdBrief não consegue calcular CPA. Otimização de performance está limitada.',
        chatMsg: `Diagnóstico de Tracking\n\nMinhas campanhas estão gerando tráfego (${cl} cliques, R$${s.toFixed(0)} investidos) mas nenhuma conversão está sendo registrada.\n\nPreciso diagnosticar o que está errado com o tracking. Em qual plataforma meu site foi construído?`,
      };
    }
    if (s > 100 && c > 0 && c < cl * 0.005) {
      const rate = cl > 0 ? (c / cl * 100).toFixed(2) : '0';
      return {
        status: 'uncertain' as const,
        problem: `${c} conversões em ${cl} cliques (${rate}%) — abaixo do esperado`,
        causes: [
          'Evento pode estar disparando na página errada',
          'Tracking parcial — parte das conversões não registrada',
          'Evento duplicado descartado pelo Meta',
        ],
        impact: 'CPA pode estar inflado. Otimização de campanha pode ser imprecisa.',
        chatMsg: `Diagnóstico de Tracking\n\nMinhas campanhas estão com taxa de conversão muito baixa (${rate}%). Tenho ${c} conversões em ${cl} cliques com R$${s.toFixed(0)} de investimento.\n\nIsso pode ser problema de tracking? Me ajuda a diagnosticar.`,
      };
    }
    return { status: 'healthy' as const, problem: '', causes: [] as string[], impact: '', chatMsg: '' };
  }, [adMetrics]);

  // Ads fetch — paginated, refetchable
  const ADS_PAGE_SIZE = 40;
  const [adsLoadingMore, setAdsLoadingMore] = useState(false);

  const fetchAds = useCallback(async (offset = 0, append = false) => {
    if (!accountId) {
      setUserAds([]); setTotalAdCount(0); setAdsLoaded(true);
      return;
    }
    if (offset > 0) setAdsLoadingMore(true);
    try {
      const { data, count } = await (supabase
        .from('ads' as any)
        .select('name, meta_ad_id, status, effective_status, ad_set:ad_sets(name, campaign:campaigns(name))', { count: 'exact' })
        .eq('account_id', accountId)
        .range(offset, offset + ADS_PAGE_SIZE - 1) as any);
      const newAds = (data || []) as AdSummary[];
      setUserAds(prev => append ? [...prev, ...newAds] : newAds);
      setTotalAdCount(count ?? (append ? userAds.length + newAds.length : newAds.length));
      setAdsLoaded(true);
    } catch {
      setAdsLoaded(true);
    } finally {
      setAdsLoadingMore(false);
    }
  }, [accountId]);

  const loadMoreAds = useCallback(() => {
    fetchAds(userAds.length, true);
  }, [fetchAds, userAds.length]);

  useEffect(() => { fetchAds(); }, [fetchAds]);

  // Metrics fetch — re-runs when period or accountId changes
  useEffect(() => {
    if (!accountId) { setAdMetrics(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const since = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);
        const { data: mData } = await (supabase
          .from('ad_metrics' as any)
          .select('spend, conversions, revenue, clicks, ctr, cpa, cpc, roas, date')
          .eq('account_id', accountId)
          .gte('date', since) as any);
        if (!cancelled && mData && mData.length > 0) {
          const totalSpend = mData.reduce((s: number, r: any) => s + (r.spend || 0), 0);
          const totalConversions = mData.reduce((s: number, r: any) => s + (r.conversions || 0), 0);
          const totalRevenue = mData.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
          const totalClicks = mData.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
          const ctrVals = mData.filter((r: any) => r.ctr != null).map((r: any) => Number(r.ctr));
          const cpaVals = mData.filter((r: any) => r.cpa != null && r.cpa > 0).map((r: any) => Number(r.cpa));
          const uniqueDates = new Set(mData.map((r: any) => r.date));
          setAdMetrics({
            totalSpend,
            totalConversions,
            totalRevenue,
            totalClicks,
            avgCtr: ctrVals.length > 0 ? ctrVals.reduce((a: number, b: number) => a + b, 0) / ctrVals.length : 0,
            avgCpa: cpaVals.length > 0 ? cpaVals.reduce((a: number, b: number) => a + b, 0) / cpaVals.length : 0,
            avgRoas: totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0,
            avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            daysOfData: uniqueDates.size,
          });
        } else if (!cancelled) {
          setAdMetrics(null);
        }
      } catch {
        // noop
      }
    })();
    return () => { cancelled = true; };
  }, [accountId, periodDays]);

  const hasRealData = realDecisions.length > 0;
  const demoDismissed = isDemoDismissedToday();
  const showDemo = metaConnected && !hasRealData && !decisionsLoading && !trackerLoading && !accountResolving && !demoDismissed && !syncing;

  useEffect(() => { setIsDemo(showDemo); }, [showDemo]);

  const decisions = isDemo ? buildDemoDecisions() : realDecisions;
  const tracker = isDemo ? buildDemoMoneyTracker() : realTracker;
  // Only show skeleton on the very first load — not after sync finishes (prevents flash)
  const hasSyncedRef = useRef(false);
  if (syncing) hasSyncedRef.current = true;
  const isFirstLoad = accountResolving || (accountId ? (decisionsLoading || trackerLoading) : false);
  const isLoading = isFirstLoad && !hasSyncedRef.current;

  // ── Sync handler: sync Meta data FIRST, then run decision engine ──
  const handleSync = useCallback(async () => {
    if (!accountId || syncing) return;
    dismissDemoToday();
    setIsDemo(false);
    setSyncing(true);
    setSyncError(null);

    try {
      // Step 1: Import campaigns/ads/metrics from Meta API → Supabase tables
      // Use raw fetch to get full error details (supabase.functions.invoke swallows error bodies)
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const syncRes = await fetch(`${supabaseUrl}/functions/v1/sync-meta-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ account_id: accountId, sync_type: 'full' }),
      });
      const syncBody = await syncRes.json().catch(() => null);
      if (!syncRes.ok) {
        const errDetail = syncBody?.error || `HTTP ${syncRes.status}`;
        console.error('Meta sync failed:', syncRes.status, syncBody);
        setSyncError(`Falha ao importar: ${errDetail}`);
        setSyncing(false);
        return;
      }
      console.log('[sync-meta-data] Success:', syncBody);

      // Mark auto-sync as successful so it doesn't re-trigger
      try { localStorage.setItem(`adbrief_autosync_ok_${accountId}`, new Date().toISOString()); } catch {}

      // Step 2: Run decision engine on the freshly synced data
      const { error: engineErr } = await supabase.functions.invoke('run-decision-engine', {
        body: { account_id: accountId },
      });
      if (engineErr) {
        console.error('Engine invocation failed:', engineErr);
        setSyncError('Falha na análise. Tente novamente.');
      }

      // Refetch decisions + ads (data changed after sync)
      await Promise.all([refetchDecisions(), fetchAds()]);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncError('Falha na conexão. Tente novamente.');
    } finally {
      setSyncing(false);
    }
  }, [accountId, syncing, refetchDecisions, fetchAds]);

  // ── Auto-sync: trigger first sync when account connected but no ads imported yet ──
  // Uses localStorage to ensure it only fires once per account (even across remounts)
  const handleSyncRef = useRef(handleSync);
  handleSyncRef.current = handleSync;

  const autoSyncFired = useRef(false);
  useEffect(() => {
    if (!accountId || !metaConnected || !adsLoaded || totalAdCount > 0 || syncing || isDemo) return;
    if (autoSyncFired.current) return;

    // Check localStorage — only skip if sync previously SUCCEEDED for this account
    const key = `adbrief_autosync_ok_${accountId}`;
    if (localStorage.getItem(key)) return;

    autoSyncFired.current = true;
    const t = setTimeout(() => handleSyncRef.current(), 600);
    return () => { clearTimeout(t); autoSyncFired.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, metaConnected, adsLoaded, totalAdCount]);

  // ── Performance Pulse: daily_snapshots + savings ──
  const [pulseData, setPulseData] = useState<{
    spend7d: number; ctr7d: number; activeAds: number;
    spendYesterday: number; ctrYesterday: number;
    spendPrev: number; ctrPrev: number;
  } | null>(null);
  const [savingsTotal, setSavingsTotal] = useState<number>(0);

  useEffect(() => {
    if (!userId || !personaId) { setPulseData(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const sevenAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const fourteenAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

        // Last 7 days snapshots
        const { data: snaps } = await (supabase
          .from('daily_snapshots' as any)
          .select('date, total_spend, avg_ctr, active_ads, yesterday_spend, yesterday_ctr')
          .eq('user_id', userId)
          .eq('persona_id', personaId)
          .gte('date', sevenAgo)
          .order('date', { ascending: false }) as any);

        // Previous 7 days for trend comparison
        const { data: prevSnaps } = await (supabase
          .from('daily_snapshots' as any)
          .select('date, total_spend, avg_ctr')
          .eq('user_id', userId)
          .eq('persona_id', personaId)
          .gte('date', fourteenAgo)
          .lt('date', sevenAgo)
          .order('date', { ascending: false }) as any);

        if (cancelled) return;
        if (snaps && snaps.length > 0) {
          const spend7d = (snaps as any[]).reduce((s: number, r: any) => s + (r.total_spend || 0), 0);
          const totalSpendW = spend7d || 1;
          // avg_ctr should be decimal (0.025) but legacy data may be percentage (2.5) — normalize
          const normCtr = (v: number) => v > 1 ? v / 100 : v;
          const ctr7d = (snaps as any[]).reduce((s: number, r: any) => s + normCtr(r.avg_ctr || 0) * (r.total_spend || 0), 0) / totalSpendW;
          const activeAds = (snaps as any[])[0]?.active_ads || 0;

          const spendPrev = (prevSnaps || []).reduce((s: number, r: any) => s + (r.total_spend || 0), 0);
          const totalSpendP = spendPrev || 1;
          const ctrPrev = (prevSnaps || []).reduce((s: number, r: any) => s + normCtr(r.avg_ctr || 0) * (r.total_spend || 0), 0) / totalSpendP;

          setPulseData({
            spend7d, ctr7d, activeAds,
            spendYesterday: (snaps as any[])[0]?.yesterday_spend || 0,
            ctrYesterday: (snaps as any[])[0]?.yesterday_ctr || 0,
            spendPrev, ctrPrev,
          });
        } else {
          setPulseData(null);
        }
      } catch { if (!cancelled) setPulseData(null); }
    })();
    return () => { cancelled = true; };
  }, [userId, personaId]);

  // Fetch savings from action_log
  useEffect(() => {
    if (!userId) { setSavingsTotal(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const { data } = await (supabase
          .from('action_log' as any)
          .select('estimated_daily_impact')
          .eq('user_id', userId)
          .gte('created_at', monthStart)
          .like('action_type', 'pause%') as any);
        if (cancelled) return;
        const total = (data || []).reduce((s: number, r: any) => s + (r.estimated_daily_impact || 0), 0);
        setSavingsTotal(total);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Stable callbacks for PatternsPanel to avoid re-render flicker ──
  const handleGenerateVariation = useCallback((pattern: any) => {
    const ft = pattern.feature_type || pattern.variables?.feature_type || "";
    const state = { state: { fromPattern: pattern } };
    if (ft === "hook_type" || ft === "hook_presence") navigate('/dashboard/hooks', state);
    else if (ft === "format" || ft === "combination" || ft === "text_density") navigate('/dashboard/boards/new', state);
    else if (ft === "campaign" || ft === "adset") navigate('/dashboard/brief', state);
    else if (ft === "gap") navigate('/dashboard/boards/new', state);
    else navigate('/dashboard/hooks', state);
  }, [navigate]);

  const handlePatternsLoaded = useCallback((count: number) => {
    setPatternsCount(count);
  }, []);

  // ── Ad toggle (pause/activate) from Feed ──
  const [togglingAd, setTogglingAd] = useState<string | null>(null);
  const [toggleRequest, setToggleRequest] = useState<ToggleRequest | null>(null);

  const handleRequestToggle = useCallback((ad: AdSummary, action: 'pause' | 'activate') => {
    setToggleRequest({ ad, action });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (!toggleRequest || togglingAd) return;
    const { ad, action } = toggleRequest;
    setTogglingAd(ad.meta_ad_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/meta-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          action: action === 'pause' ? 'pause' : 'enable',
          user_id: userId,
          persona_id: personaId,
          target_id: ad.meta_ad_id,
          target_type: 'ad',
        }),
      });
      if (res.ok) {
        fetchAds();
      }
    } catch (e) {
      console.error('Toggle ad error:', e);
    } finally {
      setTogglingAd(null);
      setToggleRequest(null);
    }
  }, [toggleRequest, togglingAd, userId, personaId, fetchAds]);

  // Meta Ads Manager URL for the connected account
  const metaAccountId = activeAccount?.metaAccountId || '';
  const adsManagerUrl = metaAccountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaAccountId.replace('act_', '')}`
    : 'https://adsmanager.facebook.com/';

  const handleAction = async (decisionId: string, action: DecisionAction) => {
    const decision = decisions.find(d => d.id === decisionId);

    // Insight/alert cards with no real Meta API action → open Ads Manager
    if (!action.meta_api_action && (decision?.type === 'insight' || decision?.type === 'alert')) {
      window.open(adsManagerUrl, '_blank', 'noopener');
      return;
    }

    // Creative generation actions → navigate to generator, don't call Meta
    if (action.meta_api_action === 'generate_hook') {
      navigate('/dashboard/hooks', { state: { fromDecision: decision } });
      return;
    }
    if (action.meta_api_action === 'generate_variation') {
      navigate('/dashboard/boards/new', { state: { fromDecision: decision } });
      return;
    }

    // Actions without meta_api_action that aren't insight/alert → just navigate
    if (!action.meta_api_action) {
      return;
    }

    const metaId = decision?.ad?.meta_ad_id || '';
    const targetType = action.meta_api_action.includes('adset') ? 'adset'
      : action.meta_api_action.includes('campaign') ? 'campaign' : 'ad';

    // Safety: don't call Meta without a valid target ID
    if (!metaId) {
      throw new Error('Anúncio sem ID do Meta — não é possível executar esta ação');
    }

    const result = await executeAction(decisionId, action.meta_api_action, targetType, metaId, action.params);
    if (!result.success) throw new Error(result.error || 'Erro ao executar ação');
  };

  const handleStopLosses = async () => {
    const kills = decisions.filter(d => d.type === 'kill' && d.status === 'pending');
    for (const d of kills) {
      const a = d.actions?.[0];
      if (a) { try { await handleAction(d.id, a); } catch (err) { console.error('Stop loss failed', d.id, err); } }
    }
  };

  // ── State detection ──
  const pendingDecisions = (isDemo ? decisions : decisions).filter(d => {
    if (d.status !== 'pending') return false;
    // Remove onboarding/placeholder insights when account already has real ads
    if (totalAdCount > 0 && d.type === 'insight' && !d.ad_id && d.impact_daily === 0) return false;
    return true;
  });
  const hasKills = pendingDecisions.some(d => d.type === 'kill');
  const hasCritical = pendingDecisions.some(d => d.type === 'kill' || d.type === 'fix');
  const urgentCount = pendingDecisions.filter(d => d.type === 'kill' || (d.type === 'fix' && d.score >= 75)).length;

  /**
   * Feed state resolution (post-loading, post-connection):
   *  STATE 5 → decisions with kill/fix/scale (full product)
   *  STATE 4 → ads exist, data OK, no critical actions
   *  STATE 3 → few data / low volume
   *  STATE 2 → single ad
   *  STATE 1 → zero ads
   */
  type FeedState = 'demo' | 'full' | 'no-critical' | 'few-data' | 'single-ad' | 'no-ads';

  function resolveFeedState(): FeedState {
    if (isDemo) return 'demo';
    if (pendingDecisions.length > 0) return 'full'; // STATE 5
    if (!adsLoaded) return 'no-ads'; // fallback while loading
    if (totalAdCount === 0) return 'no-ads';         // STATE 1
    if (totalAdCount === 1) return 'single-ad';      // STATE 2
    // Multiple ads but no decisions — fixed thresholds (period only affects metrics display)
    const lowData = !adMetrics || adMetrics.daysOfData <= 2 || adMetrics.totalSpend < 5000;
    if (lowData) return 'few-data';                   // STATE 3
    return 'no-critical';                              // STATE 4
  }

  const feedState = resolveFeedState();

  // ── Loading skeleton with shimmer ──
  if (isLoading) {
    return (
      <div style={{ flex: 1, minHeight: 0, background: '#06080C', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ width: 100, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 6, animation: 'feed-shimmer 1.5s ease-in-out infinite' }} />
            <div style={{ width: 200, height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 3, animation: 'feed-shimmer 1.5s ease-in-out infinite', animationDelay: '0.1s' }} />
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{
              borderLeft: '2px solid rgba(255,255,255,0.04)',
              padding: '14px 16px',
              marginBottom: 0,
              borderTop: i > 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              animation: 'feed-shimmer 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 60, height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }} />
                <div style={{ width: 80, height: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }} />
              </div>
              <div style={{ width: '70%', height: 22, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 8 }} />
              <div style={{ width: '90%', height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 2, marginBottom: 4 }} />
              <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }} />
            </div>
          ))}
        </div>
        <style>{`@keyframes feed-shimmer{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      </div>
    );
  }

  // ── No Meta connection — special entry screen ──
  if (!metaConnected) {
    return (
      <div style={{ flex: 1, minHeight: 0, background: '#06080C', padding: 'max(24px, env(safe-area-inset-top, 24px)) 16px 24px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 14, fontWeight: 800, color: '#F0F6FC', fontFamily: F, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>DECISÕES</h1>
          </div>
          <StateNoAds />
        </div>
      </div>
    );
  }

  // Syncing is now an inline banner — no full-page overlay

  return (
    <div style={{ flex: 1, minHeight: 0, background: '#06080C', padding: 'max(24px, env(safe-area-inset-top, 24px)) 16px 24px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', overflow: 'hidden' }}>
        {/* Header — wraps on mobile */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <h1 style={{ fontSize: 14, fontWeight: 800, color: '#F0F6FC', fontFamily: F, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                DECISÕES
              </h1>
              {isDemo && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.72)',
                  background: 'rgba(230,237,243,0.04)', border: '1px solid rgba(230,237,243,0.06)',
                  padding: '2px 6px', borderRadius: 3, letterSpacing: '0.08em',
                }}>DEMO</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {!isDemo && metaConnected && (
                <PeriodSelector value={period} onChange={setPeriod} />
              )}
              {pendingDecisions.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.60)', fontFamily: F }}>
                  {pendingDecisions.length} {pendingDecisions.length === 1 ? 'item' : 'itens'}
                </span>
              )}
              {metaConnected && !syncing && (
                <button onClick={handleSync} style={{
                  background: 'rgba(230,237,243,0.04)', color: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(230,237,243,0.06)', borderRadius: 4,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
                    <path d="M14 8A6 6 0 1 1 8 2" stroke="#8B949E" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M8 0v4l3-2" stroke="#8B949E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sincronizar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Demo banner */}
        {isDemo && (
          <div style={{
            background: '#0C1017', border: '1px solid rgba(230,237,243,0.05)',
            borderRadius: 3, padding: '10px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 16px',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontFamily: F, lineHeight: 1.5, minWidth: 0 }}>
              Dados simulados. Sincronize sua conta Meta para análise real.
            </span>
            <button onClick={handleSync} style={{
              background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 3,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: F,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.1s', letterSpacing: '-0.01em',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#162C48'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1F3A5F'; }}
            >Sincronizar conta</button>
          </div>
        )}

        {/* Sync error */}
        {syncError && (
          <div style={{
            background: 'rgba(180,35,42,0.08)', border: '1px solid rgba(180,35,42,0.20)',
            borderRadius: 3, padding: '8px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 12px',
          }}>
            <span style={{ fontSize: 12, color: '#D63B3B', fontFamily: F, minWidth: 0, wordBreak: 'break-word' }}>{syncError}</span>
            <button onClick={handleSync} style={{
              background: '#B4232A', color: '#fff', border: 'none', borderRadius: 3,
              padding: '5px 12px', fontSize: 11, fontWeight: 700, fontFamily: F, cursor: 'pointer',
            }}>Tentar novamente</button>
          </div>
        )}

        {/* Inline sync progress banner */}
        {syncing && <SyncBanner />}

        {/* Performance Pulse — KPI bar */}
        {metaConnected && !isDemo && pulseData && (
          <PerformancePulse data={{
            ...pulseData,
            activeAds: userAds.filter(a => {
              const s = (a.effective_status || a.status || '').toUpperCase();
              return s === 'ACTIVE' || s === '';
            }).length,
            totalAds: totalAdCount,
          }} savings={savingsTotal} goalMetric={goalData?.metric} adMetrics={adMetrics} trackingBroken={trackingHealth?.status === 'broken' || trackingHealth?.status === 'uncertain'} />
        )}

        {/* Tracking Health — decision card when issues detected */}
        {metaConnected && !isDemo && trackingHealth && trackingHealth.status !== 'healthy' && (
          <div style={{
            background: '#0C1017',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, padding: 'clamp(12px, 3vw, 16px)', marginBottom: 12,
            borderLeft: `3px solid ${trackingHealth.status === 'broken' ? '#F87171' : '#FBBF24'}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: trackingHealth.status === 'broken' ? '#F87171' : '#FBBF24',
                boxShadow: `0 0 6px ${trackingHealth.status === 'broken' ? 'rgba(248,113,113,0.40)' : 'rgba(251,191,36,0.40)'}`,
              }} />
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.55)',
              }}>
                {trackingHealth.status === 'broken' ? 'Tracking com problema' : 'Tracking incerto'}
              </span>
            </div>

            {/* Problem */}
            <p style={{ fontSize: 12.5, color: '#F0F6FC', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.5 }}>
              {trackingHealth.problem}
            </p>

            {/* Causes */}
            {trackingHealth.causes.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 5,
                padding: '8px 10px', marginBottom: 8,
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.50)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  Possíveis causas
                </div>
                {trackingHealth.causes.map((cause, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, paddingLeft: 10 }}>
                    • {cause}
                  </div>
                ))}
              </div>
            )}

            {/* Impact */}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '0 0 10px', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Impacto:</span> {trackingHealth.impact}
            </p>

            {/* CTA */}
            <button
              onClick={() => {
                const msg = encodeURIComponent(trackingHealth.chatMsg);
                navigate(`/dashboard/ai?tracking_diagnostic=${msg}`);
              }}
              style={{
                background: '#0ea5e9', color: '#F0F6FC',
                border: 'none',
                borderRadius: 6, padding: '9px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                width: '100%',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0c8bd0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}
            >
              Diagnosticar e corrigir tracking →
            </button>
          </div>
        )}

        {/* Goal Setup — show when Meta is connected but no goal configured */}
        {metaConnected && !isDemo && goalConfigured === false && accountId && (
          <GoalSetup
            accountId={accountId}
            onComplete={() => setGoalConfigured(true)}
          />
        )}

        {/* STATE 5 — Full data: money tracker + summary + cards */}
        {feedState === 'full' || feedState === 'demo' ? (
          <>
            {tracker && (
              <div style={{ marginBottom: 16 }}>
                <MoneyBar
                  leaking={(tracker as any).leaking_now || tracker.leaking_now}
                  capturable={(tracker as any).capturable_now || tracker.capturable_now}
                  totalSaved={(tracker as any).total_saved || 0}
                  urgentCount={urgentCount}
                  onStopLosses={hasKills && !isDemo ? handleStopLosses : undefined}
                  onResolve={() => navigate('/dashboard/criar')}
                />
              </div>
            )}

            {/* Visible Win — celebrate results when actions have been taken */}
            {!isDemo && <VisibleWin decisions={decisions} tracker={tracker} />}

            {/* System Status — "Sistema ativo" confidence block */}
            {!isDemo && <SystemStatus decisions={decisions} tracker={tracker} patternsCount={patternsCount} />}

            {/* Performance summary when no critical issues — shows ad health + metrics */}
            {!isDemo && !hasCritical && totalAdCount > 0 && (
              <PerformanceSummary
                ads={userAds}
                totalAds={totalAdCount}
                metrics={adMetrics}
                periodLabel={PERIODS.find(p => p.key === period)!.label}
                metaAccountId={metaAccountId}
                onToggleAd={handleConfirmToggle}
                togglingAd={togglingAd}
                onRequestToggle={handleRequestToggle}
                onLoadMoreAds={loadMoreAds}
                loadingMoreAds={adsLoadingMore}
                trackingIssue={trackingHealth?.status !== 'healthy' && trackingHealth?.status !== undefined}
              />
            )}


            {pendingDecisions.length > 0 && hasCritical && (
              <div style={{ marginBottom: 12 }}>
                <SummaryBar decisions={pendingDecisions} />
              </div>
            )}

            {pendingDecisions.length > 0 && hasCritical && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9',
                  boxShadow: '0 0 4px rgba(14,165,233,0.4)',
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.60)', fontFamily: F, fontWeight: 500 }}>
                  Monitorando performance em tempo real — última análise há {lastAnalysisMin} min
                </span>
              </div>
            )}

            <CollapsibleDecisions decisions={pendingDecisions} onAction={handleAction} isDemo={isDemo} />
          </>
        ) : feedState === 'no-ads' ? (
          <StateNoAds />
        ) : feedState === 'single-ad' ? (
          <StateSingleAd ad={userAds[0]!} metrics={adMetrics} periodLabel={PERIODS.find(p => p.key === period)!.label} />
        ) : feedState === 'few-data' ? (
          <StateFewData totalAds={totalAdCount} metrics={adMetrics} periodLabel={PERIODS.find(p => p.key === period)!.label} />
        ) : feedState === 'no-critical' ? (
          <StateNoCritical totalAds={totalAdCount} ads={userAds} periodLabel={PERIODS.find(p => p.key === period)!.label} metaAccountId={metaAccountId} onLoadMoreAds={loadMoreAds} loadingMoreAds={adsLoadingMore} onToggleAd={handleConfirmToggle} togglingAd={togglingAd} onRequestToggle={handleRequestToggle} />
        ) : null}

        {/* Intelligence — collapsible, always available */}
        {metaConnected && !isDemo && userId && personaId && (
          <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
            <PatternsPanel
              userId={userId}
              personaId={personaId}
              onGenerateVariation={handleGenerateVariation}
              onPatternsLoaded={handlePatternsLoaded}
            />
          </div>
        )}

        {/* Telegram connection card — shown when Meta is connected */}
        {metaConnected && !isDemo && userId && <TelegramCard userId={userId} />}
      </div>

      {/* Global feed animations */}
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
        @keyframes feed-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes feed-shimmer{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes modal-overlay-in{from{opacity:0}to{opacity:1}}
        @keyframes modal-card-in{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes modal-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes modal-text-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes modal-text-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Ad toggle confirmation modal */}
      {toggleRequest && (
        <AdToggleModal
          request={toggleRequest}
          accountId={accountId}
          userId={userId}
          personaId={personaId}
          onConfirm={handleConfirmToggle}
          onCancel={() => setToggleRequest(null)}
          loading={!!togglingAd}
        />
      )}
    </div>
  );
};

export default FeedPage;
