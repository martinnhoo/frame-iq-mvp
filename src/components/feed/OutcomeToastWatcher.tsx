// OutcomeToastWatcher — closes the dopaminergic loop.
//
// The action_outcomes pipeline measures every action 24h+72h after taken_at
// via cron. Until now the user only saw the result if they navigated to
// History or to a Decision Card; otherwise the system worked in silence.
// This component bridges that silence: when an outcome finalizes between
// two of the user's sessions, the next time they open ANY dashboard page
// they get a toast surfacing the result.
//
// Design principles:
//   1) Honest — losses get a toast too. The system that admits errors
//      builds more trust than the one that only celebrates wins.
//   2) Non-noisy — at most MAX_TOASTS_PER_VISIT toasts per session, with
//      small stagger between them so they don't pile on top of each other.
//   3) Skip inconclusive — those are "we don't know"; a toast would be
//      both meaningless and annoying. They show in History instead.
//   4) Respect user's seen-state — last_seen_outcome_at in localStorage
//      acts as a cursor. Once a toast fires, the cursor advances; same
//      outcome never fires twice. Default cursor on first visit is "now"
//      (not "all of history") so we don't blast 50 toasts day-one.
//
// State source: action_outcomes (the canonical Phase 2b/3 dataset).
// Backend dependency: cron jobs already populate measured_72h_at +
// finalized + improved. No new infra needed.
//
// Mount point: DashboardLayout — runs on every page in /dashboard.
// Renders null; effects only.

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';

interface OutcomeToastWatcherProps {
  userId?: string | null;
}

const STORAGE_KEY = 'adb:last_seen_outcome_72h_at';
const MAX_TOASTS_PER_VISIT = 3;
const STAGGER_MS = 1200;
// Hard floor for the cursor on first visit. Without this, a brand-new
// install (no localStorage) would query "all outcomes ever finalized"
// and potentially show toasts for actions from weeks ago — annoying and
// disorienting. 7 days back is a sane "you'd plausibly remember this".
const FIRST_VISIT_LOOKBACK_DAYS = 7;

type FinalizedOutcomeRow = {
  id: string;
  action_type: string;
  target_name: string | null;
  measured_72h_at: string;
  improved: boolean | null;
  recovery_pct: number | null;
  context: Record<string, any> | null;
};

// Translates the canonical action_type enum to a friendly verb that
// reads naturally inside "Sua [verb] de [target]". Falls back to the
// raw enum if a mapping is missing — better than silent failure.
function actionVerb(actionType: string): string {
  const m: Record<string, string> = {
    pause_ad: 'pause',
    pause_adset: 'pause de conjunto',
    pause_campaign: 'pause de campanha',
    enable_ad: 'reativação',
    enable_adset: 'reativação de conjunto',
    enable_campaign: 'reativação de campanha',
    budget_increase: 'aumento de budget',
    budget_decrease: 'redução de budget',
    duplicate_ad: 'duplicação',
  };
  return m[actionType] || actionType.replace(/_/g, ' ');
}

export function OutcomeToastWatcher({ userId }: OutcomeToastWatcherProps) {
  // Guards against firing twice on remounts (StrictMode / fast refresh).
  // useRef instead of useState because we don't need a re-render on change.
  const ranRef = useRef(false);

  useEffect(() => {
    if (!userId || ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        // Cursor: read last_seen from localStorage; floor to 7d ago on first visit.
        // storage.get returns "" on missing — treat empty as no cursor.
        const stored = storage.get(STORAGE_KEY, '');
        const floorIso = new Date(Date.now() - FIRST_VISIT_LOOKBACK_DAYS * 86400000).toISOString();
        const since = stored && stored > floorIso ? stored : floorIso;

        const { data, error } = await (supabase as any)
          .from('action_outcomes')
          .select('id, action_type, target_name, measured_72h_at, improved, recovery_pct, context')
          .eq('user_id', userId)
          .eq('finalized', true)
          .not('measured_72h_at', 'is', null)
          .gt('measured_72h_at', since)
          .order('measured_72h_at', { ascending: false })
          .limit(MAX_TOASTS_PER_VISIT * 2); // small buffer for filtering inconclusive
        if (cancelled || error || !data) return;

        // Filter inconclusive (improved IS NULL) — those don't get toasts.
        // Then trim to MAX_TOASTS_PER_VISIT.
        const eligible = (data as FinalizedOutcomeRow[])
          .filter(r => r.improved === true || r.improved === false)
          .slice(0, MAX_TOASTS_PER_VISIT);

        // Advance the cursor BEFORE firing toasts. If something throws
        // mid-loop, we still don't replay the same toasts on next mount.
        // The newest measured_72h_at in the result set becomes the new
        // floor (only finalized rows past this point will re-trigger).
        const newestSeen = (data as FinalizedOutcomeRow[])
          .reduce<string | null>(
            (max, r) => (max === null || r.measured_72h_at > max ? r.measured_72h_at : max),
            null,
          );
        if (newestSeen) storage.set(STORAGE_KEY, newestSeen);

        // Fire toasts with stagger so they don't stack on top of each other.
        // The library handles z-index but human visual processing prefers
        // sequential reveals — small delay = better cognitive parsing.
        eligible.forEach((row, i) => {
          setTimeout(() => {
            if (cancelled) return;
            const target = row.target_name || 'item';
            const verb = actionVerb(row.action_type);

            if (row.improved === true) {
              const avoided = Number(row.context?.avoided_spend_brl);
              const detail = Number.isFinite(avoided) && avoided > 0
                ? `R$ ${avoided.toFixed(2).replace('.', ',')} evitados`
                : row.recovery_pct !== null
                ? `${row.recovery_pct > 0 ? '+' : ''}${row.recovery_pct.toFixed(1)}% de impacto`
                : null;
              toast.success(
                `Sua ${verb} de "${target}" funcionou`,
                {
                  description: detail || 'Métricas melhoraram após a ação.',
                  duration: 7000,
                },
              );
            } else {
              // improved === false. Use info (not error) — the action
              // ran, the system measured, the verdict is honest. It's
              // not an error, it's evidence.
              toast(
                `Sua ${verb} de "${target}" não funcionou`,
                {
                  description: 'Métricas não melhoraram após a ação. Esse aprendizado vai pesar nas próximas recomendações.',
                  duration: 8000,
                },
              );
            }
          }, i * STAGGER_MS);
        });
      } catch {
        // Silent — toasts are an enrichment, not core. Failure here
        // shouldn't break the dashboard.
      }
    })();

    return () => { cancelled = true; };
    // userId is the only meaningful dependency; we want this to fire
    // exactly once per session per user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
