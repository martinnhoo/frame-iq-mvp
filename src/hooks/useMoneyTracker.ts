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

    const intervalId = window.setInterval(() => {
      fetchTracker();
    }, MONEY_TRACKER_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accountId, fetchTracker]);

  return {
    tracker,
    isLoading,
  };
}
