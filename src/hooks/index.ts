import { useState, useEffect } from 'react';
import type { Decision, MoneyTracker, DecisionAction } from '../types/database';

// Hook to fetch decisions (pending, acted, dismissed)
export function useDecisions(accountId?: string) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchDecisions = async () => {
      try {
        setLoading(true);
        // const response = await fetch(`/api/decisions?accountId=${accountId}`);
        // const data = await response.json();
        // setDecisions(data);
        setDecisions([]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch decisions'));
      } finally {
        setLoading(false);
      }
    };

    fetchDecisions();
  }, [accountId]);

  return { decisions, loading, error };
}

// Hook to fetch money tracker stats
export function useMoneyTracker(accountId?: string) {
  const [tracker, setTracker] = useState<MoneyTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // TODO: Replace with actual API call
    const fetchTracker = async () => {
      try {
        setLoading(true);
        // const response = await fetch(`/api/money-tracker?accountId=${accountId}`);
        // const data = await response.json();
        // setTracker(data);
        setTracker({
          id: '1',
          account_id: accountId || '',
          total_saved: 423000,
          total_revenue_captured: 0,
          total_actions_taken: 0,
          saved_today: 0,
          revenue_today: 0,
          leaking_now: 124000,
          capturable_now: 89000,
          active_days_streak: 0,
          last_active_date: null,
          longest_streak: 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch tracker'));
      } finally {
        setLoading(false);
      }
    };

    fetchTracker();
  }, [accountId]);

  return { tracker, loading, error };
}

// Hook to execute actions on decisions
export function useActions(accountId?: string) {
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeAction = async (decisionId: string, action: DecisionAction) => {
    try {
      setExecuting(true);
      setError(null);
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/actions`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     decision_id: decisionId,
      //     action_id: action.id,
      //     account_id: accountId,
      //   }),
      // });
      // if (!response.ok) throw new Error('Action failed');
      // return await response.json();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to execute action');
      setError(error);
      throw error;
    } finally {
      setExecuting(false);
    }
  };

  return { executeAction, executing, error };
}
