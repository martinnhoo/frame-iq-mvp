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

        // Normalize action_type for the deployed edge function. The Meta
        // API + AI emit `enable_*` (Meta's standard verb) but the
        // function's switch statement still uses legacy v1 `reactivate_*`
        // names. Map at the call site so we don't depend on an edge
        // function redeploy to unblock the loop. Same idea for budget
        // direction renames if they show up later.
        const ACTION_TYPE_MAP: Record<string, string> = {
          enable_ad: 'reactivate_ad',
          enable_adset: 'reactivate_adset',
          enable_campaign: 'reactivate_campaign',
          budget_increase: 'increase_budget',
          budget_decrease: 'decrease_budget',
        };
        const normalizedActionType = ACTION_TYPE_MAP[actionType] ?? actionType;

        const { data, error } = await supabase.functions.invoke('execute-action', {
          body: {
            decision_id: decisionId,
            action_type: normalizedActionType,
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
