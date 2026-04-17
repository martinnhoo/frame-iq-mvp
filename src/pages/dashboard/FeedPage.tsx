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
import { Pause, Play } from 'lucide-react';

const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── DESIGN TOKENS ──
// Layered dark mode: each surface lifts slightly from the one below
const T = {
  // Backgrounds — layered depth
  bg0: '#080B11',        // page background (deepest)
  bg1: '#0D1117',        // card surface (lifted)
  bg2: '#161B22',        // elevated surface / hover state
  bg3: '#1C2128',        // active / pressed / inset content

  // Borders — subtle separation, never heavy
  border0: 'rgba(240,246,252,0.04)',  // barely visible (between same-level)
  border1: 'rgba(240,246,252,0.07)',  // default card border
  border2: 'rgba(240,246,252,0.12)',  // emphasized / active

  // Text — 3-tier hierarchy
  text1: '#F0F6FC',                     // primary (headings, values, key info)
  text2: 'rgba(240,246,252,0.72)',      // secondary (body, descriptions)
  text3: 'rgba(240,246,252,0.48)',      // tertiary (captions, timestamps, labels)

  // Accent — functional only
  blue: '#0ea5e9',         // action (CTAs, links)
  blueHover: '#0c8bd0',   // action hover
  green: '#4ADE80',        // success / healthy (dot accent only)
  red: '#F87171',          // error / broken
  yellow: '#FBBF24',       // warning / uncertain
  purple: '#A78BFA',       // intelligence / patterns

  // Functional
  labelColor: 'rgba(240,246,252,0.40)', // section labels, uppercase headers
};

// ── localStorage helpers ──
const DEMO_DISMISS_KEY = 'adbrief_demo_dismissed';
const TRACKING_STATUS_KEY = 'adbrief_tracking_v2';

type TrackingStatus = 'unknown' | 'confirmed_no_conversion' | 'investigating' | 'verified_ok' | 'verified_issue';

const VALID_TRACKING: TrackingStatus[] = ['confirmed_no_conversion', 'investigating', 'verified_ok', 'verified_issue'];

/** Tracking status: scoped per account (GLOBAL — NOT per date range).
 *  Stored as a plain string value, e.g. "investigating".
 *  Auto-resets to 'unknown' when conversions appear (data-driven).
 *  Migration: if legacy JSON map is found, promotes the most advanced status. */
function getTrackingStatus(accountId: string): TrackingStatus {
  try {
    const raw = localStorage.getItem(`${TRACKING_STATUS_KEY}_${accountId}`);
    if (!raw) return 'unknown';
    // Migration from legacy per-range JSON map → global scalar
    if (raw.startsWith('{')) {
      const map: Record<string, string> = JSON.parse(raw);
      const vals = Object.values(map).filter((v): v is TrackingStatus => VALID_TRACKING.includes(v as TrackingStatus));
      // Promote the "most active" status: investigating > verified_issue > confirmed_no_conversion > verified_ok
      const priority: TrackingStatus[] = ['investigating', 'verified_issue', 'confirmed_no_conversion', 'verified_ok'];
      const best = priority.find(p => vals.includes(p)) ?? 'unknown';
      // Persist migrated scalar and drop the map
      localStorage.setItem(`${TRACKING_STATUS_KEY}_${accountId}`, best);
      return best;
    }
    if (VALID_TRACKING.includes(raw as TrackingStatus)) return raw as TrackingStatus;
  } catch {}
  return 'unknown';
}

function setTrackingStatus(accountId: string, status: TrackingStatus): void {
  try {
    localStorage.setItem(`${TRACKING_STATUS_KEY}_${accountId}`, status);
  } catch {}
}

// ── Unified Metric Intelligence Engine v2 ──
// Adaptive: baselines from account data (median), no fixed thresholds.
// Priority-scored, anti-spam cooldowns, impact estimation, light history.
const METRIC_STATE_KEY = 'adbrief_metric_v2';
type MetricAlertId = 'cpa_no_data' | 'cpa_deviation' | 'ctr_deviation' | 'roas_deviation';
type MetricAlertAction = 'unknown' | 'acknowledged' | 'investigating';

interface MetricStateEntry {
  action: MetricAlertAction;
  dismissedAt?: number;      // timestamp of last dismiss
  cooldownDays?: number;     // how many days cooldown
}

interface MetricHistoryEntry {
  metric: MetricAlertId;
  action: 'dismissed' | 'investigating';
  date: string; // ISO date
}

const COOLDOWN_DAYS: Record<MetricAlertId, number> = {
  cpa_no_data: 5,
  cpa_deviation: 5,
  ctr_deviation: 7,
  roas_deviation: 5,
};

/** Per-account, per-range, per-metric persistence.
 *  Shape: { "7d": { "ctr_deviation": { action: "acknowledged", dismissedAt: 1713... } }, ... } */
function getMetricStateMap(accountId: string): Record<string, Record<string, MetricStateEntry>> {
  try {
    const raw = localStorage.getItem(`${METRIC_STATE_KEY}_${accountId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function getMetricEntry(accountId: string, range: string, alertId: MetricAlertId): MetricStateEntry {
  const map = getMetricStateMap(accountId);
  return map[range]?.[alertId] || { action: 'unknown' };
}

function setMetricEntry(accountId: string, range: string, alertId: MetricAlertId, entry: MetricStateEntry): void {
  try {
    const map = getMetricStateMap(accountId);
    if (!map[range]) map[range] = {};
    map[range][alertId] = entry;
    localStorage.setItem(`${METRIC_STATE_KEY}_${accountId}`, JSON.stringify(map));
  } catch {}
}

function resetMetricState(accountId: string, range: string, alertId: MetricAlertId): void {
  setMetricEntry(accountId, range, alertId, { action: 'unknown' });
}

/** Light history — last 20 actions across all metrics. */
const METRIC_HISTORY_KEY = 'adbrief_metric_history';
function getMetricHistory(accountId: string): MetricHistoryEntry[] {
  try {
    const raw = localStorage.getItem(`${METRIC_HISTORY_KEY}_${accountId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function addMetricHistory(accountId: string, entry: MetricHistoryEntry): void {
  try {
    const history = getMetricHistory(accountId);
    history.unshift(entry); // newest first
    if (history.length > 20) history.length = 20;
    localStorage.setItem(`${METRIC_HISTORY_KEY}_${accountId}`, JSON.stringify(history));
  } catch {}
}

function daysSinceLastDismiss(accountId: string, alertId: MetricAlertId): number | null {
  const history = getMetricHistory(accountId);
  const last = history.find(h => h.metric === alertId && h.action === 'dismissed');
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000);
}

/** Check if alert is in cooldown (dismissed within cooldown period). */
function isInCooldown(entry: MetricStateEntry, alertId: MetricAlertId): boolean {
  if (entry.action !== 'acknowledged' || !entry.dismissedAt) return false;
  const cooldownMs = (entry.cooldownDays || COOLDOWN_DAYS[alertId]) * 86400000;
  return Date.now() - entry.dismissedAt < cooldownMs;
}

/** Minimum confidence threshold — RULE 2 invariant.
 *  Any alert below this confidence is NEVER shown, period. */
const MIN_CONFIDENCE_THRESHOLD = 0.25;

/** Adaptive metric alert detection v4 — drift-protected, coupling-aware, freshness-gated. */
interface MetricAlert {
  id: MetricAlertId;
  label: string;
  fact: string;
  context: string;
  ambiguity: string;
  impact: string;           // Estimated impact — (baseline - current) * volume
  trustLine: string;        // "Baseado nos últimos X dias da sua conta"
  confidenceLabel: string;  // "Alta confiança" | "Confiança moderada" | "Dados ainda instáveis"
  dismissLabel: string;
  investigateLabel: string;
  chatMsg: string;
  priority: number;         // impact * confidence (0-100)
  historyNote?: string;     // e.g. "Você ignorou isso há 3 dias"
}

/** Structured confidence: f(days, spend, events, volatility, freshness).
 *  Returns 0-1 where 1 = maximum confidence in the signal. */
function computeConfidence(
  daysOfData: number,
  totalSpend: number,   // centavos
  events: number,       // relevant events (clicks for CTR, conversions for CPA/ROAS)
  volatility: number,   // coefficient of variation of the metric, 0-1+
  freshness: number,    // fraction of data from last 24h (0-1). High = premature data.
): number {
  const timeFactor = Math.min(daysOfData / 7, 1);
  const spendFactor = Math.min(totalSpend / 10000, 1);
  const eventFactor = Math.min(events / 10, 1);
  const stabilityFactor = Math.max(0.3, 1 - volatility * 0.7);
  // Freshness penalty: if > 50% of data is from last 24h, reduce confidence
  // (conversions may still be attributing, ROAS incomplete)
  const freshnessPenalty = freshness > 0.5 ? Math.max(0.5, 1 - (freshness - 0.5) * 0.8) : 1;
  const raw = timeFactor * 0.22 + spendFactor * 0.18 + eventFactor * 0.28 + stabilityFactor * 0.22 + 0.10;
  return raw * freshnessPenalty;
}

function confidenceLabel(conf: number): string {
  if (conf >= 0.7) return 'Alta confiança';
  if (conf >= 0.4) return 'Confiança moderada';
  return 'Dados ainda instáveis';
}

// RULE 3: Pure function — no side effects, no localStorage reads.
// Same inputs ALWAYS produce same outputs.
function detectMetricAlerts(
  m: AdMetricsSummary,
  _accountId: string, // kept for call-site compat, unused inside
  goalMetric?: string | null,
): MetricAlert[] {
  const alerts: MetricAlert[] = [];

  // ── BEGINNER MODE ──
  if (m.daysOfData < 3 || m.totalClicks < 30 || m.totalSpend < 2000) return alerts;

  // ── Helpers ──
  const goalBoost = (metric: string): number => {
    if (!goalMetric) return 1;
    if (goalMetric === metric) return 1.5;
    if (goalMetric === 'cpc' && metric === 'ctr') return 1.3;
    return 1;
  };
  // RULE 3: histNote moved out of detection — it reads localStorage (side effect).
  // Detection must be a pure function of its inputs for determinism.
  const trustLine = m.hasAnchorBaseline
    ? `Baseado nos últimos ${m.daysOfData} dias da sua conta (com referência de 30 dias)`
    : `Baseado nos últimos ${m.daysOfData} dias da sua conta`;

  // ── CPA: no data ──
  if (m.totalSpend > 0 && m.totalConversions < 3 && m.avgCpa === 0 && !(m.totalSpend > 5000 && m.totalClicks > 20)) {
    const conf = computeConfidence(m.daysOfData, m.totalSpend, m.totalClicks, 0, m.freshnessFactor);
    // RULE 2: low confidence → suppress
    if (conf >= MIN_CONFIDENCE_THRESHOLD) alerts.push({
      id: 'cpa_no_data', label: 'CPA',
      fact: 'Sem dados suficientes de CPA',
      context: `${m.daysOfData} dias de dados · ${m.totalConversions < 3 ? 'menos de 3 conversões' : 'nenhuma conversão'}`,
      ambiguity: 'CPA requer conversões para ser calculado. O sistema ainda não tem dados suficientes para análise.',
      impact: m.totalClicks > 50
        ? `${m.totalClicks} cliques sem conversão atribuída — pode haver perda de rastreamento`
        : 'Volume ainda baixo para análise de impacto',
      trustLine,
      confidenceLabel: confidenceLabel(conf),
      dismissLabel: 'Entendido',
      investigateLabel: 'Investigar conversões',
      chatMsg: `Sem dados de CPA\n\n${m.daysOfData} dias · ${m.totalClicks} cliques · ${fmtReais(m.totalSpend)} investidos · ${m.totalConversions} conversões\n\nPreciso entender por que há poucas conversões registradas.`,
      priority: Math.round(40 * conf * goalBoost('cpa')),
    });
  }

  // ── CPA: deviation ──
  if (m.baselineCpa !== null && m.baselineCpa > 100 && m.avgCpa > 0 && m.totalConversions >= 3) {
    const cpaRatio = m.avgCpa / m.baselineCpa;
    // RULE 4: improving metric NEVER fires — CPA at or below baseline = good
    if (cpaRatio <= 1.0) { /* metric improving — no alert, ever */ }
    else if (cpaRatio > 1.3) {
      const devPct = Math.round((cpaRatio - 1) * 100);
      const conf = computeConfidence(m.daysOfData, m.totalSpend, m.totalConversions, m.volatilityCpa, m.freshnessFactor);
      const extraCost = Math.round((m.avgCpa - m.baselineCpa) * m.totalConversions * 0.7);
      // RULE 2: low confidence → suppress
      if (conf >= MIN_CONFIDENCE_THRESHOLD) alerts.push({
        id: 'cpa_deviation', label: 'CPA',
        fact: `CPA ${devPct}% acima do padrão da sua conta`,
        context: `Atual: ${fmtReais(m.avgCpa)} · Padrão: ${fmtReais(m.baselineCpa)}`,
        ambiguity: m.volatilityCpa > 0.4
          ? 'Seu CPA tem variado bastante — esse desvio pode ser ruído temporário.'
          : m.freshnessFactor > 0.5
            ? 'Dados recentes podem estar incompletos — conversões podem ainda estar sendo atribuídas.'
            : 'Desvio pode ser temporário (novos públicos), sazonal, ou indicar necessidade de otimização.',
        impact: extraCost > 0
          ? `Estimativa: ~${fmtReais(extraCost)} a mais do que o esperado no período`
          : `~${devPct}% a mais por conversão do que o habitual`,
        trustLine,
        confidenceLabel: confidenceLabel(conf),
        dismissLabel: 'CPA está adequado',
        investigateLabel: 'Otimizar CPA →',
        chatMsg: `CPA acima do padrão da conta\n\nAtual: ${fmtReais(m.avgCpa)} · Padrão: ${fmtReais(m.baselineCpa)} (${devPct}% acima)\n${m.totalConversions} conversões · ${fmtReais(m.totalSpend)} investidos\n${confidenceLabel(conf)}${m.volatilityCpa > 0.4 ? ' · CPA volátil' : ''}\n\nVamos analisar o que pode estar elevando o custo por conversão.`,
        priority: Math.round(80 * conf * goalBoost('cpa')),
      });
    }
  }

  // ── CTR: deviation ──
  if (m.baselineCtr !== null && m.baselineCtr > 10 && m.avgCtr > 0) {
    const ctrRatio = m.avgCtr / m.baselineCtr;
    // RULE 4: improving metric NEVER fires — CTR at or above baseline = good
    if (ctrRatio >= 1.0) { /* metric improving — no alert, ever */ }
    else if (ctrRatio < 0.75) {
      const dropPct = Math.round((1 - ctrRatio) * 100);
      const conf = computeConfidence(m.daysOfData, m.totalSpend, m.totalClicks, m.volatilityCtr, m.freshnessFactor);
      const baseDec = m.baselineCtr / 10000;
      const currDec = m.avgCtr / 10000;
      const lostClicks = m.totalImpressions > 0
        ? Math.round((baseDec - currDec) * m.totalImpressions * 0.7)
        : 0;
      // RULE 2: low confidence → suppress
      if (conf >= MIN_CONFIDENCE_THRESHOLD) alerts.push({
        id: 'ctr_deviation', label: 'CTR',
        fact: `Seu CTR está ${dropPct}% abaixo do padrão da sua conta`,
        context: `Atual: ${fmtPct(m.avgCtr)} · Padrão: ${fmtPct(m.baselineCtr)}`,
        ambiguity: m.volatilityCtr > 0.4
          ? 'Seu CTR tem variado bastante — esse desvio pode ser ruído temporário.'
          : 'Queda pode ser por: fadiga do criativo, público novo, ou mudança sazonal.',
        impact: lostClicks > 0
          ? `Estimativa: ~${lostClicks.toLocaleString('pt-BR')} cliques perdidos no período`
          : `~${Math.min(dropPct, 40)}% menos cliques em relação ao seu padrão`,
        trustLine,
        confidenceLabel: confidenceLabel(conf),
        dismissLabel: 'CTR aceitável',
        investigateLabel: 'Melhorar CTR →',
        chatMsg: `CTR abaixo do padrão da conta\n\nAtual: ${fmtPct(m.avgCtr)} · Padrão: ${fmtPct(m.baselineCtr)} (${dropPct}% abaixo)\n${m.totalClicks} cliques · ${fmtReais(m.totalSpend)} investidos${lostClicks > 0 ? `\n~${lostClicks} cliques perdidos` : ''}\n${confidenceLabel(conf)}\n\nVamos analisar por que o CTR caiu.`,
        priority: Math.round(60 * conf * goalBoost('ctr')),
      });
    }
  }

  // ── ROAS: deviation ──
  if (m.baselineRoas !== null && m.baselineRoas > 0.1 && m.avgRoas > 0 && m.totalRevenue > 0 && m.totalSpend > 5000) {
    const roasRatio = m.avgRoas / m.baselineRoas;
    // RULE 4: improving metric NEVER fires — ROAS at or above baseline = good
    if (roasRatio >= 1.0) { /* metric improving — no alert, ever */ }
    else if (roasRatio < 0.75) {
      const dropPct = Math.round((1 - roasRatio) * 100);
      const conf = computeConfidence(m.daysOfData, m.totalSpend, m.totalConversions, 0, m.freshnessFactor);
      const lostRev = Math.round(m.totalSpend * (m.baselineRoas - m.avgRoas) * 0.7);
      // RULE 2: low confidence → suppress
      if (conf >= MIN_CONFIDENCE_THRESHOLD) alerts.push({
        id: 'roas_deviation', label: 'ROAS',
        fact: `ROAS ${dropPct}% abaixo do padrão da sua conta`,
        context: `Atual: ${m.avgRoas.toFixed(2).replace('.', ',')}x · Padrão: ${m.baselineRoas.toFixed(2).replace('.', ',')}x`,
        ambiguity: m.freshnessFactor > 0.5
          ? 'Dados recentes podem estar incompletos — ROAS costuma ser recalculado com atraso.'
          : 'Queda pode ser por: atribuição incompleta, ciclo de compra longo, ou desalinhamento criativo-público.',
        impact: lostRev > 0
          ? `Estimativa: ~${fmtReais(lostRev)} de receita potencial não capturada`
          : 'Retorno abaixo do padrão — margem para otimização',
        trustLine,
        confidenceLabel: confidenceLabel(conf),
        dismissLabel: 'ROAS está correto',
        investigateLabel: 'Investigar ROAS →',
        chatMsg: `ROAS abaixo do padrão da conta\n\nAtual: ${m.avgRoas.toFixed(2)}x · Padrão: ${m.baselineRoas.toFixed(2)}x (${dropPct}% abaixo)\n${fmtReais(m.totalRevenue)} receita · ${fmtReais(m.totalSpend)} investidos${lostRev > 0 ? `\n~${fmtReais(lostRev)} receita perdida` : ''}\n${confidenceLabel(conf)}\n\nVamos verificar o retorno.`,
        priority: Math.round(70 * conf * goalBoost('roas')),
      });
    }
  }

  // ── CONFLICT RESOLUTION + METRIC COUPLING ──
  const hasCpa = alerts.find(a => a.id === 'cpa_deviation');
  const hasCtr = alerts.find(a => a.id === 'ctr_deviation');
  const hasRoas = alerts.find(a => a.id === 'roas_deviation');

  // Direct conflict: CPA + CTR
  if (hasCpa && hasCtr) {
    if (goalMetric === 'cpa') hasCtr.priority = Math.round(hasCtr.priority * 0.5);
    else if (!goalMetric) hasCtr.priority = Math.round(hasCtr.priority * 0.7);
  }

  // Indirect coupling: CTR improved but goal (CPA/ROAS) worsened → deprioritize CTR
  if (hasCtr && m.baselineCtr !== null && m.avgCtr > m.baselineCtr) {
    // CTR is actually ABOVE baseline (improved), but CPA/ROAS worsened — bad traffic
    if (hasCpa || hasRoas) {
      hasCtr.priority = Math.round(hasCtr.priority * 0.3); // strongly deprioritize
    }
  }

  // Sort by priority descending, limit to max 2
  alerts.sort((a, b) => b.priority - a.priority);
  return alerts.slice(0, 2);
}

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
  const dotColor = { baixa: T.yellow, média: T.blue, alta: T.green }[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, fontWeight: 600, color: T.text3,
      fontFamily: F,
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
      borderLeft: `2px solid ${T.green}40`,
      padding: '10px 14px', marginBottom: 14,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, color: T.labelColor,
        letterSpacing: '0.12em', marginBottom: 6,
      }}>RESULTADO ALCANÇADO</div>

      {bestWin && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: T.text1, fontFamily: F }}>
            {bestWin.type === 'kill' ? '-' : '+'}R${Math.round(Math.abs(totalImpact) / 100).toLocaleString('pt-BR')}
          </span>
          <span style={{ fontSize: 11, color: T.text3, marginLeft: 4, fontWeight: 600 }}>/dia</span>
        </div>
      )}

      {monthlyImpact > 0 && (
        <div style={{ fontSize: 11.5, color: T.text3, fontFamily: F, marginBottom: 4 }}>
          Projetado: <span style={{ color: T.green, fontWeight: 600 }}>
            +R${Math.round(monthlyImpact / 100).toLocaleString('pt-BR')}/mês
          </span>
        </div>
      )}

      <div style={{ fontSize: 10, color: T.text3, fontFamily: F, overflowWrap: 'break-word' }}>
        {actioned.length} {actioned.length === 1 ? 'otimização aplicada' : 'otimizações aplicadas'} · dados reais
      </div>
    </div>
  );
};

// ── SYSTEM STATUS — "Sistema ativo" confidence block ──
/**
 * UnifiedSystemStatus — single global health indicator.
 * Consolidates: tracking, metrics, account health, system activity.
 * ONE dot. ONE line. User glances and moves on.
 */
const SystemStatus: React.FC<{
  decisions: Decision[];
  tracker: any;
  patternsCount?: number;
  trackingStatus?: TrackingStatus;
  hasMetricAlerts?: boolean;
  trackingHasIssue?: boolean;
}> = ({ decisions, tracker, patternsCount = 0, trackingStatus = 'unknown', hasMetricAlerts = false, trackingHasIssue = false }) => {
  // Determine global state — worst signal wins
  const hasIssue = trackingStatus === 'verified_issue' || trackingHasIssue;
  const needsAttention = hasMetricAlerts || trackingStatus === 'investigating';
  const isHealthy = !hasIssue && !needsAttention;

  const dotColor = hasIssue ? T.red : needsAttention ? T.yellow : T.green;
  const label = hasIssue ? 'Problema detectado'
    : needsAttention ? 'Atenção necessária'
    : 'Sistema saudável';

  // Build secondary detail fragments — max 3, separated by " · "
  const details: string[] = [];
  if (trackingStatus === 'verified_ok') details.push('rastreamento ativo');
  else if (trackingStatus === 'verified_issue') details.push('rastreamento com problema');
  else if (trackingStatus === 'investigating') details.push('verificando rastreamento');
  if (isHealthy && !hasMetricAlerts) details.push('métricas estáveis');
  if (hasMetricAlerts) details.push('métricas requerem atenção');
  const actioned = decisions.filter((d: any) => d.status === 'actioned' || d.status === 'resolved');
  if (actioned.length > 0) details.push(`${actioned.length} ${actioned.length === 1 ? 'otimização' : 'otimizações'}`);

  const detailStr = details.slice(0, 3).join(' · ');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 2px', marginBottom: 10,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: dotColor,
        boxShadow: `0 0 6px ${dotColor}40`,
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: T.text2, fontFamily: F }}>
        {label}
      </span>
      {detailStr && (
        <span style={{ fontSize: 10.5, color: T.text3, fontFamily: F }}>
          · {detailStr}
        </span>
      )}
    </div>
  );
};

const PeriodSelector: React.FC<{ value: PeriodKey; onChange: (k: PeriodKey) => void }> = ({ value, onChange }) => (
  <div className="feed-micro-btn" style={{ display: 'flex', gap: 2, background: T.bg1, borderRadius: 4, padding: 2 }}>
    {PERIODS.map(p => {
      const active = p.key === value;
      return (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          background: active ? T.bg2 : 'transparent',
          color: active ? T.text1 : T.text3,
          border: 'none',
          borderRadius: 3, padding: '4px 10px',
          fontSize: 11, fontWeight: active ? 700 : 500,
          cursor: 'pointer', fontFamily: F, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = T.bg2; (e.currentTarget as HTMLElement).style.color = T.text2; } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.text3; } }}>
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
          background: 'transparent', color: T.blue, border: 'none',
          padding: '4px 0', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: F,
          opacity: hov ? 0.7 : 1, transition: 'opacity 0.12s',
        }}>
        {label}
      </button>
    );
  }
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.blueHover : T.blue, color: T.text1, border: 'none',
        padding: '9px 18px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: F,
        transition: 'all 0.15s',
        boxShadow: hov ? `0 4px 14px ${T.blue}30` : 'none',
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
      background: T.bg1, border: `1px solid ${T.border1}`,
      borderRadius: 6, padding: '14px 16px', fontFamily: F, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <svg width="16" height="16" viewBox="0 0 28 28" style={{ animation: 'sync-spin 2s linear infinite', flexShrink: 0 }}>
          <circle cx="14" cy="14" r="12" fill="none" stroke={T.border1} strokeWidth="1.5"/>
          <circle cx="14" cy="14" r="2.5" fill={T.blue}/>
          <path d="M14 14 L14 2 A12 12 0 0 1 24.39 8.0 Z" fill={`${T.blue}30`}/>
          <line x1="14" y1="14" x2="14" y2="2" stroke={`${T.blue}80`} strokeWidth="1"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text1 }}>
          {SYNC_STEPS[step] || SYNC_STEPS[SYNC_STEPS.length - 1]}
        </span>
      </div>
      <div style={{
        height: 2, borderRadius: 2,
        background: T.border1, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2, background: T.blue,
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
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text1, letterSpacing: '-0.01em', flexShrink: 0 }}>
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
          {/* CONNECTED — plain text, same style as Intelligence empty state */}
          {conn && (
            <div style={{ padding: '4px 2px 16px' }}>
              <p style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.40)', fontFamily: F,
                margin: 0, lineHeight: 1.55,
              }}>
                Você será notificado quando: perdas forem detectadas, oportunidades surgirem, ações forem necessárias.
              </p>
            </div>
          )}

          {/* PAIRING */}
          {!conn && pairingLink && (
            <div style={{
              background: T.bg1, border: `1px solid ${T.border1}`,
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
              background: T.bg1, border: `1px solid ${T.border1}`,
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
// STATE 1A — NO META CONNECTION
// Guide user to connect their Meta Ads account
// ================================================================
const MetaLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg height={size} width={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta-g0)"/>
    <path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta-g1)"/>
    <path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta-g2)"/>
    <path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta-g3)"/>
    <path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta-g4)"/>
    <path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta-g5)"/>
    <path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"/>
    <path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta-g6)"/>
    <path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"/>
    <path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta-g7)"/>
    <path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta-g8)"/>
    <path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta-g9)"/>
    <path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta-g10)"/>
    <path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta-g11)"/>
    <path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta-g12)"/>
    <defs>
      <linearGradient id="meta-g0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"/><stop offset="45.39%" stopColor="#0668E1"/><stop offset="85.91%" stopColor="#0064E0"/></linearGradient>
      <linearGradient id="meta-g1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"/><stop offset="99.88%" stopColor="#0064E0"/></linearGradient>
      <linearGradient id="meta-g2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"/><stop offset="68.81%" stopColor="#0064DF"/></linearGradient>
      <linearGradient id="meta-g3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"/><stop offset="99.43%" stopColor="#0072EC"/></linearGradient>
      <linearGradient id="meta-g4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#007CF6"/></linearGradient>
      <linearGradient id="meta-g5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"/><stop offset="100%" stopColor="#0082FB"/></linearGradient>
      <linearGradient id="meta-g6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"/><stop offset="91.41%" stopColor="#0082FB"/></linearGradient>
      <linearGradient id="meta-g7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"/><stop offset="99.95%" stopColor="#0081FA"/></linearGradient>
      <linearGradient id="meta-g8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
      <linearGradient id="meta-g9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"/><stop offset="100%" stopColor="#0080F9"/></linearGradient>
      <linearGradient id="meta-g10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"/><stop offset="99.94%" stopColor="#0279F1"/></linearGradient>
      <linearGradient id="meta-g11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"/><stop offset="100%" stopColor="#0377EF"/></linearGradient>
      <linearGradient id="meta-g12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"/><stop offset="100%" stopColor="#0471E9"/></linearGradient>
    </defs>
  </svg>
);

const StateNoConnection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: F }}>
      {/* Main connect CTA card */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(160deg, rgba(0,100,224,0.12) 0%, rgba(0,130,251,0.04) 50%, rgba(8,103,223,0.08) 100%)',
        border: '1px solid rgba(0,130,251,0.15)',
        borderRadius: 14, padding: 'clamp(28px, 5vw, 40px) clamp(20px, 4vw, 32px)',
        textAlign: 'center',
        overflow: 'hidden',
      }}>
        {/* Subtle glow orb behind icon */}
        <div style={{
          position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,130,251,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Meta logo */}
        <div style={{
          position: 'relative',
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(0,130,251,0.15) 0%, rgba(0,100,224,0.08) 100%)',
          border: '1px solid rgba(0,130,251,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 4px 24px rgba(0,130,251,0.1)',
        }}>
          <MetaLogo size={30} />
        </div>

        <h2 style={{
          fontSize: 18, fontWeight: 700, color: T.text1, margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}>
          Conecte seu Meta Ads
        </h2>
        <p style={{ fontSize: 13, color: T.text2, margin: '0 0 28px', lineHeight: 1.65, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          A IA precisa dos seus dados reais para gerar decisões, analisar campanhas e sugerir melhorias.
        </p>

        <button
          onClick={() => navigate('/dashboard/accounts')}
          style={{
            fontFamily: F, fontSize: 14, fontWeight: 700,
            padding: '13px 32px', borderRadius: 10,
            background: 'linear-gradient(135deg, #0082FB 0%, #0064E0 100%)',
            color: '#fff', border: 'none',
            cursor: 'pointer', transition: 'all 0.2s ease',
            boxShadow: '0 2px 16px rgba(0,130,251,0.3), 0 0 0 1px rgba(0,130,251,0.1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 28px rgba(0,130,251,0.45), 0 0 0 1px rgba(0,130,251,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,130,251,0.3), 0 0 0 1px rgba(0,130,251,0.1)'; }}
        >
          Conectar conta
        </button>

        {/* Trust signals */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '🔒', text: 'OAuth seguro' },
            { icon: '👁', text: 'Leitura apenas' },
            { icon: '⚡', text: '30 segundos' },
          ].map(t => (
            <span key={t.text} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)',
              display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: '0.01em',
            }}>
              <span style={{ fontSize: 10 }}>{t.icon}</span> {t.text}
            </span>
          ))}
        </div>
      </div>

      {/* What happens after connecting */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, margin: '0 0 10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Depois de conectar
        </p>
        {[
          { icon: '📊', label: 'Feed inteligente', desc: 'Decisões automáticas sobre o que pausar, escalar e otimizar' },
          { icon: '🧠', label: 'IA com dados reais', desc: 'Respostas baseadas no seu CTR, ROAS e gasto real' },
          { icon: '🔔', label: 'Alertas proativos', desc: 'Telegram notifica quando algo crítico acontece' },
        ].map((item, i) => (
          <div key={i} style={{
            borderRadius: 8, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 14,
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: T.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}>{item.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary: use without connection */}
      <div style={{
        marginTop: 20, padding: '14px 16px', borderRadius: 10,
        background: T.bg1, border: `1px solid ${T.border1}`,
        display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
        onClick={() => navigate('/dashboard/ai')}
        onMouseEnter={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = T.bg1; e.currentTarget.style.borderColor = T.border1; }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>💬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2 }}>Sem conta de anúncios?</div>
          <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.4 }}>Use o chat IA para criar hooks, roteiros e briefs</div>
        </div>
        <span style={{ color: T.text3, fontSize: 16, flexShrink: 0, opacity: 0.5 }}>›</span>
      </div>
    </div>
  );
};

// ================================================================
// STATE 1B — META CONNECTED BUT NO ADS (0 campanhas / 0 anúncios)
// Creative entry experience — never empty, always actionable
// ================================================================
const StateNoAds: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ fontFamily: F }}>
      <div style={{
        background: T.bg1, border: `1px solid ${T.border1}`,
        borderRadius: 8, padding: 'clamp(20px, 4vw, 28px)',
      }}>
        {/* Status — inline minimal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.yellow, opacity: 0.7 }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: T.text3 }}>
            Nenhuma campanha ativa
          </span>
        </div>

        <h2 style={{
          fontSize: 16, fontWeight: 700, color: T.text1, margin: '0 0 6px',
          letterSpacing: '-0.02em',
        }}>
          Conta conectada — crie seu primeiro anúncio
        </h2>
        <p style={{ fontSize: 12.5, color: T.text2, margin: '0 0 20px', lineHeight: 1.6 }}>
          Sua conta Meta Ads está conectada. Use a IA para criar os melhores anúncios antes de investir.
        </p>

        {/* Action items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
          {[
            { label: 'Gerar ideias de criativos', desc: 'Baseado em padrões de alta performance' },
            { label: 'Criar hooks de alta performance', desc: 'Primeiros segundos que capturam atenção' },
            { label: 'Montar briefs prontos para teste', desc: 'Estruturados para validação rápida' },
          ].map((item, i) => (
            <div key={i}
              onClick={() => navigate('/dashboard/ai')}
              style={{
                background: 'transparent',
                borderRadius: 6, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg2; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text1, marginBottom: 1 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: T.text3 }}>{item.desc}</div>
              </div>
              <span style={{ color: T.text3, fontSize: 14, flexShrink: 0 }}>→</span>
            </div>
          ))}
        </div>

        <ActionButton label="Criar primeiro criativo" onClick={() => navigate('/dashboard/ai')} />
      </div>

      <p style={{
        textAlign: 'center', fontSize: 10.5, color: T.text3,
        margin: '12px 0 0', lineHeight: 1.5,
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

interface CampaignSummary {
  id: string;
  name: string;
  meta_campaign_id: string;
  status?: string | null;
  objective?: string | null;
  daily_budget?: number | null;
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

/** Resolve display label + color for a campaign's status */
function getCampaignStatusDisplay(c: CampaignSummary): { label: string; color: string; dotColor: string } {
  const s = (c.status || '').toUpperCase();
  if (s === 'PAUSED') return { label: 'Pausado', color: 'rgba(255,255,255,0.60)', dotColor: 'rgba(255,255,255,0.45)' };
  if (s === 'ARCHIVED' || s === 'DELETED') return { label: 'Arquivado', color: 'rgba(255,255,255,0.40)', dotColor: 'rgba(255,255,255,0.18)' };
  return { label: 'Ativo', color: '#4ADE80', dotColor: 'rgba(74,222,128,0.50)' };
}

/** Group ads by campaign name */
function groupAdsByCampaign(ads: AdSummary[]): Map<string, AdSummary[]> {
  const map = new Map<string, AdSummary[]>();
  ads.forEach(ad => {
    const campName = ad.ad_set?.campaign?.name || 'Sem campanha';
    if (!map.has(campName)) map.set(campName, []);
    map.get(campName)!.push(ad);
  });
  return map;
}

/** Collapsible ad list — shows 3 ads collapsed, rest hidden */
const AD_LIST_PREVIEW = 3;

/** Single ad row with toggle button */
const AdRow: React.FC<{
  ad: AdSummary;
  togglingAd?: string | null;
  toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
}> = ({ ad, togglingAd, toggleSuccess, onRequestToggle }) => {
  const st = getAdStatusDisplay(ad);
  const isPaused = st.label === 'Pausado';
  const isActive = st.label === 'Saudável' || st.label === 'Aprendizado';
  const canToggle = onRequestToggle && ad.meta_ad_id && (isPaused || isActive);
  const isToggling = togglingAd === ad.meta_ad_id;
  const justSucceeded = toggleSuccess?.id === ad.meta_ad_id;

  return (
    <div className="feed-micro-btn" style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 2px 5px 12px', minWidth: 0,
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
        justSucceeded ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 3,
            background: 'rgba(74,222,128,0.08)', color: T.green,
            fontSize: 10, fontWeight: 600, fontFamily: F, flexShrink: 0,
            animation: 'feed-success 0.3s ease forwards',
          }}>
            ✓ {toggleSuccess.action === 'pause' ? 'Pausado' : 'Ativado'}
          </span>
        ) : (
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
              opacity: isToggling ? 0.4 : 1, transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { if (!isToggling) { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.08)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)'; }}
          >
            {isToggling ? (
              <span style={{ width: 9, height: 9, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'rgba(255,255,255,0.7)', borderRadius: '50%', display: 'inline-block', animation: 'feed-shimmer 0.8s linear infinite' }} />
            ) : isPaused ? <Play size={9} /> : <Pause size={9} />}
            {isToggling ? '...' : isPaused ? 'Ativar' : 'Pausar'}
          </button>
        )
      )}
    </div>
  );
};

/** Campaign row — expandable, shows ads inside */
const CampaignRow: React.FC<{
  campaign: CampaignSummary;
  ads: AdSummary[];
  togglingAd?: string | null;
  toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
  togglingCampaign?: string | null;
  campaignToggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestCampaignToggle?: (campaign: CampaignSummary, action: 'pause' | 'activate') => void;
}> = ({ campaign, ads, togglingAd, toggleSuccess, onRequestToggle, togglingCampaign, campaignToggleSuccess, onRequestCampaignToggle }) => {
  const [open, setOpen] = useState(false);
  const sorted = sortAdsByStatus(ads);
  const st = getCampaignStatusDisplay(campaign);
  const isPaused = st.label === 'Pausado';
  const isActive = st.label === 'Ativo';
  const canToggle = onRequestCampaignToggle && campaign.meta_campaign_id && (isPaused || isActive);
  const isToggling = togglingCampaign === campaign.meta_campaign_id;
  const justSucceeded = campaignToggleSuccess?.id === campaign.meta_campaign_id;

  return (
    <div>
      {/* Campaign header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px' }}>
        <div
          onClick={() => setOpen(prev => !prev)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span style={{
            fontSize: 14, lineHeight: 1,
            color: open ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)',
            transition: 'transform 0.2s ease, color 0.15s',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>›</span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dotColor, flexShrink: 0 }} />
          <span style={{
            fontSize: 11.5, fontWeight: 600, color: T.text1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }}>
            {campaign.name}
          </span>
          <span style={{ fontSize: 10, color: st.color, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {st.label}
          </span>
          <span style={{ fontSize: 9.5, color: T.text3, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {ads.length} {ads.length === 1 ? 'anúncio' : 'anúncios'}
          </span>
        </div>
        {canToggle && (
          justSucceeded ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 3,
              background: 'rgba(74,222,128,0.08)', color: T.green,
              fontSize: 10, fontWeight: 600, fontFamily: F, flexShrink: 0,
              animation: 'feed-success 0.3s ease forwards',
            }}>
              ✓ {campaignToggleSuccess.action === 'pause' ? 'Pausado' : 'Ativado'}
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestCampaignToggle!(campaign, isPaused ? 'activate' : 'pause'); }}
              disabled={isToggling}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 3, border: 'none',
                background: isPaused ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)',
                color: isPaused ? '#4ADE80' : 'rgba(255,255,255,0.40)',
                fontSize: 10, fontWeight: 600, fontFamily: F,
                cursor: isToggling ? 'default' : 'pointer',
                opacity: isToggling ? 0.4 : 1, transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { if (!isToggling) { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.08)'; } }}
              onMouseLeave={e => { e.currentTarget.style.background = isPaused ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.04)'; }}
            >
              {isToggling ? (
                <span style={{ width: 9, height: 9, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'rgba(255,255,255,0.7)', borderRadius: '50%', display: 'inline-block', animation: 'feed-shimmer 0.8s linear infinite' }} />
              ) : isPaused ? <Play size={9} /> : <Pause size={9} />}
              {isToggling ? '...' : isPaused ? 'Ativar' : 'Pausar'}
            </button>
          )
        )}
      </div>
      {/* Ads inside campaign */}
      <FeedExpandable open={open}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 6 }}>
          {sorted.map((ad, i) => (
            <AdRow key={ad.meta_ad_id || i} ad={ad} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={onRequestToggle} />
          ))}
        </div>
      </FeedExpandable>
    </div>
  );
};

/** CampaignList — shows campaigns, each expandable to reveal their ads */
const CampaignList: React.FC<{
  campaigns: CampaignSummary[];
  ads: AdSummary[];
  totalAds: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onToggleAd?: (adId: string, action: 'pause' | 'activate') => void;
  togglingAd?: string | null;
  toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
  togglingCampaign?: string | null;
  campaignToggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestCampaignToggle?: (campaign: CampaignSummary, action: 'pause' | 'activate') => void;
}> = ({ campaigns, ads, totalAds, onLoadMore, loadingMore, togglingAd, toggleSuccess, onRequestToggle, togglingCampaign, campaignToggleSuccess, onRequestCampaignToggle }) => {
  const [open, setOpen] = useState(false);
  const adsByCampaign = groupAdsByCampaign(ads);

  // Sort campaigns: ACTIVE first, then PAUSED
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aP = (a.status || '').toUpperCase() === 'PAUSED' ? 1 : 0;
    const bP = (b.status || '').toUpperCase() === 'PAUSED' ? 1 : 0;
    return aP - bP;
  });

  const activeCamps = campaigns.filter(c => (c.status || '').toUpperCase() !== 'PAUSED' && (c.status || '').toUpperCase() !== 'ARCHIVED').length;
  const pausedCamps = campaigns.length - activeCamps;

  const hasMore = totalAds > ads.length;

  return (
    <div style={{ fontFamily: F }}>
      {/* Collapsible header */}
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
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text1 }}>
          Campanhas
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
          {open ? campaigns.length : `${activeCamps} ativa${activeCamps !== 1 ? 's' : ''}${pausedCamps > 0 ? `, ${pausedCamps} pausada${pausedCamps !== 1 ? 's' : ''}` : ''}`}
        </span>
      </div>

      <FeedExpandable open={open}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
          {sortedCampaigns.map(campaign => {
            const campAds = adsByCampaign.get(campaign.name) || [];
            return (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                ads={campAds}
                togglingAd={togglingAd}
                toggleSuccess={toggleSuccess}
                onRequestToggle={onRequestToggle}
                togglingCampaign={togglingCampaign}
                campaignToggleSuccess={campaignToggleSuccess}
                onRequestCampaignToggle={onRequestCampaignToggle}
              />
            );
          })}
          {/* Load more ads */}
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

/** Legacy AdList — kept for backward compat in single-ad states */
const AdList: React.FC<{
  ads: AdSummary[];
  totalAds: number;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  onToggleAd?: (adId: string, action: 'pause' | 'activate') => void;
  togglingAd?: string | null;
  toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
}> = ({ ads, totalAds, onLoadMore, loadingMore, togglingAd, toggleSuccess, onRequestToggle }) => {
  const [open, setOpen] = useState(false);
  const sorted = sortAdsByStatus(ads);
  const hasMore = totalAds > ads.length;

  return (
    <div style={{ fontFamily: F }}>
      <div onClick={() => setOpen(prev => !prev)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 2px', cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{
          fontSize: 14, lineHeight: 1,
          color: open ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)',
          transition: 'transform 0.2s ease, color 0.15s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>›</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text1 }}>Anúncios</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>{totalAds}</span>
      </div>
      <FeedExpandable open={open}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 2 }}>
          {sorted.map((ad, i) => (
            <AdRow key={ad.meta_ad_id || i} ad={ad} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={onRequestToggle} />
          ))}
          {hasMore && (
            <button onClick={(e) => { e.stopPropagation(); onLoadMore?.(); }} disabled={loadingMore} style={{
              background: 'none', border: 'none', padding: '6px 2px',
              fontSize: 10.5, color: 'rgba(14,165,233,0.55)', fontWeight: 600,
              cursor: loadingMore ? 'default' : 'pointer', fontFamily: F, textAlign: 'left',
            }}>
              {loadingMore ? 'Carregando...' : `+ Carregar mais ${Math.min(40, totalAds - ads.length)} anúncios`}
            </button>
          )}
        </div>
      </FeedExpandable>
    </div>
  );
};

/**
 * AdMetricsSummary — single source of truth for FeedPage metric intelligence.
 *
 * DATA CONTRACT:
 * - Source: `ad_metrics` table (via Supabase) — synced by `sync-meta-data`
 * - Units: integers matching DB storage (centavos for money, basis points for rates)
 * - Formatters: use `fmtReais(centavos)` for money, `fmtPct(basisPoints)` for rates
 *
 * CROSS-COMPONENT NOTE:
 * - PerformanceDashboard uses `live-metrics` API → reais (float), CTR decimal (0.015)
 * - AdDiary uses `ad_diary` table → reais (float), CTR decimal
 * - FeedPage uses `ad_metrics` table → centavos (int), CTR basis points (int)
 * - These are intentionally different data sources. Do NOT pass values between them
 *   without unit conversion.
 */
interface AdMetricsSummary {
  totalSpend: number;        // centavos (int) — use fmtReais() to display
  totalConversions: number;  // count (int)
  totalRevenue: number;      // centavos (int) — use fmtReais() to display
  totalClicks: number;       // count (int)
  totalImpressions: number;  // count (int)
  avgCtr: number;            // basis points (int, 93 = 0.93%) — use fmtPct() to display
  avgCpa: number;            // centavos (int) — use fmtReais() to display
  avgRoas: number;           // ratio (float, 3.0 = 3x) — display directly with .toFixed()
  avgCpc: number;            // centavos (int) — use fmtReais() to display
  daysOfData: number;        // count of unique dates with data
  // Baselines — drift-protected: max(recent, anchor * 0.8)
  // "recent" = robust median of selected period. "anchor" = robust median of 30d.
  baselineCtr: number | null;   // basis points (int) — drift-protected
  baselineCpa: number | null;   // centavos (int) — drift-protected
  baselineRoas: number | null;  // ratio (float, 3.0 = 3x) — drift-protected, converted from DB basis points
  // Volatility — coefficient of variation (stddev/mean), 0-1+
  volatilityCtr: number;
  volatilityCpa: number;
  // Data freshness: fraction of data from last 24h (0-1). High = recent/incomplete data.
  freshnessFactor: number;       // float 0-1
  // Whether 30d anchor data was available (for trust messaging)
  hasAnchorBaseline: boolean;
}

/** Robust median: filters P5-P95 outliers, then computes median.
 *  Returns null for < 3 data points after filtering. */
function robustMedian(arr: number[]): number | null {
  if (arr.length < 3) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  // Remove bottom 5% and top 5%
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.05));
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length < 2) return sorted[Math.floor(sorted.length / 2)]; // fallback to simple median
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2 === 0 ? (trimmed[mid - 1] + trimmed[mid]) / 2 : trimmed[mid];
}

/** Coefficient of variation: stddev / mean. Returns 0 if not enough data. */
function coefficientOfVariation(arr: number[]): number {
  if (arr.length < 3) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  if (mean === 0) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance) / Math.abs(mean);
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
        background: T.bg1, border: `1px solid ${T.border1}`,
        borderLeft: `3px solid ${T.blue}`,
        borderRadius: 8, padding: 'clamp(16px, 4vw, 20px)',
        marginBottom: 8,
      }}>
        {/* Breadcrumb */}
        {breadcrumb && (
          <div style={{
            fontSize: 10.5, color: T.text3, fontWeight: 500,
            marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {breadcrumb}
          </div>
        )}

        <h3 style={{
          fontSize: 14, fontWeight: 700, color: T.text1, margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          {headline}
        </h3>
        <p style={{ fontSize: 12.5, color: T.text2, margin: '0 0 14px', lineHeight: 1.6 }}>
          {detail}
        </p>

        {/* Metric pills — no borders, just subtle bg */}
        {hasMetrics && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {metrics.avgCtr > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: lowCtr ? T.yellow : T.text2,
                background: T.bg2, padding: '3px 8px', borderRadius: 4,
              }}>
                CTR {fmtPct(metrics.avgCtr)}
              </span>
            )}
            {metrics.avgCpa > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: highCpa ? T.yellow : T.text2,
                background: T.bg2, padding: '3px 8px', borderRadius: 4,
              }}>
                CPA {fmtReais(metrics.avgCpa)}
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 600, color: T.text3,
              background: T.bg2, padding: '3px 8px', borderRadius: 4,
            }}>
              {metrics.daysOfData}d dados
            </span>
          </div>
        )}

        {/* Recommendations — inset surface */}
        <div style={{
          background: T.bg2, borderRadius: 6, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: T.labelColor,
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação · {periodLabel}
          </div>
          <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 2px' }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: T.blue,
          boxShadow: `0 0 4px ${T.blue}60`,
          animation: 'st2-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: T.text3, fontWeight: 500 }}>
          Monitorando em tempo real
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
        background: T.bg1, border: `1px solid ${T.border1}`,
        borderLeft: `3px solid ${T.blue}`,
        borderRadius: 8, padding: 'clamp(16px, 4vw, 20px)',
        marginBottom: 8,
      }}>
        {/* Status — inline minimal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.blue }} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: T.text3 }}>
            Dados em consolidação
          </span>
        </div>

        <h3 style={{
          fontSize: 14, fontWeight: 700, color: T.text1, margin: '0 0 6px',
          letterSpacing: '-0.01em',
        }}>
          Sinais iniciais detectados
        </h3>
        <p style={{
          fontSize: 12.5, color: T.text2, margin: '0 0 14px', lineHeight: 1.6,
        }}>
          {totalAds} {totalAds === 1 ? 'anúncio analisado' : 'anúncios analisados'} nos últimos {periodLabel} — volume insuficiente para decisões críticas
        </p>

        {/* Signals — inset surface */}
        <div style={{
          background: T.bg2, borderRadius: 6, padding: '12px 14px',
          marginBottom: 10,
        }}>
          <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7 }}>
            {lowCtr && <div style={{ marginBottom: 3 }}>• CTR abaixo da média esperada</div>}
            {hasMetrics && metrics.totalConversions === 0 && (
              <div style={{ marginBottom: 3 }}>• Sem conversões registradas ainda</div>
            )}
            <div>• Volume insuficiente para decisão crítica</div>
          </div>
        </div>

        {/* Soft recommendation */}
        <div style={{
          background: T.bg2, borderRadius: 6, padding: '12px 14px',
          marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: T.labelColor,
            textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
          }}>
            Recomendação
          </div>
          <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.7 }}>
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
          width: 5, height: 5, borderRadius: '50%', background: T.blue,
          boxShadow: `0 0 4px ${T.blue}60`,
          animation: 'st3-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10.5, color: T.text3, fontWeight: 500 }}>
          Análise em andamento · mais dados melhoram as decisões
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
const StateNoCritical: React.FC<{ totalAds: number; ads: AdSummary[]; campaigns: CampaignSummary[]; periodLabel: string; metaAccountId?: string; onLoadMoreAds?: () => void; loadingMoreAds?: boolean; onToggleAd?: (adId: string, action: 'pause' | 'activate') => void; togglingAd?: string | null; toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null; onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void; togglingCampaign?: string | null; campaignToggleSuccess?: { id: string; action: 'pause' | 'activate' } | null; onRequestCampaignToggle?: (campaign: CampaignSummary, action: 'pause' | 'activate') => void }> = ({ totalAds, ads, campaigns, periodLabel, metaAccountId, onLoadMoreAds, loadingMoreAds, onToggleAd, togglingAd, toggleSuccess, onRequestToggle, togglingCampaign, campaignToggleSuccess, onRequestCampaignToggle }) => {
  const navigate = useNavigate();
  const [oppHov, setOppHov] = useState(false);
  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── BLOCO 1: CAMPAIGNS → ADS ── */}
      {(campaigns.length > 0 || ads.length > 0) && (
        <div style={{
          background: T.bg1, border: `1px solid ${T.border1}`,
          borderRadius: 8, padding: 'clamp(14px, 3vw, 18px)',
        }}>
          {campaigns.length > 0 ? (
            <CampaignList campaigns={campaigns} ads={ads} totalAds={totalAds} onLoadMore={onLoadMoreAds} loadingMore={loadingMoreAds} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={onRequestToggle} togglingCampaign={togglingCampaign} campaignToggleSuccess={campaignToggleSuccess} onRequestCampaignToggle={onRequestCampaignToggle} />
          ) : (
            <AdList ads={ads} totalAds={totalAds} onLoadMore={onLoadMoreAds} loadingMore={loadingMoreAds} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={onRequestToggle} />
          )}
        </div>
      )}

      {/* ── BLOCO 2: OPORTUNIDADE — left border accent, neutral surface ── */}
      <div
        className="feed-card-lift"
        onMouseEnter={() => setOppHov(true)}
        onMouseLeave={() => setOppHov(false)}
        style={{
          background: oppHov ? T.bg2 : T.bg1,
          border: `1px solid ${T.border1}`,
          borderLeft: `3px solid ${T.blue}`,
          borderRadius: 8, padding: 'clamp(14px, 3vw, 18px)',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: T.labelColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          PRÓXIMA OPORTUNIDADE
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text1, marginBottom: 6, lineHeight: 1.4 }}>
          Seu próximo ganho vem de novos criativos · <span style={{ color: T.blue }}>+18% CTR potencial</span>
        </div>
        <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.55, marginBottom: 14 }}>
          Contas com performance semelhante escalam diversificando hooks e formatos
        </div>
        <button onClick={() => navigate('/dashboard/criar')} className="feed-cta" style={{
          background: T.blue, color: T.text1,
          border: 'none', borderRadius: 6,
          padding: '9px 20px', fontSize: 12.5, fontWeight: 700,
          fontFamily: F, cursor: 'pointer',
          transition: 'all 0.18s',
          boxShadow: oppHov ? `0 4px 14px ${T.blue}30` : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; }}>
          Gerar variação com IA
        </button>
      </div>

      {/* Footer absorbed into unified SystemStatus */}
    </div>
  );
};

// ================================================================
// PERFORMANCE SUMMARY — compressed, each block unique function
// 1. Status + metrics  2. Opportunity (the one strong insight)  3. Next action
// ================================================================
const PerformanceSummary: React.FC<{
  ads: AdSummary[];
  campaigns: CampaignSummary[];
  totalAds: number;
  metrics: AdMetricsSummary | null;
  periodLabel: string;
  metaAccountId?: string;
  onLoadMoreAds?: () => void;
  loadingMoreAds?: boolean;
  onToggleAd?: (adId: string, action: 'pause' | 'activate') => void;
  togglingAd?: string | null;
  toggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestToggle?: (ad: AdSummary, action: 'pause' | 'activate') => void;
  trackingIssue?: boolean;
  togglingCampaign?: string | null;
  campaignToggleSuccess?: { id: string; action: 'pause' | 'activate' } | null;
  onRequestCampaignToggle?: (campaign: CampaignSummary, action: 'pause' | 'activate') => void;
}> = ({ ads, campaigns, totalAds, metrics, periodLabel, metaAccountId, onLoadMoreAds, loadingMoreAds, onToggleAd, togglingAd, toggleSuccess, onRequestToggle, trackingIssue, togglingCampaign, campaignToggleSuccess, onRequestCampaignToggle }) => {
  const navigate = useNavigate();
  const hasMetrics = metrics && metrics.daysOfData > 0;

  // Use unified formatters (same source as KPI bar)
  const ctrPct = hasMetrics ? fmtPct(metrics.avgCtr) : null;
  const spendReais = hasMetrics ? fmtReais(metrics.totalSpend) : null;
  const cpaReais = hasMetrics && metrics.avgCpa > 0 ? fmtReais(metrics.avgCpa) : null;
  const ctrGood = hasMetrics && (metrics.avgCtr / 100) >= 1;
  // confLevel/confColor removed — status handled by unified SystemStatus

  const [oppHov, setOppHov] = useState(false);

  return (
    <div style={{ fontFamily: F, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>

      {/* ── BLOCO 1: METRICS — status handled by unified SystemStatus ── */}
      <div style={{
        background: T.bg1, border: `1px solid ${T.border1}`,
        borderRadius: 8, padding: 'clamp(14px, 3vw, 18px)',
      }}>
        {/* Metrics — clean grid, no heavy borders */}
        {hasMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            {[
              { label: 'Investido', value: spendReais || '—', color: T.text1 },
              { label: 'CTR', value: ctrPct || '—', color: ctrGood ? T.green : T.yellow },
              { label: 'CPA', value: cpaReais || '—', color: T.text1 },
            ].map((m, i) => (
              <div key={i} style={{
                background: T.bg2, borderRadius: 6,
                padding: '10px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: T.labelColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.color, letterSpacing: '-0.03em' }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tracking caveat */}
        {trackingIssue && hasMetrics && (
          <div style={{ fontSize: 10.5, color: T.text3, fontStyle: 'italic', marginBottom: 10, paddingLeft: 2 }}>
            Insights baseados em dados limitados de conversão
          </div>
        )}

        {/* Campaign → Ads hierarchy */}
        {campaigns.length > 0 ? (
          <CampaignList
            campaigns={campaigns}
            ads={ads}
            totalAds={totalAds}
            onLoadMore={onLoadMoreAds}
            loadingMore={loadingMoreAds}
            onToggleAd={onToggleAd}
            togglingAd={togglingAd}
            toggleSuccess={toggleSuccess}
            onRequestToggle={onRequestToggle}
            togglingCampaign={togglingCampaign}
            campaignToggleSuccess={campaignToggleSuccess}
            onRequestCampaignToggle={onRequestCampaignToggle}
          />
        ) : ads.length > 0 ? (
          <AdList ads={ads} totalAds={totalAds} onLoadMore={onLoadMoreAds} loadingMore={loadingMoreAds} onToggleAd={onToggleAd} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={onRequestToggle} />
        ) : null}
      </div>

      {/* ── BLOCO 2: OPORTUNIDADE ── */}
      <div
        className="feed-card-lift"
        onMouseEnter={() => setOppHov(true)}
        onMouseLeave={() => setOppHov(false)}
        style={{
          background: oppHov ? T.bg2 : T.bg1,
          border: `1px solid ${T.border1}`,
          borderLeft: `3px solid ${T.blue}`,
          borderRadius: 8, padding: 'clamp(14px, 3vw, 18px)',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: T.labelColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          PRÓXIMA OPORTUNIDADE
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text1, marginBottom: 6, lineHeight: 1.4 }}>
          {ctrGood
            ? <>CTR de <span style={{ color: T.green }}>{ctrPct}</span> — espaço para escalar com novos criativos</>
            : <>Seu próximo ganho vem de novos criativos · <span style={{ color: T.blue }}>+18% CTR potencial</span></>}
        </div>
        <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.55, marginBottom: 14 }}>
          Contas com performance semelhante escalam diversificando hooks e formatos
        </div>
        <button onClick={() => navigate('/dashboard/criar')} className="feed-cta" style={{
          background: T.blue, color: T.text1,
          border: 'none', borderRadius: 6,
          padding: '9px 20px', fontSize: 12.5, fontWeight: 700,
          fontFamily: F, cursor: 'pointer',
          transition: 'all 0.18s',
          boxShadow: oppHov ? `0 4px 14px ${T.blue}30` : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.blueHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.blue; }}>
          Gerar variação com IA
        </button>
      </div>

      {/* ── BLOCO 3: SISTEMA ATIVO ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px', animation: 'feed-fadeIn 0.4s ease' }}>
        <span style={{
          width: 4, height: 4, borderRadius: '50%', background: T.green,
          boxShadow: `0 0 5px ${T.green}40`,
          animation: 'pulse 2.5s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 10, color: T.text3 }}>
          Monitoramento ativo · sistema operando
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

// ================================================================
// UNIFIED FORMATTERS — single source of truth for number display
// Used by: KPI bar, PerformanceSummary, tracking card, state cards
// ================================================================

/** Format centavos → R$XX,XX. Never long decimals. */
const fmtReais = (centavos: number): string => {
  const v = centavos / 100;
  if (v >= 10000) return `R$${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `R$${(v / 1000).toFixed(1).replace('.', ',')}k`;
  if (v >= 100) return `R$${Math.round(v).toLocaleString('pt-BR')}`;
  if (v > 0) return `R$${v.toFixed(2).replace('.', ',')}`;
  return '—';
};

/** Format basis-point CTR (93 = 0.93%) → X,XX% */
const fmtPct = (basisPoints: number): string => {
  const v = basisPoints / 100;
  return `${v.toFixed(2).replace('.', ',')}%`;
};

/** Compute trend %. Returns null if no baseline or ±<2%. */
const calcTrend = (current: number, previous: number): number | null => {
  if (!previous || previous === 0 || !current) return null;
  const pct = ((current - previous) / previous) * 100;
  return Math.abs(pct) < 2 ? null : pct;
};

/** Inline trend badge: ▲ +12% or ▼ -8% */
const TrendBadge: React.FC<{ pct: number | null; invert?: boolean }> = ({ pct, invert }) => {
  if (pct === null) return null;
  const isUp = pct > 0;
  const isGood = invert ? !isUp : isUp;
  const color = isGood ? T.green : T.red;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, color,
      display: 'inline-flex', alignItems: 'center', gap: 2,
      marginTop: 3,
      animation: 'feed-fadeIn 0.3s ease',
    }}>
      {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{pct.toFixed(0)}%
    </span>
  );
};

// ================================================================
// PERFORMANCE PULSE — KPI bar
// Data source: adMetrics (ad_metrics table) = SINGLE SOURCE OF TRUTH
// Trend source: pulseData (daily_snapshots) = comparison only
// ================================================================

type KpiItem = {
  label: string;
  value: string;
  trend?: React.ReactNode;
  empty?: boolean;
  emptyMsg?: string;
  primary?: boolean;
};

const PerformancePulse: React.FC<{
  data: {
    spend7d: number; ctr7d: number; activeAds: number; totalAds?: number;
    spendPrev: number; ctrPrev: number;
  };
  savings: number;
  goalMetric?: string | null;
  adMetrics?: AdMetricsSummary | null;
  trackingBroken?: boolean;
  periodLabel?: string;
}> = ({ data, savings, goalMetric, adMetrics, trackingBroken, periodLabel }) => {
  const pausedAds = (data.totalAds || 0) - data.activeAds;
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  // ── Use adMetrics as single source of truth ──
  // This is the SAME data source that PerformanceSummary and tracking card use.
  const hasMetrics = adMetrics && adMetrics.daysOfData > 0;
  const hasConversions = hasMetrics && adMetrics.totalConversions > 0;

  // Spend: use adMetrics.totalSpend (centavos) — NOT pulseData.spend7d
  const spendDisplay = hasMetrics ? fmtReais(adMetrics.totalSpend) : '—';
  // Trend: compare against pulseData previous period (different table but OK for trend direction)
  const spendReaisCurrent = hasMetrics ? adMetrics.totalSpend / 100 : 0;
  const spendTrend = calcTrend(spendReaisCurrent, data.spendPrev);

  // CTR: use adMetrics.avgCtr (basis points) — NOT pulseData.ctr7d
  const ctrDisplay = hasMetrics && adMetrics.avgCtr > 0 ? fmtPct(adMetrics.avgCtr) : '';
  const ctrCurrent = hasMetrics ? adMetrics.avgCtr / 100 : 0; // to percentage
  const ctrPrevPct = data.ctrPrev < 1 ? data.ctrPrev * 100 : data.ctrPrev;
  const ctrTrend = calcTrend(ctrCurrent, ctrPrevPct);

  // ── Determine primary KPI: conversions exist → CPA/ROAS; otherwise → Spend ──
  const goalIsPrimary = !!goalMetric && goalMetric !== 'cpc';

  // ── Build 4 KPIs for 2×2 grid ──
  const kpis: KpiItem[] = [];

  // Slot 1: SPEND
  kpis.push({
    label: 'Investido',
    value: spendDisplay,
    trend: <TrendBadge pct={spendTrend} invert />,
    primary: !goalIsPrimary,
    empty: !hasMetrics || adMetrics.totalSpend === 0,
    emptyMsg: 'Sem investimento',
  });

  // Slot 2: GOAL METRIC (CPA / ROAS / CPC) or CTR as fallback
  if (goalMetric === 'cpa') {
    const hasData = hasMetrics && adMetrics.avgCpa > 0;
    kpis.push({
      label: 'CPA',
      value: hasData ? fmtReais(adMetrics!.avgCpa) : '',
      primary: true,
      empty: !hasData,
      emptyMsg: trackingBroken ? 'Sem conversões rastreadas' : 'Dados insuficientes',
    });
  } else if (goalMetric === 'roas') {
    const hasData = hasMetrics && adMetrics.avgRoas > 0;
    kpis.push({
      label: 'ROAS',
      value: hasData ? `${adMetrics!.avgRoas.toFixed(1)}x` : '',
      primary: true,
      empty: !hasData,
      emptyMsg: trackingBroken ? 'Sem conversões rastreadas' : 'Dados insuficientes',
    });
  } else if (goalMetric === 'cpc') {
    const hasData = hasMetrics && adMetrics.avgCpc > 0;
    kpis.push({
      label: 'CPC',
      value: hasData ? fmtReais(adMetrics!.avgCpc) : '',
      empty: !hasData,
      emptyMsg: 'Dados insuficientes',
    });
  } else {
    // No goal → show CPA if conversions exist, otherwise CTR
    if (hasConversions) {
      kpis.push({
        label: 'CPA',
        value: fmtReais(adMetrics!.avgCpa),
        primary: true,
      });
    } else {
      kpis.push({
        label: 'CTR',
        value: ctrDisplay || '',
        trend: <TrendBadge pct={ctrTrend} />,
        empty: !ctrDisplay,
        emptyMsg: 'Sem impressões',
      });
    }
  }

  // Slot 3: CTR (if not already shown in slot 2)
  const ctrAlreadyShown = kpis.some(k => k.label === 'CTR');
  if (!ctrAlreadyShown) {
    kpis.push({
      label: 'CTR',
      value: ctrDisplay || '',
      trend: <TrendBadge pct={ctrTrend} />,
      empty: !ctrDisplay,
      emptyMsg: 'Sem impressões',
    });
  } else {
    // Show CPA as third if we showed CTR in slot 2 (no-goal, no-conversions case)
    if (hasConversions) {
      kpis.push({
        label: 'CPA',
        value: fmtReais(adMetrics!.avgCpa),
      });
    } else {
      // No conversions + CTR already shown → show Clicks
      kpis.push({
        label: 'Cliques',
        value: hasMetrics ? adMetrics.totalClicks.toLocaleString('pt-BR') : '—',
        empty: !hasMetrics || adMetrics.totalClicks === 0,
        emptyMsg: 'Sem cliques',
      });
    }
  }

  // Slot 4: CAMPAIGN/AD STATUS — always
  kpis.push({
    label: 'Anúncios',
    value: `${data.activeAds}`,
    trend: pausedAds > 0 ? (
      <span style={{ fontSize: 9, color: T.text3, marginTop: 2 }}>{pausedAds} pausado{pausedAds > 1 ? 's' : ''}</span>
    ) : undefined,
  });

  // Ensure exactly one primary
  if (!kpis.some(k => k.primary) && kpis.length > 0) kpis[0].primary = true;

  return (
    <div className="feed-kpi-bar" style={{ marginBottom: 14, fontFamily: F }}>
      {/* Context line */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, padding: '0 2px',
        animation: 'feed-fadeIn 0.3s ease',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.text3 }}>
          {periodLabel ? `Últimos ${periodLabel}` : 'Últimos 7 dias'}
        </span>
        {data.spendPrev > 0 && (
          <span style={{ fontSize: 9.5, color: T.text3 }}>
            vs. período anterior
          </span>
        )}
      </div>

      {/* 2×2 KPI Grid — always symmetrical */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 6,
      }}>
        {kpis.slice(0, 4).map((k, idx) => {
          const isHovered = hovIdx === idx;
          return (
            <div
              key={k.label}
              onMouseEnter={() => setHovIdx(idx)}
              onMouseLeave={() => setHovIdx(null)}
              style={{
                background: isHovered ? T.bg2 : T.bg1,
                borderRadius: 10,
                padding: '14px 12px 12px',
                textAlign: 'center',
                border: `1px solid ${isHovered ? T.border2 : T.border1}`,
                transition: 'all 0.2s ease',
                transform: isHovered ? 'translateY(-1px)' : 'none',
                boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                opacity: k.empty ? 0.55 : 1,
                animation: `feed-fadeUp 0.35s ease ${idx * 0.08}s both`,
                cursor: 'default',
              }}
            >
              {/* Label */}
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: T.labelColor,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
                {k.label}
              </div>

              {/* Value */}
              {k.empty ? (
                <div style={{
                  fontSize: 11, fontWeight: 600, color: T.text3,
                  lineHeight: 1.4, marginTop: 2,
                }}>
                  {k.emptyMsg || 'Dados insuficientes'}
                </div>
              ) : (
                <div style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: T.text1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}>
                  {k.value}
                </div>
              )}

              {/* Trend */}
              {k.trend && !k.empty && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                  {k.trend}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Savings line */}
      {savings > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 10, padding: '6px 10px',
          background: 'rgba(74,222,128,0.04)',
          borderRadius: 6,
          animation: 'feed-fadeIn 0.4s ease 0.3s both',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 4px ${T.green}40`, flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: T.text2, fontWeight: 500 }}>
            Decisões economizaram{' '}
            <span style={{ color: T.text1, fontWeight: 700 }}>
              {fmtReais(savings)}
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

  // ── Fetch user's campaigns ──
  const [userCampaigns, setUserCampaigns] = useState<CampaignSummary[]>([]);

  // ── Fetch aggregate metrics for state detection (respects period) ──
  const [adMetrics, setAdMetrics] = useState<AdMetricsSummary | null>(null);
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0);
  const refreshMetrics = useCallback(() => setMetricsRefreshKey(k => k + 1), []);

  // ── Tracking status — persisted per account (GLOBAL, not per date range) ──
  const [trackingUserStatus, setTrackingUserStatus] = useState<TrackingStatus>(() =>
    accountId ? getTrackingStatus(accountId) : 'unknown'
  );

  // Sync when account changes (NOT on period change — tracking is account-global)
  useEffect(() => {
    if (accountId) setTrackingUserStatus(getTrackingStatus(accountId));
  }, [accountId]);

  // AUTO-RESET: when conversions appear, the "confirmed_no_conversion" is stale → reset
  useEffect(() => {
    if (!accountId || !adMetrics) return;
    if (trackingUserStatus === 'confirmed_no_conversion' && adMetrics.totalConversions > 0) {
      setTrackingStatus(accountId, 'unknown');
      setTrackingUserStatus('unknown');
    }
  }, [accountId, adMetrics, trackingUserStatus]);

  const confirmNoConversion = useCallback(() => {
    if (!accountId) return;
    setTrackingStatus(accountId, 'confirmed_no_conversion');
    setTrackingUserStatus('confirmed_no_conversion');
  }, [accountId]);

  const startTrackingInvestigation = useCallback(() => {
    if (!accountId) return;
    setTrackingStatus(accountId, 'investigating');
    setTrackingUserStatus('investigating');
  }, [accountId]);

  const resetTrackingStatus = useCallback(() => {
    if (!accountId) return;
    setTrackingStatus(accountId, 'unknown');
    setTrackingUserStatus('unknown');
  }, [accountId]);

  // ── Tracking health — fact-based, no assumptions ──
  const trackingHealth = useMemo(() => {
    if (!adMetrics) return null;
    // Suppress tracking card when diagnosis is resolved (any terminal state except investigating)
    if (trackingUserStatus === 'confirmed_no_conversion' || trackingUserStatus === 'verified_ok' || trackingUserStatus === 'verified_issue') return null;

    const spend = adMetrics.totalSpend; // centavos
    const clicks = adMetrics.totalClicks;
    const conversions = adMetrics.totalConversions;

    // Fact: meaningful traffic + zero conversions
    if (spend > 5000 && clicks > 20 && conversions === 0) {
      return {
        status: 'no_conversions' as const,
        clicks,
        spend,
        conversions: 0,
        chatMsg: `Nenhuma conversão registrada\n\n${clicks} cliques · ${fmtReais(spend)} investidos\n\nVamos verificar o rastreamento em alguns passos rápidos.`,
      };
    }
    // Fact: conversions exist but extremely low rate
    if (spend > 10000 && conversions > 0 && clicks > 0 && conversions < clicks * 0.005) {
      const rate = (conversions / clicks * 100).toFixed(2);
      return {
        status: 'low_conversions' as const,
        clicks,
        spend,
        conversions,
        rate,
        chatMsg: `${conversions} conversões em ${clicks} cliques (${rate}%)\n\n${fmtReais(spend)} investidos\n\nVamos verificar se o rastreamento está registrando todas as conversões.`,
      };
    }
    return null;
  }, [adMetrics, trackingUserStatus]);

  // ── Metric Intelligence Engine v2 — adaptive, anti-spam, priority-scored ──
  const [metricEntries, setMetricEntries] = useState<Record<MetricAlertId, MetricStateEntry>>(() => {
    if (!accountId) return {} as Record<MetricAlertId, MetricStateEntry>;
    const map = getMetricStateMap(accountId);
    return (map[period] || {}) as Record<MetricAlertId, MetricStateEntry>;
  });

  // Sync when account or period changes
  useEffect(() => {
    if (accountId) {
      const map = getMetricStateMap(accountId);
      setMetricEntries((map[period] || {}) as Record<MetricAlertId, MetricStateEntry>);
    }
  }, [accountId, period]);

  // Beginner mode flag — shown in JSX when data is too low for analysis
  const beginnerMode = useMemo(() => {
    if (!adMetrics) return false;
    return adMetrics.daysOfData < 3 || adMetrics.totalClicks < 30 || adMetrics.totalSpend < 2000;
  }, [adMetrics]);

  // Detect active metric alerts — filtered by cooldowns + user state
  // INVARIANT RULES 1-4 enforced here as hard gates
  const metricAlerts = useMemo(() => {
    if (!adMetrics || !accountId || beginnerMode) return [];
    const raw = detectMetricAlerts(adMetrics, accountId, goalData?.metric);
    return raw.filter(a => {
      const entry = metricEntries[a.id] || { action: 'unknown' };

      // ── RULE 1: dismissed_alert NEVER appears during cooldown ──
      // Hard gate — even if detectMetricAlerts somehow returns it, it dies here.
      if (entry.action === 'acknowledged') {
        if (isInCooldown(entry, a.id)) return false;
        // Also check history as fallback — belt AND suspenders
        const daysSince = daysSinceLastDismiss(accountId, a.id);
        if (daysSince !== null && daysSince < (COOLDOWN_DAYS[a.id] || 5)) return false;
      }

      // Filter out: investigating (show investigating strip instead)
      if (entry.action === 'investigating') return false;

      return true;
    }).map(a => {
      // RULE 3: historyNote hydrated here (outside pure detection) — reads localStorage
      const d = daysSinceLastDismiss(accountId, a.id);
      return { ...a, historyNote: d !== null ? `Você ignorou isso há ${d} dia${d !== 1 ? 's' : ''}` : undefined };
    });
  }, [adMetrics, accountId, metricEntries, beginnerMode, goalData]);

  // AUTO-RESET metric states — ratio-based (adaptive to account baselines)
  useEffect(() => {
    if (!accountId || !adMetrics) return;
    const map = getMetricStateMap(accountId);
    const rangeMap = map[period] || {};
    let changed = false;

    // CPA no data: conversions appeared → reset
    const cpaNoData = rangeMap['cpa_no_data'];
    if (cpaNoData?.action === 'acknowledged' && adMetrics.totalConversions >= 3) {
      rangeMap['cpa_no_data'] = { action: 'unknown' };
      changed = true;
    }
    // CPA deviation: CPA returned within 10% of baseline → reset
    if (rangeMap['cpa_deviation']?.action === 'acknowledged' && adMetrics.baselineCpa !== null && adMetrics.avgCpa > 0) {
      if (adMetrics.avgCpa / adMetrics.baselineCpa <= 1.1) {
        rangeMap['cpa_deviation'] = { action: 'unknown' };
        changed = true;
      }
    }
    // CTR deviation: CTR recovered within 10% of baseline → reset
    if (rangeMap['ctr_deviation']?.action === 'acknowledged' && adMetrics.baselineCtr !== null && adMetrics.avgCtr > 0) {
      if (adMetrics.avgCtr / adMetrics.baselineCtr >= 0.9) {
        rangeMap['ctr_deviation'] = { action: 'unknown' };
        changed = true;
      }
    }
    // ROAS deviation: ROAS recovered within baseline → reset
    if (rangeMap['roas_deviation']?.action === 'acknowledged' && adMetrics.baselineRoas !== null && adMetrics.avgRoas > 0) {
      if (adMetrics.avgRoas / adMetrics.baselineRoas >= 1.0) {
        rangeMap['roas_deviation'] = { action: 'unknown' };
        changed = true;
      }
    }

    if (changed) {
      map[period] = rangeMap;
      try { localStorage.setItem(`${METRIC_STATE_KEY}_${accountId}`, JSON.stringify(map)); } catch {}
      setMetricEntries({ ...(rangeMap as Record<MetricAlertId, MetricStateEntry>) });
    }
  }, [accountId, period, adMetrics]);

  const acknowledgeMetricAlert = useCallback((alertId: MetricAlertId) => {
    if (!accountId) return;
    const entry: MetricStateEntry = { action: 'acknowledged', dismissedAt: Date.now(), cooldownDays: COOLDOWN_DAYS[alertId] };
    setMetricEntry(accountId, period, alertId, entry);
    setMetricEntries(prev => ({ ...prev, [alertId]: entry }));
    addMetricHistory(accountId, { metric: alertId, action: 'dismissed', date: new Date().toISOString() });
  }, [accountId, period]);

  // RULE 5: Build AI context string — tells AI what user has already decided
  // so AI never contradicts system state (e.g. re-alerting a dismissed metric).
  const buildAiStateContext = useCallback((): string => {
    const lines: string[] = [];
    const allIds: MetricAlertId[] = ['cpa_no_data', 'cpa_deviation', 'ctr_deviation', 'roas_deviation'];
    for (const id of allIds) {
      const entry = metricEntries[id];
      if (!entry || entry.action === 'unknown') continue;
      if (entry.action === 'acknowledged') {
        const inCooldown = isInCooldown(entry, id);
        lines.push(`[${id}]: usuário dispensou${inCooldown ? ' (em cooldown — NÃO re-alertar)' : ''}`);
      } else if (entry.action === 'investigating') {
        lines.push(`[${id}]: em investigação pelo usuário`);
      }
    }
    if (trackingUserStatus !== 'unknown') {
      lines.push(`[tracking]: ${trackingUserStatus}`);
    }
    return lines.length > 0
      ? `\n\n--- Estado atual do sistema ---\n${lines.join('\n')}\nIMPORTANTE: Respeite as decisões do usuário acima. Não re-alerte métricas dispensadas.`
      : '';
  }, [metricEntries, trackingUserStatus]);

  const investigateMetricAlert = useCallback((alert: MetricAlert) => {
    if (!accountId) return;
    const entry: MetricStateEntry = { action: 'investigating' };
    setMetricEntry(accountId, period, alert.id, entry);
    setMetricEntries(prev => ({ ...prev, [alert.id]: entry }));
    addMetricHistory(accountId, { metric: alert.id, action: 'investigating', date: new Date().toISOString() });
    // RULE 5: inject system state context into AI chat via navigation state
    const stateCtx = buildAiStateContext();
    navigate('/dashboard/ai', {
      state: {
        prompt: alert.chatMsg + stateCtx,
      },
    });
  }, [accountId, period, navigate, buildAiStateContext]);

  const resetMetricAlert = useCallback((alertId: MetricAlertId) => {
    if (!accountId) return;
    resetMetricState(accountId, period, alertId);
    setMetricEntries(prev => ({ ...prev, [alertId]: { action: 'unknown' } }));
  }, [accountId, period]);

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

  // ── Campaigns fetch ──
  const fetchCampaigns = useCallback(async () => {
    if (!accountId) { setUserCampaigns([]); return; }
    try {
      const { data } = await (supabase
        .from('campaigns' as any)
        .select('id, name, meta_campaign_id, status, objective, daily_budget')
        .eq('account_id', accountId)
        .order('name') as any);
      setUserCampaigns((data || []) as CampaignSummary[]);
    } catch {
      // noop
    }
  }, [accountId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // ── Unified metrics fetch — live-metrics API (same source as Live Panel) ──
  // Ensures Feed KPIs always match the chat's Live Panel.
  // Falls back to ad_metrics DB table if live-metrics fails.
  // Auto-refreshes every 60s so data stays current.
  const liveMetricsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveMetrics = useCallback(async (silent = false) => {
    if (!userId || !personaId || !accountId) { if (!silent) setAdMetrics(null); return; }
    try {
      const periodKey = period === '30d' ? '30d' : period === '14d' ? '14d' : '7d';
      const { data, error } = await supabase.functions.invoke('live-metrics', {
        body: { user_id: userId, persona_id: personaId, period: periodKey },
      });
      if (error || !data?.ok) throw new Error(error?.message || 'live-metrics failed');

      // Use combined (multi-platform) or meta-specific data
      const m = data.combined || data.meta;
      if (!m || m.error) throw new Error('No platform data');

      // Convert live-metrics format (reais/decimal) → AdMetricsSummary (centavos/basis-points)
      const totalSpend = Math.round((m.spend || 0) * 100);           // reais → centavos
      const totalClicks = Math.round(m.clicks || 0);
      const totalImpressions = Math.round(m.impressions || 0);
      const totalConversions = Math.round(m.conversions || 0);
      const totalRevenue = Math.round((m.conv_value || 0) * 100);    // reais → centavos
      const avgCtr = Math.round((m.ctr || 0) * 10000);               // decimal (0.042) → basis points (420)
      const avgCpa = totalConversions > 0 ? Math.round(totalSpend / totalConversions) : 0;
      const avgRoas = m.roas || (totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0);
      const avgCpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;

      // Daily breakdown for baselines
      const daily = (m.daily || []) as { date: string; spend: number; ctr: number }[];
      const dailyCtrBp = daily.filter(d => d.ctr > 0).map(d => Math.round(d.ctr * 10000));
      const dailyCpaBp = daily.filter(d => d.spend > 0).map(() => avgCpa); // approx — no per-day conversions
      const daysOfData = daily.length || 1;

      setAdMetrics({
        totalSpend,
        totalConversions,
        totalRevenue,
        totalClicks,
        totalImpressions,
        avgCtr,
        avgCpa,
        avgRoas,
        avgCpc,
        daysOfData,
        baselineCtr: robustMedian(dailyCtrBp),
        baselineCpa: avgCpa > 0 ? avgCpa : null,
        baselineRoas: avgRoas > 0 ? avgRoas : null,
        volatilityCtr: coefficientOfVariation(dailyCtrBp),
        volatilityCpa: coefficientOfVariation(dailyCpaBp),
        freshnessFactor: 1, // live data is always fresh
        hasAnchorBaseline: false,
      });
    } catch {
      // Fallback: read from ad_metrics DB table (stale but better than nothing)
      try {
        const since = new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10);
        const { data: mData } = await (supabase
          .from('ad_metrics' as any)
          .select('spend, conversions, revenue, clicks, impressions, ctr, cpa, cpc, roas, date')
          .eq('account_id', accountId)
          .gte('date', since) as any);
        if (!mData || mData.length === 0) { setAdMetrics(null); return; }

        const totalSpend = mData.reduce((s: number, r: any) => s + (r.spend || 0), 0);
        const totalConversions = mData.reduce((s: number, r: any) => s + (r.conversions || 0), 0);
        const totalRevenue = mData.reduce((s: number, r: any) => s + (r.revenue || 0), 0);
        const totalClicks = mData.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
        const totalImpressions = mData.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
        const ctrVals = mData.filter((r: any) => r.ctr != null).map((r: any) => Number(r.ctr));
        const cpaVals = mData.filter((r: any) => r.cpa != null && r.cpa > 0).map((r: any) => Number(r.cpa));
        const uniqueDates = new Set(mData.map((r: any) => r.date));

        setAdMetrics({
          totalSpend,
          totalConversions,
          totalRevenue,
          totalClicks,
          totalImpressions,
          avgCtr: ctrVals.length > 0 ? ctrVals.reduce((a: number, b: number) => a + b, 0) / ctrVals.length : 0,
          avgCpa: cpaVals.length > 0 ? cpaVals.reduce((a: number, b: number) => a + b, 0) / cpaVals.length : 0,
          avgRoas: totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : 0,
          avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          daysOfData: uniqueDates.size,
          baselineCtr: null,
          baselineCpa: null,
          baselineRoas: null,
          volatilityCtr: 0,
          volatilityCpa: 0,
          freshnessFactor: 0,
          hasAnchorBaseline: false,
        });
      } catch { setAdMetrics(null); }
    }
  }, [userId, personaId, accountId, period, periodDays]);

  // Initial fetch + auto-refresh every 60s
  useEffect(() => {
    fetchLiveMetrics();
    liveMetricsInterval.current = setInterval(() => fetchLiveMetrics(true), 60_000);
    return () => { if (liveMetricsInterval.current) clearInterval(liveMetricsInterval.current); };
  }, [fetchLiveMetrics, metricsRefreshKey]);

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

      // Refetch ALL data sources (decisions, ads, live metrics, campaigns)
      await Promise.all([refetchDecisions(), fetchAds(), fetchCampaigns(), fetchLiveMetrics()]);
    } catch (err) {
      console.error('Sync error:', err);
      setSyncError('Falha na conexão. Tente novamente.');
    } finally {
      setSyncing(false);
    }
  }, [accountId, syncing, refetchDecisions, fetchAds, fetchCampaigns, fetchLiveMetrics]);

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
  }, [userId, personaId, metricsRefreshKey]);

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
          .gte('executed_at', monthStart)
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
  const [toggleSuccess, setToggleSuccess] = useState<{ id: string; action: 'pause' | 'activate' } | null>(null);
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
        setToggleSuccess({ id: ad.meta_ad_id, action });
        setTimeout(() => setToggleSuccess(null), 2400);
        fetchAds();
      }
    } catch (e) {
      console.error('Toggle ad error:', e);
    } finally {
      setTogglingAd(null);
      setToggleRequest(null);
    }
  }, [toggleRequest, togglingAd, userId, personaId, fetchAds]);

  // ── Campaign toggle (pause/activate) ──
  const [togglingCampaign, setTogglingCampaign] = useState<string | null>(null);
  const [campaignToggleSuccess, setCampaignToggleSuccess] = useState<{ id: string; action: 'pause' | 'activate' } | null>(null);

  const handleRequestCampaignToggle = useCallback((campaign: CampaignSummary, action: 'pause' | 'activate') => {
    // Direct toggle — no confirmation modal for campaigns (same UX pattern)
    if (togglingCampaign) return;
    setTogglingCampaign(campaign.meta_campaign_id);
    (async () => {
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
            target_id: campaign.meta_campaign_id,
            target_type: 'campaign',
          }),
        });
        if (res.ok) {
          setCampaignToggleSuccess({ id: campaign.meta_campaign_id, action });
          setTimeout(() => setCampaignToggleSuccess(null), 2400);
          fetchCampaigns();
          fetchAds(); // Refresh ads too since campaign status affects them
        }
      } catch (e) {
        console.error('Toggle campaign error:', e);
      } finally {
        setTogglingCampaign(null);
      }
    })();
  }, [togglingCampaign, userId, personaId, fetchCampaigns, fetchAds]);

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
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 14, fontWeight: 800, color: T.text1, fontFamily: F, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>SEU FEED</h1>
          </div>
          <StateNoConnection />
        </div>
      </div>
    );
  }

  // Syncing is now an inline banner — no full-page overlay

  return (
    <div style={{ flex: 1, minHeight: 0, background: '#06080C', padding: 'max(24px, env(safe-area-inset-top, 24px)) 16px 24px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header — wraps on mobile */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <h1 style={{ fontSize: 14, fontWeight: 800, color: T.text1, fontFamily: F, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                DECISÕES
              </h1>
              {isDemo && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: T.text3,
                  background: T.bg2,
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
                  background: T.bg2, color: T.text2,
                  border: 'none', borderRadius: 4,
                  padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bg3; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bg2; }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                    <path d="M14 8A6 6 0 1 1 8 2" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M8 0v4l3-2" stroke={T.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            background: T.bg1, border: `1px solid ${T.border0}`,
            borderRadius: 6, padding: '10px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 16px',
          }}>
            <span style={{ fontSize: 12, color: T.text2, fontFamily: F, lineHeight: 1.5, minWidth: 0 }}>
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
          }} savings={savingsTotal} goalMetric={goalData?.metric} adMetrics={adMetrics} trackingBroken={trackingHealth !== null && trackingUserStatus !== 'confirmed_no_conversion'} periodLabel={PERIODS.find(p => p.key === period)?.label} />
        )}

        {/* ── Tracking Health — full diagnostic card ── */}
        {metaConnected && !isDemo && trackingHealth && (
          <div className="feed-card-lift" style={{
            background: T.bg1,
            border: `1px solid ${T.border1}`,
            borderRadius: 10, padding: 'clamp(14px, 2.5vw, 18px)', marginBottom: 12,
            borderLeft: `3px solid ${T.yellow}`,
            animation: 'feed-fadeUp 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: T.yellow,
                boxShadow: `0 0 8px ${T.yellow}50`,
              }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                color: T.labelColor,
              }}>
                Saúde do rastreamento
              </span>
            </div>

            {/* Primary fact */}
            <p style={{ fontSize: 14, color: T.text1, fontWeight: 700, margin: '0 0 4px', lineHeight: 1.4 }}>
              {trackingHealth.status === 'no_conversions'
                ? 'Nenhuma conversão registrada neste período'
                : `Apenas ${trackingHealth.conversions} conversões em ${trackingHealth.clicks} cliques (${trackingHealth.rate}%)`
              }
            </p>
            <p style={{ fontSize: 12, color: T.text2, margin: '0 0 14px', lineHeight: 1.5 }}>
              {trackingHealth.clicks} cliques · {fmtReais(trackingHealth.spend)} investidos · {adMetrics?.daysOfData || 0} dias de dados
            </p>

            {/* ── Diagnostic checklist — step by step ── */}
            <div style={{
              background: T.bg2, borderRadius: 8,
              padding: '12px 14px', marginBottom: 14,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: T.labelColor, margin: '0 0 10px' }}>
                Checklist de diagnóstico
              </p>
              {[
                {
                  label: 'Pixel Meta instalado no site',
                  detail: 'Verificar se o pixel está presente em todas as páginas',
                  status: trackingHealth.clicks > 0 ? 'ok' : 'warn',
                },
                {
                  label: 'Eventos de conversão configurados',
                  detail: trackingHealth.status === 'no_conversions'
                    ? 'Nenhum evento Purchase/Lead registrado'
                    : `${trackingHealth.conversions} eventos registrados`,
                  status: trackingHealth.status === 'no_conversions' ? 'error' : 'warn',
                },
                {
                  label: 'Conversions API (CAPI) ativa',
                  detail: 'Server-side tracking para maior precisão',
                  status: 'unknown' as const,
                },
                {
                  label: 'Domínio verificado no Business Manager',
                  detail: 'Necessário para eventos web (iOS 14+)',
                  status: 'unknown' as const,
                },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 0',
                  borderTop: i > 0 ? `1px solid ${T.border0}` : 'none',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: item.status === 'ok' ? T.green
                      : item.status === 'error' ? T.red
                      : item.status === 'warn' ? T.yellow
                      : T.text3,
                    boxShadow: item.status === 'error' ? `0 0 6px ${T.red}40` : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: T.text1, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 10.5, color: T.text3, margin: '1px 0 0', lineHeight: 1.4 }}>
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Ambiguity note */}
            <p style={{ fontSize: 11, color: T.text3, margin: '0 0 12px', lineHeight: 1.6, fontStyle: 'italic' }}>
              {trackingHealth.status === 'no_conversions'
                ? 'Não sabemos se realmente não houve vendas ou se o rastreamento falhou. Verifique os itens acima.'
                : 'A taxa de conversão está muito abaixo do esperado. Pode indicar eventos não registrados.'
              }
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmNoConversion}
                style={{
                  flex: 1, background: T.bg2, color: T.text2,
                  border: `1px solid ${T.border1}`,
                  borderRadius: 8, padding: '10px 10px', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bg3; e.currentTarget.style.borderColor = T.text3; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = T.border1; }}
              >
                {trackingHealth.status === 'no_conversions' ? 'Não houve conversões' : 'Taxa está correta'}
              </button>

              <button
                className="feed-cta"
                onClick={() => {
                  startTrackingInvestigation();
                  const msg = trackingHealth.status === 'no_conversions'
                    ? `Minha conta tem ${trackingHealth.clicks} cliques, ${fmtReais(trackingHealth.spend)} investidos e ZERO conversões registradas nos últimos ${adMetrics?.daysOfData || 7} dias. Preciso de ajuda para diagnosticar: 1) O pixel está instalado? 2) Os eventos estão configurados? 3) A CAPI está ativa? 4) O domínio está verificado? Me guie passo a passo.`
                    : `Minha conta tem ${trackingHealth.clicks} cliques e apenas ${trackingHealth.conversions} conversões (${trackingHealth.rate}%) com ${fmtReais(trackingHealth.spend)} investidos. A taxa parece muito baixa. Ajude-me a verificar se o rastreamento está perdendo eventos.`;
                  navigate('/dashboard/ai', {
                    state: { prompt: msg },
                  });
                }}
                style={{
                  flex: 1, background: T.blue, color: T.text1,
                  border: 'none',
                  borderRadius: 8, padding: '10px 10px', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.blueHover; e.currentTarget.style.boxShadow = `0 4px 14px ${T.blue}30`; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.boxShadow = 'none'; }}
              >
                Diagnosticar com IA →
              </button>
            </div>
          </div>
        )}

        {/* Tracking status absorbed into SystemStatus — no separate indicator */}

        {/* Beginner Mode — data still collecting, no alerts */}
        {metaConnected && !isDemo && beginnerMode && adMetrics && adMetrics.daysOfData > 0 && (
          <div style={{
            background: T.bg1, border: `1px solid ${T.border1}`,
            borderRadius: 8, padding: 'clamp(12px, 2.5vw, 16px)', marginBottom: 10,
            animation: 'feed-fadeUp 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: T.blue, opacity: 0.6 }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: T.labelColor }}>
                Coletando dados
              </span>
            </div>
            <p style={{ fontSize: 13, color: T.text1, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.5 }}>
              Dados ainda insuficientes para análise
            </p>
            <p style={{ fontSize: 11.5, color: T.text3, margin: 0, lineHeight: 1.5 }}>
              {adMetrics.daysOfData} dia{adMetrics.daysOfData !== 1 ? 's' : ''} de dados · {adMetrics.totalClicks} cliques · O sistema precisa de mais dados para gerar insights confiáveis.
            </p>
          </div>
        )}

        {/* Silent Mode absorbed into SystemStatus — no separate card */}

        {/* Metric Alerts — adaptive, priority-scored, max 2 */}
        {metaConnected && !isDemo && metricAlerts.length > 0 && metricAlerts.map(alert => (
          <div key={alert.id} className="feed-card-lift" style={{
            background: T.bg1,
            border: `1px solid ${T.border1}`,
            borderRadius: 8, padding: 'clamp(12px, 2.5vw, 16px)', marginBottom: 10,
            borderLeft: `3px solid ${T.blue}`,
            animation: 'feed-fadeUp 0.3s ease',
          }}>
            {/* Header + confidence label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: T.blue, boxShadow: `0 0 6px ${T.blue}50` }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: T.labelColor }}>
                  {alert.label}
                </span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                color: alert.confidenceLabel === 'Alta confiança' ? 'rgba(74,222,128,0.60)'
                  : alert.confidenceLabel === 'Confiança moderada' ? 'rgba(14,165,233,0.50)'
                  : 'rgba(251,191,36,0.50)',
              }}>
                {alert.confidenceLabel}
              </span>
            </div>

            {/* Fact + context */}
            <p style={{ fontSize: 13, color: T.text1, fontWeight: 600, margin: '0 0 4px', lineHeight: 1.5 }}>
              {alert.fact}
            </p>
            <p style={{ fontSize: 11.5, color: T.text2, margin: '0 0 8px', lineHeight: 1.5 }}>
              {alert.context}
            </p>

            {/* Impact estimation */}
            <div style={{
              background: 'rgba(14,165,233,0.06)', borderRadius: 6,
              padding: '8px 12px', marginBottom: 8,
              borderLeft: `2px solid ${T.blue}30`,
            }}>
              <p style={{ fontSize: 11, color: T.text2, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                {alert.impact}
              </p>
            </div>

            {/* Ambiguity */}
            <div style={{ background: T.bg2, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
              <p style={{ fontSize: 10.5, color: T.text3, margin: 0, lineHeight: 1.6 }}>
                {alert.ambiguity}
              </p>
            </div>

            {/* Trust line + history note */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 9.5, color: T.text3, fontWeight: 500 }}>
                {alert.trustLine}
              </span>
              {alert.historyNote && (
                <span style={{ fontSize: 9.5, color: T.text3, fontStyle: 'italic' }}>
                  {alert.historyNote}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => acknowledgeMetricAlert(alert.id)}
                style={{
                  flex: 1, background: T.bg2, color: T.text2,
                  border: `1px solid ${T.border1}`,
                  borderRadius: 6, padding: '9px 10px', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, transition: 'all 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bg1; e.currentTarget.style.borderColor = T.text3; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.bg2; e.currentTarget.style.borderColor = T.border1; }}
              >
                {alert.dismissLabel}
              </button>
              <button
                className="feed-cta"
                onClick={() => investigateMetricAlert(alert)}
                style={{
                  flex: 1, background: T.blue, color: T.text1,
                  border: 'none', borderRadius: 6, padding: '9px 10px', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 700, transition: 'all 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = T.blueHover; e.currentTarget.style.boxShadow = `0 4px 14px ${T.blue}30`; }}
                onMouseLeave={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {alert.investigateLabel}
              </button>
            </div>
          </div>
        ))}

        {/* Metric investigating states — minimal reminders */}
        {metaConnected && !isDemo && (['cpa_no_data', 'cpa_deviation', 'ctr_deviation', 'roas_deviation'] as MetricAlertId[])
          .filter(id => metricEntries[id]?.action === 'investigating')
          .map(id => {
            const labels: Record<MetricAlertId, string> = {
              cpa_no_data: 'CPA — investigando conversões',
              cpa_deviation: 'CPA — investigando custo',
              ctr_deviation: 'CTR — investigando performance',
              roas_deviation: 'ROAS — investigando retorno',
            };
            return (
              <div key={`inv-${id}`} style={{
                background: T.bg1, border: `1px solid ${T.border1}`,
                borderRadius: 8, padding: 'clamp(10px, 2vw, 14px)', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap',
                animation: 'feed-fadeUp 0.3s ease',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: T.blue }}>◉</span>
                  <span style={{ fontSize: 11.5, color: T.text2, fontWeight: 500 }}>{labels[id]}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => navigate('/dashboard/ai')}
                    style={{ background: 'transparent', color: T.blue, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 0', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    Continuar no chat
                  </button>
                  <button
                    onClick={() => resetMetricAlert(id)}
                    style={{ background: 'transparent', color: T.text3, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, padding: '4px 0', transition: 'opacity 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    Resetar
                  </button>
                </div>
              </div>
            );
          })
        }

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
            {!isDemo && <SystemStatus decisions={decisions} tracker={tracker} patternsCount={patternsCount} trackingStatus={trackingUserStatus} hasMetricAlerts={metricAlerts.length > 0} trackingHasIssue={trackingHealth !== null && trackingUserStatus !== 'confirmed_no_conversion'} />}

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
                toggleSuccess={toggleSuccess}
                onRequestToggle={handleRequestToggle}
                onLoadMoreAds={loadMoreAds}
                loadingMoreAds={adsLoadingMore}
                trackingIssue={trackingHealth !== null && trackingUserStatus !== 'confirmed_no_conversion'}
                campaigns={userCampaigns}
                togglingCampaign={togglingCampaign}
                campaignToggleSuccess={campaignToggleSuccess}
                onRequestCampaignToggle={handleRequestCampaignToggle}
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
          <StateNoCritical totalAds={totalAdCount} ads={userAds} periodLabel={PERIODS.find(p => p.key === period)!.label} metaAccountId={metaAccountId} onLoadMoreAds={loadMoreAds} loadingMoreAds={adsLoadingMore} onToggleAd={handleConfirmToggle} togglingAd={togglingAd} toggleSuccess={toggleSuccess} onRequestToggle={handleRequestToggle} campaigns={userCampaigns} togglingCampaign={togglingCampaign} campaignToggleSuccess={campaignToggleSuccess} onRequestCampaignToggle={handleRequestCampaignToggle} />
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
        @keyframes feed-fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes feed-shimmer{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes feed-success{0%{opacity:0;transform:scale(0.9)}40%{opacity:1;transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes feed-btn-press{0%{transform:scale(1)}50%{transform:scale(0.96)}100%{transform:scale(1)}}
        @keyframes modal-overlay-in{from{opacity:0}to{opacity:1}}
        @keyframes modal-card-in{from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes modal-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        @keyframes modal-text-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes modal-text-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        .feed-card-lift{transition:background 0.18s ease,transform 0.18s ease,box-shadow 0.18s ease}
        .feed-card-lift:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.25)}
        .feed-micro-btn button{transition:all 0.15s ease}
        .feed-micro-btn button:active:not(:disabled){animation:feed-btn-press 0.15s ease}
        .feed-cta{transition:all 0.18s ease}
        .feed-cta:hover{box-shadow:0 4px 14px rgba(14,165,233,0.25) !important}
        .feed-cta:active{transform:scale(0.97);transition:transform 0.08s ease}
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
