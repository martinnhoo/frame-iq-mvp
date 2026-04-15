import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const cfg = {
    baixa: { color: '#C8922A', bg: 'rgba(200,146,42,0.08)', border: 'rgba(200,146,42,0.15)' },
    média: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.15)' },
    alta:  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)', border: 'rgba(14,165,233,0.12)' },
  }[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      padding: '3px 8px', borderRadius: 3, fontFamily: F,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: cfg.color,
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

const PeriodSelector: React.FC<{ value: PeriodKey; onChange: (k: PeriodKey) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 3, background: 'rgba(230,237,243,0.03)', borderRadius: 4, padding: 2 }}>
    {PERIODS.map(p => {
      const active = p.key === value;
      return (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          background: active ? 'rgba(230,237,243,0.08)' : 'rgba(230,237,243,0.02)',
          color: active ? '#E6EDF3' : 'rgba(139,148,158,0.60)',
          border: `1px solid ${active ? 'rgba(230,237,243,0.12)' : 'rgba(230,237,243,0.05)'}`,
          borderRadius: 3, padding: '4px 10px',
          fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: F, transition: 'all 0.12s',
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(230,237,243,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(230,237,243,0.08)'; } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(230,237,243,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(230,237,243,0.05)'; } }}>
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
        background: hov ? '#0c8bd0' : '#0ea5e9', color: '#E6EDF3', border: 'none',
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
      background: '#0F141A', border: '1px solid rgba(14,165,233,0.12)',
      borderRadius: 4, padding: '14px 16px', fontFamily: F, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 28 28" style={{ animation: 'sync-spin 2s linear infinite', flexShrink: 0 }}>
          <circle cx="14" cy="14" r="12" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="1.5"/>
          <circle cx="14" cy="14" r="2.5" fill="#0ea5e9"/>
          <path d="M14 14 L14 2 A12 12 0 0 1 24.39 8.0 Z" fill="rgba(14,165,233,0.25)"/>
          <line x1="14" y1="14" x2="14" y2="2" stroke="rgba(14,165,233,0.5)" strokeWidth="1"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#E6EDF3' }}>
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

  // Check connection status
  useEffect(() => {
    if (!userId) return;
    (supabase as any).from('telegram_connections')
      .select('chat_id, telegram_username, connected_at')
      .eq('user_id', userId).eq('active', true).maybeSingle()
      .then(({ data }: any) => { setConn(data || null); setLoading(false); });
  }, [userId]);

  // Generate pairing link & open bot
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

  // Poll for connection after link is generated (user opened bot)
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

  // ── CONNECTED STATE ──
  if (conn) {
    return (
      <div style={{
        background: '#0F141A', border: '1px solid rgba(42,171,238,0.10)',
        borderRadius: 4, padding: '12px 14px', fontFamily: F, marginBottom: 8,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,171,238,0.22)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(42,171,238,0.10)'; }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(42,171,238,0.06)', border: '1px solid rgba(42,171,238,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TelegramIcon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#E6EDF3' }}>Telegram</span>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: '#2AABEE',
                boxShadow: '0 0 4px rgba(42,171,238,0.5)',
              }} />
              <span style={{ fontSize: 10.5, color: 'rgba(139,148,158,0.50)' }}>
                {conn.telegram_username ? `@${conn.telegram_username}` : 'ativo'}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(42,171,238,0.45)', marginTop: 2 }}>
              Alertas: perdas · escala · ações recomendadas
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DISCONNECTED STATE ──
  // After generating link, show "waiting for authorization"
  if (pairingLink) {
    return (
      <div style={{
        background: '#0F141A', border: '1px solid rgba(42,171,238,0.12)',
        borderRadius: 4, padding: '14px 16px', fontFamily: F, marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(42,171,238,0.06)', border: '1px solid rgba(42,171,238,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TelegramIcon size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E6EDF3' }}>Aguardando autorização...</div>
            <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2, lineHeight: 1.4 }}>
              Abra o bot no Telegram e toque em <strong style={{ color: '#E6EDF3' }}>Iniciar</strong> para conectar.
            </div>
          </div>
        </div>
        <div style={{
          height: 2, borderRadius: 1, background: 'rgba(42,171,238,0.10)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', background: '#2AABEE', width: '60%',
            animation: 'tg-progress 1.5s ease-in-out infinite alternate',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <button onClick={() => window.open(pairingLink, '_blank', 'noopener')}
            style={{
              background: 'rgba(42,171,238,0.08)', color: '#2AABEE',
              border: '1px solid rgba(42,171,238,0.15)', borderRadius: 3,
              padding: '5px 10px', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: F,
            }}>
            Reabrir bot
          </button>
          <span style={{ fontSize: 10, color: 'rgba(139,148,158,0.50)' }}>Link expira em 10 min</span>
        </div>
        <style>{`@keyframes tg-progress{from{transform:translateX(-40%)}to{transform:translateX(80%)}}`}</style>
      </div>
    );
  }

  // ── DEFAULT: not connected, no link yet ──
  return (
    <div style={{
      background: '#0F141A', border: '1px solid rgba(230,237,243,0.06)',
      borderRadius: 4, padding: '14px 16px', fontFamily: F, marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: 'rgba(42,171,238,0.08)', border: '1px solid rgba(42,171,238,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <TelegramIcon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#E6EDF3', marginBottom: 2 }}>
          Alertas no Telegram
        </div>
        <div style={{ fontSize: 11, color: '#8B949E', lineHeight: 1.4 }}>
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
        }}
      >
        {generating ? 'Gerando...' : 'Conectar'}
      </button>
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
        background: '#0F141A', border: '1px solid rgba(230,237,243,0.06)',
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
          fontSize: 16, fontWeight: 700, color: '#E6EDF3', margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          Você ainda pode usar o AdBrief para começar com vantagem
        </h2>
        <p style={{ fontSize: 12.5, color: '#8B949E', margin: '0 0 20px', lineHeight: 1.6 }}>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3', marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>{item.desc}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'rgba(139,148,158,0.30)', fontSize: 14 }}>→</span>
            </div>
          ))}
        </div>

        <ActionButton label="Criar primeiro criativo" onClick={() => navigate('/dashboard/ai')} />
      </div>

      <p style={{
        textAlign: 'center', fontSize: 11, color: 'rgba(139,148,158,0.35)',
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
  ad_set?: { name: string; campaign?: { name: string } };
}

interface AdMetricsSummary {
  totalSpend: number;    // centavos
  totalConversions: number;
  avgCtr: number;
  avgCpa: number;        // centavos
  daysOfData: number;
}

const StateSingleAd: React.FC<{ ad: AdSummary; metrics: AdMetricsSummary | null; periodLabel: string }> = ({ ad, metrics, periodLabel }) => {
  const navigate = useNavigate();
  const breadcrumb = [ad.ad_set?.campaign?.name, ad.ad_set?.name, ad.name].filter(Boolean).join(' → ');

  // Build analysis text from real metrics or use heuristic
  const hasMetrics = metrics && metrics.daysOfData > 0;
  const lowCtr = hasMetrics && metrics.avgCtr < 0.015;
  const highCpa = hasMetrics && metrics.avgCpa > 3500;
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
        background: '#0F141A', border: '1px solid rgba(230,237,243,0.06)',
        borderLeft: '3px solid #0ea5e9',
        borderRadius: 4, padding: '20px 20px 18px',
        marginBottom: 8,
      }}>
        {/* Breadcrumb */}
        {breadcrumb && (
          <div style={{
            fontSize: 10.5, color: 'rgba(139,148,158,0.50)', fontWeight: 500,
            marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {breadcrumb}
          </div>
        )}

        <h3 style={{
          fontSize: 14, fontWeight: 700, color: '#E6EDF3', margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          {headline}
        </h3>
        <p style={{ fontSize: 12.5, color: '#8B949E', margin: '0 0 14px', lineHeight: 1.6 }}>
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
                CTR {(metrics.avgCtr * 100).toFixed(2)}%
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
              fontSize: 11, fontWeight: 600, color: '#8B949E',
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
            fontSize: 9.5, fontWeight: 700, color: 'rgba(139,148,158,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação baseada nos dados dos últimos {periodLabel}
          </div>
          <div style={{ fontSize: 12.5, color: '#E6EDF3', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 3 }}>• Hook mais direto nos primeiros segundos</div>
            <div style={{ marginBottom: 3 }}>• CTA explícito e visível</div>
            <div>• Estrutura mais curta e objetiva</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <span style={{ fontSize: 10.5, color: 'rgba(139,148,158,0.70)', fontWeight: 500 }}>
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
  const lowCtr = hasMetrics && metrics.avgCtr < 0.015;

  return (
    <div style={{ fontFamily: F }}>
      <div style={{
        background: '#0F141A', border: '1px solid rgba(230,237,243,0.06)',
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
          fontSize: 14, fontWeight: 700, color: '#E6EDF3', margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          Alguns sinais iniciais foram detectados
        </h3>
        <p style={{
          fontSize: 12.5, color: '#8B949E', margin: '0 0 14px', lineHeight: 1.6,
        }}>
          {totalAds} {totalAds === 1 ? 'anúncio analisado' : 'anúncios analisados'} nos últimos {periodLabel} — volume ainda insuficiente para decisões críticas
        </p>

        {/* Signals */}
        <div style={{
          background: 'rgba(230,237,243,0.03)', borderRadius: 3, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 12.5, color: '#E6EDF3', lineHeight: 1.7 }}>
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
            fontSize: 9.5, fontWeight: 700, color: 'rgba(139,148,158,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação leve
          </div>
          <div style={{ fontSize: 12.5, color: '#E6EDF3', lineHeight: 1.7 }}>
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
        <span style={{ fontSize: 10.5, color: 'rgba(139,148,158,0.45)', fontWeight: 500 }}>
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
const StateNoCritical: React.FC<{ totalAds: number; ads: AdSummary[]; periodLabel: string; metaAccountId?: string }> = ({ totalAds, ads, periodLabel, metaAccountId }) => {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        background: '#0F141A', border: '1px solid rgba(230,237,243,0.05)',
        borderRadius: 4, padding: '14px 16px',
      }}>
        {/* Visual hook */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(14,165,233,0.65)',
          textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
        }}>
          Oportunidade disponível
        </div>

        {/* Header — blue bullet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#0ea5e9', boxShadow: '0 0 5px rgba(14,165,233,0.35)',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', letterSpacing: '-0.01em' }}>
            Nenhuma ação crítica no momento
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(139,148,158,0.55)', marginLeft: 14, marginBottom: 14 }}>
          Sistema focado em otimização · {totalAds} {totalAds === 1 ? 'anúncio' : 'anúncios'} nos últimos {periodLabel}
        </div>

        {/* Ad list */}
        {ads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 12 }}>
            {ads.slice(0, 4).map((ad, i) => (
              <div key={ad.meta_ad_id || i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
              }}>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(139,148,158,0.20)', flexShrink: 0 }} />
                <span style={{
                  fontSize: 10.5, color: 'rgba(230,237,243,0.45)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {ad.name}
                </span>
                <span style={{ fontSize: 9.5, color: 'rgba(139,148,158,0.35)', whiteSpace: 'nowrap' }}>
                  Estável
                </span>
              </div>
            ))}
            {totalAds > 4 && (
              <span style={{ fontSize: 9.5, color: 'rgba(139,148,158,0.20)', padding: '1px 6px' }}>
                + {totalAds - 4} monitorados
              </span>
            )}
          </div>
        )}

        {/* Confidence — blue */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 600, color: '#0ea5e9',
          background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)',
          padding: '3px 8px', borderRadius: 3,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0ea5e9' }} />
          Confiança: alta
        </span>
      </div>

      {/* Opportunity card — BLUE */}
      <div style={{
        background: 'rgba(14,165,233,0.03)', border: '1px solid rgba(14,165,233,0.12)',
        borderLeft: '3px solid rgba(14,165,233,0.45)',
        borderRadius: 4, padding: '14px 16px',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Oportunidade identificada
        </div>
        <div style={{ fontSize: 12.5, color: '#E6EDF3', lineHeight: 1.5, marginBottom: 10 }}>
          Testar novas variações para escalar performance
        </div>
        <button onClick={() => navigate('/dashboard/criar')} style={{
          background: '#0ea5e9', color: '#E6EDF3',
          border: 'none', borderRadius: 3,
          padding: '8px 16px', fontSize: 12, fontWeight: 700,
          fontFamily: F, cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0c8bd0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}>
          Criar com IA
        </button>
      </div>

      {/* Monitoring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(14,165,233,0.30)' }} />
        <span style={{ fontSize: 10, color: 'rgba(139,148,158,0.35)' }}>
          Monitorando em tempo real · novas decisões ao detectar mudanças
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
}> = ({ ads, totalAds, metrics, periodLabel, metaAccountId }) => {
  const navigate = useNavigate();
  const hasMetrics = metrics && metrics.daysOfData > 0;

  const ctrPct = hasMetrics ? (metrics.avgCtr / 100).toFixed(2) : null;
  const spendReais = hasMetrics ? (metrics.totalSpend / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const cpaReais = hasMetrics && metrics.avgCpa > 0 ? (metrics.avgCpa / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const ctrGood = ctrPct && parseFloat(ctrPct) >= 1;
  const confLevel = hasMetrics && metrics.daysOfData >= 5 ? 'alta' : hasMetrics && metrics.daysOfData >= 2 ? 'média' : 'baixa';
  const confColor = confLevel === 'alta' ? 'rgba(14,165,233,0.70)' : confLevel === 'média' ? 'rgba(14,165,233,0.60)' : 'rgba(139,148,158,0.45)';

  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>

      {/* ── BLOCK 1: Status + Metrics + Ads ── */}
      <div style={{
        background: '#0F141A', border: '1px solid rgba(230,237,243,0.05)',
        borderRadius: 4, padding: '14px 16px',
      }}>
        {/* Visual hook — blue accent */}
        <div style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(14,165,233,0.65)',
          textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
        }}>
          Oportunidade disponível
        </div>

        {/* Header — blue bullet + subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#0ea5e9', boxShadow: '0 0 5px rgba(14,165,233,0.35)',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', letterSpacing: '-0.01em' }}>
            Nenhuma ação crítica no momento
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(139,148,158,0.55)', marginLeft: 14, marginBottom: hasMetrics ? 10 : 0 }}>
          Sistema focado em otimização · {totalAds} {totalAds === 1 ? 'anúncio' : 'anúncios'} nos últimos {periodLabel}
          {hasMetrics ? ` · ${metrics.daysOfData}d de dados` : ''}
        </div>

        {/* Metrics */}
        {hasMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 10 }}>
            {[
              { label: 'Investido', value: `R$${spendReais}` },
              { label: 'CTR', value: `${ctrPct}%` },
              { label: 'CPA', value: cpaReais ? `R$${cpaReais}` : '—' },
            ].map((m, i) => (
              <div key={i} style={{
                background: 'rgba(230,237,243,0.02)', borderRadius: 3,
                padding: '8px 6px', textAlign: 'center',
                border: '1px solid rgba(230,237,243,0.03)',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(139,148,158,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#E6EDF3', letterSpacing: '-0.02em' }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ad list — compact */}
        {ads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 10 }}>
            {ads.slice(0, 4).map((ad, i) => (
              <div key={ad.meta_ad_id || i} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px',
              }}>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(139,148,158,0.20)', flexShrink: 0 }} />
                <span style={{
                  fontSize: 10.5, color: 'rgba(230,237,243,0.45)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {ad.name}
                </span>
                <span style={{ fontSize: 9.5, color: 'rgba(139,148,158,0.35)', whiteSpace: 'nowrap' }}>
                  Estável
                </span>
              </div>
            ))}
            {totalAds > 4 && (
              <span style={{ fontSize: 9.5, color: 'rgba(139,148,158,0.20)', padding: '1px 6px' }}>
                + {totalAds - 4} monitorados
              </span>
            )}
          </div>
        )}

        {/* Confidence — blue accent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 600, color: '#0ea5e9',
            background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.12)',
            padding: '3px 8px', borderRadius: 3,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0ea5e9' }} />
            Confiança: {confLevel}
          </span>
        </div>
      </div>

      {/* ── BLOCK 2: Opportunity — BLUE card (the money hook) ── */}
      <div style={{
        background: 'rgba(14,165,233,0.03)', border: '1px solid rgba(14,165,233,0.12)',
        borderLeft: '3px solid rgba(14,165,233,0.45)',
        borderRadius: 4, padding: '14px 16px',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Oportunidade principal hoje
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', marginBottom: 4, lineHeight: 1.35 }}>
          {ctrGood
            ? 'Seu melhor criativo pode ser escalado'
            : 'Novos hooks podem destravar performance'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(139,148,158,0.55)', lineHeight: 1.5, marginBottom: 10 }}>
          {ctrGood
            ? `CTR de ${ctrPct}% com espaço para aumentar investimento mantendo eficiência.`
            : `CTR atual de ${ctrPct || '—'}% — variações com hooks mais diretos tendem a melhorar em contas similares.`}
        </div>
        <button onClick={() => navigate('/dashboard/criar')} style={{
          background: '#0ea5e9', color: '#E6EDF3',
          border: 'none', borderRadius: 3,
          padding: '8px 16px', fontSize: 12, fontWeight: 700,
          fontFamily: F, cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#0c8bd0'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0ea5e9'; }}>
          {ctrGood ? 'Escalar campanha' : 'Criar com IA'}
        </button>
      </div>

      {/* ── Single monitoring line ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 2px' }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(14,165,233,0.30)' }} />
        <span style={{ fontSize: 10, color: 'rgba(139,148,158,0.35)' }}>
          Monitorando em tempo real · novas decisões ao detectar mudanças
        </span>
      </div>
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

  // ── Fetch user's actual ads ──
  const [userAds, setUserAds] = useState<AdSummary[]>([]);
  const [totalAdCount, setTotalAdCount] = useState<number>(0);
  const [adsLoaded, setAdsLoaded] = useState(false);

  // ── Fetch aggregate metrics for state detection (respects period) ──
  const [adMetrics, setAdMetrics] = useState<AdMetricsSummary | null>(null);

  // Ads fetch — refetchable
  const fetchAds = useCallback(async () => {
    if (!accountId) {
      setUserAds([]); setTotalAdCount(0); setAdsLoaded(true);
      return;
    }
    try {
      const { data, count } = await (supabase
        .from('ads' as any)
        .select('name, meta_ad_id, status, ad_set:ad_sets(name, campaign:campaigns(name))', { count: 'exact' })
        .eq('account_id', accountId)
        .limit(8) as any);
      setUserAds((data || []) as AdSummary[]);
      setTotalAdCount(count ?? (data?.length ?? 0));
      setAdsLoaded(true);
    } catch {
      setAdsLoaded(true);
    }
  }, [accountId]);

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
          .select('spend, conversions, ctr, cpa, date')
          .eq('account_id', accountId)
          .gte('date', since) as any);
        if (!cancelled && mData && mData.length > 0) {
          const totalSpend = mData.reduce((s: number, r: any) => s + (r.spend || 0), 0);
          const totalConversions = mData.reduce((s: number, r: any) => s + (r.conversions || 0), 0);
          const ctrVals = mData.filter((r: any) => r.ctr != null).map((r: any) => Number(r.ctr));
          const cpaVals = mData.filter((r: any) => r.cpa != null && r.cpa > 0).map((r: any) => Number(r.cpa));
          const uniqueDates = new Set(mData.map((r: any) => r.date));
          setAdMetrics({
            totalSpend,
            totalConversions,
            avgCtr: ctrVals.length > 0 ? ctrVals.reduce((a: number, b: number) => a + b, 0) / ctrVals.length : 0,
            avgCpa: cpaVals.length > 0 ? cpaVals.reduce((a: number, b: number) => a + b, 0) / cpaVals.length : 0,
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

    const metaId = decision?.ad?.meta_ad_id || '';
    const targetType = action.meta_api_action?.includes('adset') ? 'adset'
      : action.meta_api_action?.includes('campaign') ? 'campaign' : 'ad';
    const result = await executeAction(decisionId, action.meta_api_action || action.type, targetType, metaId, action.params);
    if (!result.success) throw new Error(result.error || 'Action failed');
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

  // ── No Meta connection — special entry screen ──
  if (!metaConnected) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0F14', padding: '24px 20px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>Feed</h1>
          </div>
          <StateNoAds />
        </div>
      </div>
    );
  }

  // Syncing is now an inline banner — no full-page overlay

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F14', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
                Feed
              </h1>
              {isDemo && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#8B949E',
                  background: 'rgba(230,237,243,0.04)', border: '1px solid rgba(230,237,243,0.06)',
                  padding: '2px 6px', borderRadius: 3, letterSpacing: '0.08em',
                }}>DEMO</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isDemo && metaConnected && (
                <PeriodSelector value={period} onChange={setPeriod} />
              )}
              {pendingDecisions.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(139,148,158,0.60)', fontFamily: F }}>
                  {pendingDecisions.length} {pendingDecisions.length === 1 ? 'item' : 'itens'}
                </span>
              )}
              {metaConnected && !syncing && (
                <button onClick={handleSync} style={{
                  background: 'rgba(230,237,243,0.04)', color: '#8B949E',
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
            background: '#0F141A', border: '1px solid rgba(230,237,243,0.05)',
            borderRadius: 3, padding: '10px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <span style={{ fontSize: 12, color: '#8B949E', fontFamily: F, lineHeight: 1.5 }}>
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
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: '#D63B3B', fontFamily: F }}>{syncError}</span>
            <button onClick={handleSync} style={{
              background: '#B4232A', color: '#fff', border: 'none', borderRadius: 3,
              padding: '5px 12px', fontSize: 11, fontWeight: 700, fontFamily: F, cursor: 'pointer',
            }}>Tentar novamente</button>
          </div>
        )}

        {/* Inline sync progress banner */}
        {syncing && <SyncBanner />}

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

            {/* Performance summary when no critical issues — shows ad health + metrics */}
            {!isDemo && !hasCritical && totalAdCount > 0 && (
              <PerformanceSummary
                ads={userAds}
                totalAds={totalAdCount}
                metrics={adMetrics}
                periodLabel={PERIODS.find(p => p.key === period)!.label}
                metaAccountId={metaAccountId}
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
                <span style={{ fontSize: 10.5, color: 'rgba(139,148,158,0.70)', fontFamily: F, fontWeight: 500 }}>
                  Monitorando performance em tempo real — última análise há {lastAnalysisMin} min
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pendingDecisions.map(decision => (
                <DecisionCard key={decision.id} decision={decision} onAction={handleAction} isDemo={isDemo} />
              ))}
            </div>
          </>
        ) : feedState === 'no-ads' ? (
          <StateNoAds />
        ) : feedState === 'single-ad' ? (
          <StateSingleAd ad={userAds[0]!} metrics={adMetrics} periodLabel={PERIODS.find(p => p.key === period)!.label} />
        ) : feedState === 'few-data' ? (
          <StateFewData totalAds={totalAdCount} metrics={adMetrics} periodLabel={PERIODS.find(p => p.key === period)!.label} />
        ) : feedState === 'no-critical' ? (
          <StateNoCritical totalAds={totalAdCount} ads={userAds} periodLabel={PERIODS.find(p => p.key === period)!.label} metaAccountId={metaAccountId} />
        ) : null}

        {/* Telegram connection card — shown when Meta is connected */}
        {metaConnected && !isDemo && userId && <TelegramCard userId={userId} />}
      </div>
    </div>
  );
};

export default FeedPage;
