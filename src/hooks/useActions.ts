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

        // ── Backfill action_outcomes from frontend ──────────────────────
        // The deployed execute-action's ACTION_TYPE_MAP only knows
        // `enable_*` keys, but we send `reactivate_*` (per the switch
        // statement above). So when execute-action tries to write the
        // action_outcomes row, it falls through and SKIPS the insert.
        // Result: action_log fills, action_outcomes empty, 24h/72h cron
        // never measures, replay engine has no training data.
        //
        // Workaround until the edge function is redeployable: write the
        // action_outcomes row from the frontend after execute-action
        // returns success. Uses the canonical action_type_enum values
        // (enable_*, not reactivate_*). RLS on action_outcomes lets
        // authenticated users insert their own rows.
        const OUTCOME_TYPE_MAP: Record<string, string> = {
          // Map BOTH the original (enable_*) and the normalized
          // (reactivate_*) into the canonical action_outcomes_enum.
          enable_ad: 'enable_ad',         enable_adset: 'enable_adset',     enable_campaign: 'enable_campaign',
          reactivate_ad: 'enable_ad',     reactivate_adset: 'enable_adset', reactivate_campaign: 'enable_campaign',
          pause_ad: 'pause_ad',           pause_adset: 'pause_adset',       pause_campaign: 'pause_campaign',
          increase_budget: 'budget_increase', budget_increase: 'budget_increase',
          decrease_budget: 'budget_decrease', budget_decrease: 'budget_decrease',
          duplicate_ad: 'duplicate_ad',
        };
        const outcomeType = OUTCOME_TYPE_MAP[actionType] || OUTCOME_TYPE_MAP[normalizedActionType];
        if (outcomeType) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              const targetLevel = targetType === 'campaign' || targetType === 'adset' ? targetType : 'ad';
              // Pull source from the persisted decision so cron + replay
              // can attribute outcomes to chat vs feed.
              const { data: decisionRow } = await (supabase as any)
                .from('decisions')
                .select('source, headline, metrics, impact_daily')
                .eq('id', decisionId)
                .maybeSingle();
              const metricsBefore = (() => {
                const arr = decisionRow?.metrics;
                if (!Array.isArray(arr) || arr.length === 0) return {};
                const out: Record<string, unknown> = {};
                for (const m of arr) {
                  if (m?.key && m?.value != null) out[String(m.key).toLowerCase()] = m.value;
                }
                return out;
              })();
              const { error: aoErr } = await (supabase as any).from('action_outcomes').insert({
                user_id: user.id,
                action_type: outcomeType,
                target_level: targetLevel,
                target_id: targetMetaId,
                target_name: decisionRow?.headline || null,
                source: decisionRow?.source === 'ai_chat' ? 'chat' : 'feed',
                ai_reasoning: decisionRow?.headline || null,
                metrics_before: metricsBefore,
                metrics_window: 'd7',
                impact_snapshot: decisionRow?.impact_daily || null,
              });
              if (aoErr) {
                console.warn('[useActions] action_outcomes insert failed', {
                  error: aoErr.message, code: (aoErr as any).code, details: (aoErr as any).details,
                });
              } else {
                console.log('[useActions] action_outcomes created', { decisionId, outcomeType, targetLevel });
              }
            }
          } catch (e) {
            console.warn('[useActions] action_outcomes backfill threw:', (e as any)?.message || e);
          }
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
