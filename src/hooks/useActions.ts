import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExecuteActionParams {
  decisionId: string;
  actionType: string;
  targetType: string;
  targetMetaId: string;
  params?: Record<string, unknown>;
}

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface UseActionsReturn {
  executeAction: (
    decisionId: string,
    actionType: string,
    targetType: string,
    targetMetaId: string,
    params?: Record<string, unknown>
  ) => Promise<ActionResult>;
  isExecuting: boolean;
  lastResult: ActionResult | null;
}

export function useActions(): UseActionsReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const executeAction = useCallback(
    async (
      decisionId: string,
      actionType: string,
      targetType: string,
      targetMetaId: string,
      params?: Record<string, unknown>
    ): Promise<ActionResult> => {
      try {
        setIsExecuting(true);

        // No more frontend mapping or backfill — the edge function
        // `execute-action` now (a) normalizes enable_* → reactivate_*
        // up front for its own switch + action_log CHECK constraint,
        // and (b) writes action_outcomes natively for both enable_*
        // and reactivate_* action types. Frontend just sends the
        // canonical action_type as-is.
        const { data, error } = await supabase.functions.invoke('execute-action', {
          body: {
            decision_id: decisionId,
            action_type: actionType,
            target_type: targetType,
            target_meta_id: targetMetaId,
            params,
          },
        });

        if (error) {
          const result: ActionResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          setLastResult(result);
          return result;
        }

        const result: ActionResult = {
          success: true,
          data,
        };
        setLastResult(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to execute action';
        const result: ActionResult = {
          success: false,
          error: errorMessage,
        };
        setLastResult(result);
        return result;
      } finally {
        setIsExecuting(false);
      }
    },
    []
  );

  return {
    executeAction,
    isExecuting,
    lastResult,
  };
}
