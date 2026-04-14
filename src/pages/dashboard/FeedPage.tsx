import React from 'react';
import { useOutletContext } from 'react-router-dom';
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
 */
const FeedPage: React.FC = () => {
  const { selectedPersona } = useOutletContext<DashboardContext>();
  const accountId = selectedPersona?.id ?? null;

  const { decisions, isLoading: decisionsLoading } = useDecisions(accountId);
  const { tracker, isLoading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions();

  const isLoading = decisionsLoading || trackerLoading;

  const handleAction = async (decisionId: string, action: DecisionAction) => {
    try {
      await executeAction(decisionId, action.meta_api_action || action.type, 'ad', '');
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 24,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 120, height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 8 }} />
                  <div style={{ width: 80, height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.06)', padding: 24, marginBottom: 16,
            }}>
              <div style={{ width: '75%', height: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 12 }} />
              <div style={{ width: '50%', height: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pendingDecisions = decisions.filter(d => d.status === 'pending');

  return (
    <div style={{ minHeight: '100vh', background: '#060709', padding: 32 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: F, letterSpacing: '-0.02em', margin: 0 }}>
            Copilot Feed
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: '6px 0 0', fontFamily: F }}>
            Decisões em tempo real para proteger e crescer seu investimento
          </p>
        </div>

        {tracker && (
          <div style={{ marginBottom: 24 }}>
            <MoneyBar leaking={tracker.leaking_now} capturable={tracker.capturable_now} totalSaved={tracker.total_saved} />
          </div>
        )}

        {pendingDecisions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingDecisions.map(decision => (
              <DecisionCard key={decision.id} decision={decision} onAction={handleAction} />
            ))}
          </div>
        ) : (
          <EmptyState totalAds={0} nextSyncMinutes={0} todaySummary={{ paused: 0, scaled: 0, savedToday: 0, revenueToday: 0 }} />
        )}
      </div>
    </div>
  );
};

export default FeedPage;
