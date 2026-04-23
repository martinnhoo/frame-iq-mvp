import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Decision } from '../types/v2-database';

const DECISIONS_POLL_MS = 30000;
/** Hard cap on pending decisions per fetch. A normal account rarely
 *  has > 50 pending; this only bites a heavy user with 500+ queued
 *  items. Above the cap we truncate (priority-sorted) and surface a
 *  flag so the UI can show a "+N a mais" indicator. */
const DECISIONS_HARD_CAP = 500;

interface UseDecisionsReturn {
  decisions: Decision[];
  isLoading: boolean;
  error: string | null;
  /** True when the server had more pending rows than DECISIONS_HARD_CAP
   *  and we truncated. The UI can show a badge like "mostrando top 500". */
  truncated: boolean;
  refetch: () => Promise<void>;
}

export function useDecisions(accountId: string | null): UseDecisionsReturn {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    if (!accountId) {
      setDecisions([]);
      setTruncated(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      // Capped fetch — priority-sorted on the server, cap applied so
      // big accounts don't pull 5MB JSON payloads. `count: 'exact'`
      // lets us compute the truncation flag without a second query.
      const { data, error: fetchError, count } = await (supabase
        .from('decisions' as any)
        .select('*, ad:ads(name, meta_ad_id, ad_set:ad_sets(name, campaign:campaigns(name)))', { count: 'exact' })
        .eq('account_id', accountId)
        .eq('status', 'pending')
        .order('priority_rank', { ascending: true })
        .order('score', { ascending: false })
        .limit(DECISIONS_HARD_CAP) as any);

      if (fetchError) throw fetchError;

      setDecisions(sortDecisions((data || []) as Decision[]));
      setTruncated(typeof count === 'number' && count > DECISIONS_HARD_CAP);
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

    // Poll only when the tab is VISIBLE. A background tab shouldn't
    // keep hammering Supabase every 30s — doubles DB load for users
    // that forget the tab open. When the user returns, we fetch
    // immediately on `visibilitychange` so the feed is fresh.
    let intervalId: number | undefined;
    const start = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => { fetchDecisions(); }, DECISIONS_POLL_MS);
    };
    const stop = () => {
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDecisions();
        start();
      } else {
        stop();
      }
    };
    // Kick off in whatever state the tab is currently in.
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [accountId, fetchDecisions]);

  return {
    decisions,
    isLoading,
    error,
    truncated,
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
