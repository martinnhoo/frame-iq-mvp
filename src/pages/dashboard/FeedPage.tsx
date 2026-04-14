import React, { useEffect, useState } from 'react';
import { MoneyBar } from '../../components/feed/MoneyBar';
import { SummaryBar } from '../../components/feed/SummaryBar';
import { DecisionCard } from '../../components/feed/DecisionCard';
import { EmptyState } from '../../components/feed/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import type { Decision, DecisionAction, MoneyTracker } from '../../types/v2-database';

const F = "'Plus Jakarta Sans', sans-serif";

/**
 * FeedPage — Copilot Feed: Decision Cards (KILL / FIX / SCALE)
 * Self-contained: fetches its own data from Supabase.
 */
const FeedPage: React.FC = () => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [tracker, setTracker] = useState<MoneyTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch decisions
  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch decisions for user's accounts
        const { data: accounts } = await (supabase as any)
          .from('ad_accounts')
          .select('id')
          .eq('user_id', userId);

        const accountIds = (accounts || []).map((a: any) => a.id);

        if (accountIds.length > 0) {
          const { data: dec } = await (supabase as any)
            .from('decisions')
            .select('*')
            .in('account_id', accountIds)
            .eq('status', 'pending')
            .order('score', { ascending: false });

          // Sort: kill first, then fix, then scale
          const sorted = (dec || []).sort((a: any, b: any) => {
            const order: Record<string, number> = { kill: 0, fix: 1, scale: 2 };
            const oa = order[a.type] ?? 9;
            const ob = order[b.type] ?? 9;
            return oa !== ob ? oa - ob : (b.score || 0) - (a.score || 0);
          });
          setDecisions(sorted);

          // Fetch money tracker
          const { data: mt } = await (supabase as any)
            .from('money_tracker')
            .select('*')
            .in('account_id', accountIds)
            .limit(1)
            .single();

          setTracker(mt || null);
        }
      } catch (err) {
        console.error('[FeedPage] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleAction = async (_decisionId: string, action: DecisionAction) => {
    try {
      await supabase.functions.invoke('execute-action', {
        body: {
          decisionId: _decisionId,
          actionType: action.meta_api_action || action.type,
          targetType: 'ad',
          targetMetaId: '',
        },
      });
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  // Skeleton
  if (loading) {
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
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: '#fff',
            fontFamily: F, letterSpacing: '-0.02em', margin: 0,
          }}>
            Copilot Feed
          </h1>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: '6px 0 0',
            fontFamily: F,
          }}>
            Decisões em tempo real para proteger e crescer seu investimento
          </p>
        </div>

        {/* Money Bar */}
        {tracker && (
          <div style={{ marginBottom: 24 }}>
            <MoneyBar
              leaking={tracker.leaking_now}
              capturable={tracker.capturable_now}
              totalSaved={tracker.total_saved}
            />
          </div>
        )}

        {/* Summary Bar */}
        {pendingDecisions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SummaryBar decisions={pendingDecisions} />
          </div>
        )}

        {/* Decisions or Empty State */}
        {pendingDecisions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingDecisions.map(decision => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                onAction={handleAction}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            totalAds={0}
            nextSyncMinutes={0}
            todaySummary={{ paused: 0, scaled: 0, savedToday: 0, revenueToday: 0 }}
          />
        )}
      </div>
    </div>
  );
};

export default FeedPage;
