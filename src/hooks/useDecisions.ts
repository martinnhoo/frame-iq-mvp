import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Decision } from '../types/v2-database';

const DECISIONS_POLL_MS = 30000;

interface UseDecisionsReturn {
  decisions: Decision[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDecisions(accountId: string | null): UseDecisionsReturn {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    if (!accountId) {
      setDecisions([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await (supabase
        .from('decisions' as any)
        .select('*, ad:ads(name, meta_ad_id, ad_set:ad_sets(name, campaign:campaigns(name)))')
        .eq('account_id', accountId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }) as any);

      if (fetchError) throw fetchError;

      setDecisions(sortDecisions((data || []) as Decision[]));
      setError(null);
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch decisions');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  useEffect(() => {
    if (!accountId) return;

    const intervalId = window.setInterval(() => {
      fetchDecisions();
    }, DECISIONS_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accountId, fetchDecisions]);

  return {
    decisions,
    isLoading,
    error,
    refetch: fetchDecisions,
  };
}

function sortDecisions(decisions: Decision[]): Decision[] {
  return [...decisions].sort((a, b) => {
    const decisionTypeOrder: Record<string, number> = {
      kill: 0,
      fix: 1,
      scale: 2,
    };
    const orderA = decisionTypeOrder[(a as any).decision_type || a.type] ?? 999;
    const orderB = decisionTypeOrder[(b as any).decision_type || b.type] ?? 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (b.score || 0) - (a.score || 0);
  });
}
