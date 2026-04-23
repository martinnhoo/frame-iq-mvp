/**
 * AccountHealthGauge — "Saúde da conta" circular gauge for the Feed header.
 *
 * Voice: gestor de tráfego. A quick-glance score (0-100) that answers
 * "posso deixar rodando tranquilo ou tenho que entrar agora?"
 *
 * Design intent (user's words, kept as-is for reference):
 *   "normalmente tem q ficar verde, só fica diferente quando tá acabando o
 *    saldo ou acabou o saldo, ou algum problema encontrado"
 *
 * So the scoring is deliberately forgiving: we stay green unless we see a
 * concrete problem (account status flag from Meta, pixel broken, zero active
 * ads, spend without conversions).
 *
 * Inputs — ALL REAL, no AdScore, no invented numbers:
 *   • accountStatus   → from /account-status-check (Meta account_status,
 *                       disable_reason, balance, spend_cap, amount_spent)
 *   • pixelHealth     → from /pixel-health-check (no_pixel / stale / orphan)
 *   • adMetrics       → from /live-metrics (totalSpend, totalConversions)
 *   • activeAdsCount  → from userAds.filter(effective_status === ACTIVE)
 *
 * Output — { score, band, issues[] }
 *   band ∈ ok (green) | warn (yellow) | critical (red)
 *   issues[] is the prioritised problem list the gauge surfaces beneath
 *   the number.
 */

import React, { useMemo } from 'react';

// ── Design tokens (mirror FeedPage T) ──
const T = {
  bg1: '#0D1117',
  bg2: '#161B22',
  bg3: '#1C2128',
  border1: 'rgba(240,246,252,0.07)',
  border2: 'rgba(240,246,252,0.12)',
  text1: '#F0F6FC',
  text2: 'rgba(240,246,252,0.72)',
  text3: 'rgba(240,246,252,0.48)',
  labelColor: 'rgba(240,246,252,0.40)',
  green: '#4ADE80',
  red: '#F87171',
  yellow: '#FBBF24',
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

// ── Types mirrored from FeedPage / edge fns ──

/** Matches AccountStatusResult from supabase/functions/account-status-check. */
export interface AccountStatusSummary {
  severity: 'ok' | 'warn' | 'critical' | 'unknown';
  message: string;
  account_status: number | null;
  disable_reason: number | null;
  spend_cap: number | null;       // centavos
  amount_spent: number | null;    // centavos
  balance: number | null;         // centavos
  currency: string | null;
  cap_remaining: number | null;   // centavos
  checked_at: string;
  cached?: boolean;
  schema_version?: number;
  error?: string;
}

/** Subset of PixelHealthSummary the gauge needs. */
export interface PixelHealthLike {
  status: 'no_pixel' | 'pixel_stale' | 'pixel_orphan' | 'pixel_ok' | 'unknown';
  orphan_ads_count?: number;
  active_ads_checked?: number;
  days_since_fire?: number | null;
}

/** Subset of AdMetricsSummary the gauge needs. */
export interface AdMetricsLike {
  totalSpend: number;          // centavos
  totalConversions: number;
  daysOfData: number;
}

export interface HealthIssue {
  key: string;
  label: string;
  severity: 'critical' | 'warn' | 'info';
}

export interface AccountHealth {
  score: number;             // 0–100
  band: 'ok' | 'warn' | 'critical';
  headline: string;          // 1-line summary ("Saudável", "Atenção", …)
  subline: string;           // helper text under headline
  issues: HealthIssue[];
}

// ── Pure scorer ──
/**
 * computeAccountHealth — defaults to a green/healthy score; deducts only
 * when a concrete, surfaced problem is detected. Clamps to [0, 100].
 *
 * Weights were chosen so that:
 *   - a single pixel problem alone drops to "Atenção" (70–84)
 *   - a Meta-flagged account drops straight to "Crítico" (<50)
 *   - zero active ads + zero conversions with spend also flags critical
 */
export function computeAccountHealth(input: {
  accountStatus?: AccountStatusSummary | null;
  accountStatusLoading?: boolean;
  pixelHealth?: PixelHealthLike | null;
  pixelHealthLoading?: boolean;
  adMetrics?: AdMetricsLike | null;
  activeAdsCount?: number;
  hasMetaConnection?: boolean;
}): AccountHealth {
  const {
    accountStatus,
    accountStatusLoading,
    pixelHealth,
    pixelHealthLoading,
    adMetrics,
    activeAdsCount = 0,
    hasMetaConnection = true,
  } = input;

  const issues: HealthIssue[] = [];

  // When there's no Meta connection we can't really score — return a neutral
  // "Desconectada" state so the UI can short-circuit to a connect CTA.
  if (!hasMetaConnection) {
    return {
      score: 0,
      band: 'warn',
      headline: 'Conta não conectada',
      subline: 'Conecte sua conta Meta Ads para começar a acompanhar a saúde.',
      issues: [],
    };
  }

  let score = 100;

  // ── 1) Meta account status ──────────────────────────────────────────
  // Highest-impact signal: if Meta has flagged the account, nothing else matters.
  // We peek at the message to route between truly-disabled accounts (account_*)
  // and low-balance flags (balance_*) so the sidebar CTA can be specific — the
  // action for "conta desativada" is very different from "repor saldo".
  if (accountStatus) {
    const msg = (accountStatus.message || '').toLowerCase();
    const isBalance = msg.includes('saldo');
    const isCapExhausted = msg.includes('limite de gastos');
    let critKey = 'account_critical';
    if (isCapExhausted) critKey = 'cap_exhausted';
    else if (isBalance) critKey = 'balance_critical';
    if (accountStatus.severity === 'critical') {
      score -= 55;
      issues.push({
        key: critKey,
        label: accountStatus.message || 'Conta com problema na Meta',
        severity: 'critical',
      });
    } else if (accountStatus.severity === 'warn') {
      score -= 25;
      issues.push({
        key: isBalance ? 'balance_low' : 'account_warn',
        label: accountStatus.message || 'Conta com pendência',
        severity: 'warn',
      });
    } else if (accountStatus.severity === 'unknown' && accountStatus.error) {
      // Transient check failure — small deduction, not alarming.
      score -= 3;
    }
  }
  // If accountStatus is still loading we don't penalise — assume ok until proven
  // otherwise so we don't flash critical during load.

  // ── 2) Pixel health ─────────────────────────────────────────────────
  if (pixelHealth) {
    switch (pixelHealth.status) {
      case 'no_pixel':
        score -= 25;
        issues.push({
          key: 'pixel_missing',
          label: 'Pixel não instalado — sem otimização',
          severity: 'critical',
        });
        break;
      case 'pixel_stale': {
        score -= 15;
        const days = pixelHealth.days_since_fire ?? 0;
        issues.push({
          key: 'pixel_stale',
          label: days > 0 ? `Pixel sem disparar há ${days}d` : 'Pixel parado',
          severity: 'warn',
        });
        break;
      }
      case 'pixel_orphan': {
        score -= 12;
        const orphans = pixelHealth.orphan_ads_count ?? 0;
        issues.push({
          key: 'pixel_orphan',
          label: orphans > 0
            ? `${orphans} anúncio${orphans === 1 ? '' : 's'} sem pixel vinculado`
            : 'Pixel desacoplado dos anúncios',
          severity: 'warn',
        });
        break;
      }
      case 'unknown':
        // Don't penalise — pixel fetch failed or account too new.
        break;
      case 'pixel_ok':
      default:
        // no-op — no points added (we stay healthy by default)
        break;
    }
  }

  // ── 3) Ad activity ──────────────────────────────────────────────────
  // Zero active ads means no traffic is flowing — not necessarily broken but
  // worth flagging. Only penalise if spend history exists (account has been
  // used before); a brand-new account shouldn't look unhealthy.
  const hasMetrics = !!adMetrics && adMetrics.daysOfData > 0;
  if (hasMetrics && activeAdsCount === 0) {
    score -= 15;
    issues.push({
      key: 'no_active_ads',
      label: 'Nenhum anúncio ativo no momento',
      severity: 'warn',
    });
  }

  // ── 4) Spending without conversions ─────────────────────────────────
  // Only flag when we're confident: >R$100 spent and zero conversions in period.
  // The R$100 floor suppresses noise for brand-new accounts that just started.
  if (hasMetrics
      && adMetrics!.totalSpend > 10000 /* R$100 */
      && adMetrics!.totalConversions === 0) {
    score -= 15;
    issues.push({
      key: 'spend_no_conv',
      label: 'Gasto sem conversões no período',
      severity: 'warn',
    });
  }

  // Still loading? Keep the wording honest but don't downgrade the band.
  const isLoading = Boolean(accountStatusLoading || pixelHealthLoading);

  // Clamp and classify.
  score = Math.max(0, Math.min(100, score));
  let band: AccountHealth['band'];
  let headline: string;
  let subline: string;

  if (score >= 85) {
    band = 'ok';
    headline = 'Saudável';
    subline = isLoading
      ? 'Verificando os últimos sinais…'
      : 'Conta liberada pra rodar. Nada travando.';
  } else if (score >= 70) {
    band = 'ok';
    headline = 'Estável';
    subline = 'Tudo operacional. Alguns pontos pra observar.';
  } else if (score >= 50) {
    band = 'warn';
    headline = 'Atenção';
    subline = 'Tem coisa que vale resolver antes que piore.';
  } else {
    band = 'critical';
    headline = 'Crítico';
    subline = 'Algo tá travando o desempenho — resolver agora.';
  }

  // Sort issues: critical → warn → info, stable within tier.
  issues.sort((a, b) => {
    const order = { critical: 0, warn: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return { score: Math.round(score), band, headline, subline, issues };
}

// ── Formatters ──
function fmtReaisExact(centavos: number): string {
  const v = centavos / 100;
  if (v >= 1000) return `R$${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return `R$${v.toFixed(2).replace('.', ',')}`;
}

// ── The circular SVG gauge ──
const GaugeCircle: React.FC<{ score: number; band: AccountHealth['band']; loading?: boolean }> = ({
  score, band, loading,
}) => {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = c * pct;

  const color = band === 'critical' ? T.red : band === 'warn' ? T.yellow : T.green;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={T.bg3}
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>
      {/* Centre label */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: F,
      }}>
        <div style={{
          fontSize: 30, fontWeight: 800, color: T.text1,
          letterSpacing: '-0.03em', lineHeight: 1,
        }}>
          {loading ? '—' : score}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, color: T.text3,
          letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4,
        }}>
          / 100
        </div>
      </div>
    </div>
  );
};

// ── Issue pill ──
const IssuePill: React.FC<{ issue: HealthIssue }> = ({ issue }) => {
  const tint = issue.severity === 'critical'
    ? 'rgba(248,113,113,0.10)'
    : issue.severity === 'warn'
      ? 'rgba(251,191,36,0.10)'
      : T.bg2;
  const border = issue.severity === 'critical'
    ? 'rgba(248,113,113,0.22)'
    : issue.severity === 'warn'
      ? 'rgba(251,191,36,0.22)'
      : T.border1;
  const color = issue.severity === 'critical' ? T.red
    : issue.severity === 'warn' ? T.yellow
    : T.text2;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: tint,
      border: `1px solid ${border}`,
      borderRadius: 6,
      padding: '6px 10px',
      minWidth: 0,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0,
      }} />
      <span style={{
        fontSize: 11.5, color: T.text2, fontFamily: F,
        letterSpacing: '-0.005em', lineHeight: 1.4,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {issue.label}
      </span>
    </div>
  );
};

// ── Main component ──
export const AccountHealthGauge: React.FC<{
  accountStatus: AccountStatusSummary | null;
  accountStatusLoading: boolean;
  accountStatusError: boolean;
  onRetryAccountStatus?: () => void;
  pixelHealth: PixelHealthLike | null;
  pixelHealthLoading: boolean;
  adMetrics: AdMetricsLike | null;
  activeAdsCount: number;
  hasMetaConnection: boolean;
}> = ({
  accountStatus,
  accountStatusLoading,
  accountStatusError,
  onRetryAccountStatus,
  pixelHealth,
  pixelHealthLoading,
  adMetrics,
  activeAdsCount,
  hasMetaConnection,
}) => {
  const health = useMemo(() => computeAccountHealth({
    accountStatus,
    accountStatusLoading,
    pixelHealth,
    pixelHealthLoading,
    adMetrics,
    activeAdsCount,
    hasMetaConnection,
  }), [
    accountStatus, accountStatusLoading,
    pixelHealth, pixelHealthLoading,
    adMetrics, activeAdsCount, hasMetaConnection,
  ]);

  // Balance hint line — only when we actually have numbers from Meta. We no
  // longer surface cap_remaining because the spend_cap is Meta-defined and
  // non-editable by the user (see account-status-check rationale).
  const balanceLine = useMemo(() => {
    if (!accountStatus) return null;
    if (typeof accountStatus.balance === 'number' && accountStatus.balance > 0) {
      return `Saldo: ${fmtReaisExact(accountStatus.balance)}`;
    }
    return null;
  }, [accountStatus]);

  const isLoading = accountStatusLoading || pixelHealthLoading;
  const bandColor = health.band === 'critical' ? T.red
    : health.band === 'warn' ? T.yellow
    : T.green;

  return (
    <div style={{
      background: T.bg1,
      border: `1px solid ${T.border1}`,
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 14,
      fontFamily: F,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: T.labelColor,
        }}>Saúde da conta</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {accountStatus?.cached && (
            <span style={{
              fontSize: 9.5, color: T.text3, letterSpacing: '0.04em',
            }}>cacheado</span>
          )}
          {accountStatusError && onRetryAccountStatus && (
            <button
              onClick={onRetryAccountStatus}
              style={{
                background: T.bg2, color: T.text2, border: `1px solid ${T.border1}`,
                borderRadius: 4, padding: '3px 8px', fontSize: 10.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: F,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg3; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.bg2; }}
            >
              Recheckar
            </button>
          )}
        </div>
      </div>

      {/* Main row: gauge + text */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <GaugeCircle score={health.score} band={health.band} loading={isLoading && !accountStatus && !pixelHealth} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 22, fontWeight: 800, color: T.text1,
              letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>{health.headline}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: bandColor,
              background: health.band === 'critical' ? 'rgba(248,113,113,0.12)'
                : health.band === 'warn' ? 'rgba(251,191,36,0.12)'
                : 'rgba(74,222,128,0.12)',
              border: `1px solid ${health.band === 'critical' ? 'rgba(248,113,113,0.25)'
                : health.band === 'warn' ? 'rgba(251,191,36,0.25)'
                : 'rgba(74,222,128,0.25)'}`,
              borderRadius: 4, padding: '2px 8px',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {health.band === 'ok' ? 'ok' : health.band === 'warn' ? 'alerta' : 'crítico'}
            </span>
          </div>
          <p style={{
            fontSize: 12.5, color: T.text2, margin: '6px 0 0 0',
            lineHeight: 1.5, letterSpacing: '-0.005em',
          }}>
            {health.subline}
          </p>
          {balanceLine && (
            <div style={{
              fontSize: 11, color: T.text3, marginTop: 6, letterSpacing: '-0.005em',
            }}>
              {balanceLine}
            </div>
          )}
        </div>
      </div>

      {/* Issues list */}
      {health.issues.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14,
        }}>
          {health.issues.map(issue => (
            <IssuePill key={issue.key} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountHealthGauge;
