import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MoneyTracker } from '../types/database';

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
      const { data, error } = await supabase
        .from('money_tracker')
        .select('*')
        .eq('account_id', accountId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
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

  // Initial fetch
  useEffect(() => {
    fetchTracker();
  }, [fetchTracker]);

  // Subscribe to Realtime updates
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`money_tracker:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'money_tracker',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setTracker(payload.new as MoneyTracker);
          } else if (payload.eventType === 'INSERT') {
            setTracker(payload.new as MoneyTracker);
          } else if (payload.eventType === 'DELETE') {
            setTracker(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId]);

  return {
    tracker,
    isLoading,
  };
}
