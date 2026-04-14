'use client';

import React from 'react';
import { MoneyBar } from '../components/feed/MoneyBar';
import { SummaryBar } from '../components/feed/SummaryBar';
import { DecisionCard } from '../components/feed/DecisionCard';
import { EmptyState } from '../components/feed/EmptyState';
import { useDecisions, useMoneyTracker, useActions } from '../hooks';
import type { DecisionAction } from '../types/database';

interface FeedPageProps {
  accountId?: string;
}

/**
 * FeedPage - Main page composing all feed components
 * 1. MoneyBar at top
 * 2. SummaryBar with decision counts
 * 3. DecisionCard list or EmptyState
 * 4. Loading skeleton during fetch
 */
export const FeedPage: React.FC<FeedPageProps> = ({ accountId }) => {
  const { decisions, loading: decisionsLoading } = useDecisions(accountId);
  const { tracker, loading: trackerLoading } = useMoneyTracker(accountId);
  const { executeAction } = useActions(accountId);

  const isLoading = decisionsLoading || trackerLoading;

  const handleDecisionAction = async (
    decisionId: string,
    action: DecisionAction
  ) => {
    try {
      await executeAction(decisionId, action);
      // Optionally: refetch decisions or show success toast
    } catch (error) {
      console.error('Failed to execute action:', error);
      // Optionally: show error toast
    }
  };

  // Skeleton loader for initial loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] p-6">
        <div className="max-w-4xl mx-auto">
          {/* Money Bar Skeleton */}
          <div className="w-full bg-[#111827] rounded-2xl border border-sky-500/10 p-6 mb-6 animate-pulse">
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-32 h-12 bg-gray-700/50 rounded-lg mb-2" />
                  <div className="w-20 h-4 bg-gray-700/50 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Decision Card Skeleton */}
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-full bg-[#111827] rounded-2xl border border-sky-500/10 p-6 mb-4 animate-pulse"
            >
              <div className="space-y-4">
                <div className="w-3/4 h-6 bg-gray-700/50 rounded" />
                <div className="w-1/2 h-4 bg-gray-700/50 rounded" />
                <div className="flex gap-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="w-24 h-8 bg-gray-700/50 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pendingDecisions = decisions.filter(
    (d) => d.status === 'pending'
  );

  return (
    <div className="min-h-screen bg-[#0a0e17] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Money Bar */}
        {tracker && (
          <div className="mb-6">
            <MoneyBar
              leaking={tracker.leaking_now}
              capturable={tracker.capturable_now}
              totalSaved={tracker.total_saved}
            />
          </div>
        )}

        {/* Summary Bar */}
        {pendingDecisions.length > 0 && (
          <div className="mb-6">
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Decisions or Empty State */}
        {pendingDecisions.length > 0 ? (
          <div className="space-y-4">
            {pendingDecisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                onAction={handleDecisionAction}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            totalAds={12} // TODO: Get from tracker or separate query
            nextSyncMinutes={28} // TODO: Calculate from last sync
            todaySummary={{
              paused: 2,
              scaled: 1,
              savedToday: 83000, // centavos = R$830
              revenueToday: 34000, // centavos = R$340
            }}
          />
        )}
      </div>
    </div>
  );
};
