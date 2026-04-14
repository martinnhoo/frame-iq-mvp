import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { DashboardContext } from '@/components/dashboard/DashboardLayout';
import { MoneyBar } from '../../components/feed/MoneyBar';
import { SummaryBar } from '../../components/feed/SummaryBar';
import { DecisionCard } from '../../components/feed/DecisionCard';
import { EmptyState } from '../../components/feed/EmptyState';
import { useDecisions } from '../../hooks/useDecisions';
import { useMoneyTracker } from '../../hooks/useMoneyTracker';
import { useActions } from '../../hooks/useActions';
import type { DecisionAction } from '../../types/v2-database';

const F = "'Plus Jakarta Sans', sans-serif";

/**
 * FeedPage — Copilot Feed: Decision Cards (KILL / FIX / SCALE)
 * Account is resolved at layout level (AppLayout) — Feed just consumes it.
 */
const FeedPage: React.FC = () => {
  const ctx = useOutletContext<DashboardContext & { activeAccount: any; metaConnected: boolean; accountResolving: boolean }>();
  const navigate = useNavigate();

  const { activeAccount, metaConnected, accountResolving } = ctx;

  // Use the v2 ad_accounts UUID for queries
  const accountId = activeAccount?.id ?? null;

  const { decisions, isLoading: decisionsLoading } = useDecisions(accountId);
  const { tracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  const isLoading = accountResolving || (accountId ? (decisionsLoading || trackerLoading) : false);

  const handleAction = async (decisionId: string, action: DecisionAction) => {
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
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 24,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ width: 120, height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ width: 80, height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 16,
            }}>
              <div style={{ width: '40%', height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 12 }} />
              <div style={{ width: '75%', height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 8 }} />
              <div style={{ width: '50%', height: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── No Meta connection — nudge to connect (not blocking) ──
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

        {/* Money tracker */}
        {tracker && (
          <div style={{ marginBottom: 24 }}>
            <MoneyBar
              leaking={tracker.leaking_now}
              capturable={tracker.capturable_now}
              totalSaved={tracker.total_saved}
              onStopLosses={hasKills ? handleStopLosses : undefined}
            />
          </div>
        )}

        {/* Summary pills */}
        {pendingDecisions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Decision cards or empty state */}
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
