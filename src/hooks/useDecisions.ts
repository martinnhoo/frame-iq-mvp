import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Decision } from '../types/v2-database';

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
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await (supabase
        .from('decisions' as any)
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }) as any);

      if (fetchError) throw fetchError;

      // Sort: kill first (by score desc), then fix, then scale
      const sorted = (data || []).sort((a, b) => {
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

        // Within same type, sort by score descending
        return (b.score || 0) - (a.score || 0);
      });

      setDecisions(sorted);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch decisions');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // Initial fetch
  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Subscribe to Realtime updates
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`decisions:${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'decisions',
          filter: `account_id=eq.${accountId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDecision = payload.new as Decision;
            if (newDecision.status === 'pending') {
              // Alert on new KILL with score > 80
              if (((newDecision as any).decision_type || newDecision.type) === 'kill' && (newDecision.score || 0) > 80) {
                console.log(
                  `[ALERT] New high-score KILL decision: ${(newDecision as any).name || newDecision.headline} (score: ${newDecision.score})`
                );
              }
              setDecisions((prev) => {
                const updated = [...prev, newDecision];
                return sortDecisions(updated);
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Decision;
            setDecisions((prev) => {
              const idx = prev.findIndex((d) => d.id === updated.id);
              if (idx >= 0) {
                const newList = [...prev];
                newList[idx] = updated;
                return sortDecisions(newList);
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Decision;
            setDecisions((prev) => prev.filter((d) => d.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId]);

  return {
    decisions,
    isLoading,
    error,
    refetch: fetchDecisions,
  };
}

function sortDecisions(decisions: Decision[]): Decision[] {
  return decisions.sort((a, b) => {
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
