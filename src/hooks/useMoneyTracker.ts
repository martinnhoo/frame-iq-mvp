import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MoneyTracker } from '../types/v2-database';

const MONEY_TRACKER_POLL_MS = 30000;

interface UseMoneyTrackerReturn {
  tracker: MoneyTracker | null;
  isLoading: boolean;
}

export function useMoneyTracker(accountId: string | null): UseMoneyTrackerReturn {
  const [tracker, setTracker] = useState<MoneyTracker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTracker = useCallback(async () => {
    if (!accountId) {
      setTracker(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await (supabase
        .from('money_tracker' as any)
        .select('*')
        .eq('account_id', accountId)
        .single() as any);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setTracker(data || null);
    } catch (err) {
      console.error('Failed to fetch money tracker:', err);
      setTracker(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchTracker();
  }, [fetchTracker]);

  useEffect(() => {
    if (!accountId) return;

    // Visibility-aware polling — pauses when tab is hidden, resumes
    // with an immediate refetch when the tab regains focus. Matches
    // the useDecisions pattern so the two hooks don't drift.
    let intervalId: number | undefined;
    const start = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => { fetchTracker(); }, MONEY_TRACKER_POLL_MS);
    };
    const stop = () => {
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTracker();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [accountId, fetchTracker]);

  return {
    tracker,
    isLoading,
  };
}
