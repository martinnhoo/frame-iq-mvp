-- action_outcomes — foundation of compounding intelligence
--
-- Every meaningful action taken on the account (pause/enable/budget/duplicate)
-- writes ONE row here. A pair of crons (24h + 72h after taken_at) measures the
-- aftermath and computes deltas + verdicts. The accumulated dataset is what
-- lets the system answer:
--
--   "this action worked 4/5 times in this account, recovery avg +1.2pp CTR"
--   "user's CPA-deviation pauses succeed 60% of the time"
--   "AI's hypothesis 'low_hook_strength' was correct 80% of the time"
--
-- Design rules (do not break, this is the dataset that trains intelligence):
--   1. Every row carries enough context to be REINTERPRETED in the future
--      with new logic. We don't pre-compute conclusions, we store evidence.
--   2. Multi-metric throughout. Single-metric gets you stuck the moment
--      product evolves to balance CTR/CPA/ROAS together.
--   3. Window of measurement is EXPLICIT (metrics_window). Without it, deltas
--      become silent garbage when the period definition drifts.
--   4. Hypothesis is STRUCTURED (jsonb), not free text. Free text reads ok for
--      humans but is opaque to aggregation. Structured lets us evaluate the
--      AI's reasoning quality, not just whether the action helped.
--   5. RLS: users SELECT their own outcomes. INSERTs only via service role
--      (meta-actions edge fn + cron). Users never write here directly.

-- ── Enums (canonical, not free-text) ──────────────────────────────────────
do $$ begin
  create type action_type_enum as enum (
    'pause_ad',
    'enable_ad',
    'pause_adset',
    'enable_adset',
    'pause_campaign',
    'enable_campaign',
    'budget_increase',
    'budget_decrease',
    'duplicate_ad',
    'change_creative',  -- reserved for future API support
    'change_audience'   -- reserved for future API support
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type target_level_enum as enum ('ad', 'adset', 'campaign');
exception when duplicate_object then null; end $$;

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists public.action_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,

  -- ╔═══ WHAT was done ═══════════════════════════════════════════════════╗
  action_type   action_type_enum   not null,
  target_level  target_level_enum  not null,
  target_id     text               not null,  -- Meta numeric id
  target_name   text,                          -- snapshot of name at action time
  source        text,                          -- 'chat' | 'feed' | 'autopilot' | 'manual'
  alert_id      text,                          -- ties to MetricAlertId when triggered by alert
  ai_reasoning  text,                          -- human-readable rationale shown to user

  -- ╔═══ WHY (structured hypothesis) ═════════════════════════════════════╗
  -- Free-text reasoning is good for the user, opaque to the machine. This
  -- field lets us aggregate later: "AI claims primary_cause=fatigue → was
  -- right 70% of the time" / "expected_effect=ctr_increase delivered 4/5".
  -- Shape (suggested, enforced softly):
  --   { "primary_cause": "low_hook_strength" | "creative_fatigue" |
  --                      "audience_saturation" | "wrong_audience" |
  --                      "budget_starvation" | "tracking_gap" | ...,
  --     "expected_effect": "ctr_increase" | "cpa_decrease" |
  --                        "roas_increase" | "volume_decrease" | ...,
  --     "confidence": 0.0-1.0 }
  hypothesis    jsonb,

  -- ╔═══ CONTEXT at decision time ═════════════════════════════════════════╗
  -- Snapshot of the metrics that justified the action. EVERY relevant metric,
  -- not just the focus one — multi-metric is mandatory because next-iteration
  -- patterns may discover relationships we don't see today.
  -- Shape:
  --   { "ctr": 0.0213, "cpa": 32.10, "roas": 1.8, "spend": 174.50,
  --     "conversions": 5, "frequency": 1.8, "impressions": 4521,
  --     "clicks": 96 }
  metrics_before jsonb not null,
  -- The window over which metrics_before was computed. CRITICAL — without
  -- this, comparisons across rows can silently mix d7 vs d3 vs lifetime
  -- and produce nonsense deltas. Soft enum: 'd3' | 'd7' | 'd14' | 'd30'
  -- | 'lifetime' | 'custom'.
  metrics_window text not null default 'd7',
  -- Money at risk at the moment of action — pulled from the alert's
  -- impact_score / spendAtRisk. Lets the system later report
  -- "this action recovered R$X of impact" — ties learning loop directly
  -- back to the triage system.
  impact_snapshot numeric,

  -- ╔═══ WHAT HAPPENED — measured by cron at 24h and 72h ═════════════════╗
  -- Two windows because metrics respond at different speeds: CTR shifts
  -- within hours, CPA/ROAS need attribution windows. One window alone
  -- either over-claims success early or arrives too late to act.
  metrics_after_24h jsonb,
  metrics_after_72h jsonb,
  delta_24h         jsonb,  -- per-metric diff: { ctr: +0.012, cpa: -8.4, ... }
  delta_72h         jsonb,

  -- ╔═══ INTERPRETATION (calculated from delta, not written by hand) ═════╗
  -- The metric the cron used to judge "improved". Decoupling from the
  -- action_type (e.g. pause_ad → cpa) means we can iterate the success
  -- function without invalidating history.
  evaluation_metric text,
  improved          boolean,  -- nullable until cron runs; verdict per the eval metric
  recovery_pct      numeric,  -- magnitude of the win on the eval metric

  -- ╔═══ Pattern training ═════════════════════════════════════════════════╗
  -- When set true by post-72h logic, marks this outcome as a candidate for
  -- learned_patterns aggregation. Default false — flagged opt-in once we
  -- have aggregation rules implemented. Without this we'd either flood the
  -- patterns table prematurely or ignore good signal.
  pattern_candidate boolean default false,

  -- ╔═══ Lifecycle ════════════════════════════════════════════════════════╗
  taken_at         timestamptz not null default now(),
  measured_24h_at  timestamptz,
  measured_72h_at  timestamptz,
  finalized        boolean default false,  -- true after 72h pass is complete
  created_at       timestamptz default now(),

  -- ╔═══ Extension point ══════════════════════════════════════════════════╗
  -- Free-form jsonb so future fields (experiment_id, override_force,
  -- reverted_at, prior_alert_history, etc.) can land without ALTER TABLE.
  context jsonb default '{}'::jsonb
);

-- ── Indexes — designed for the query patterns the learning layer needs ──
-- "ações similares nesta conta" (action_type + target_level + recent)
create index if not exists idx_action_outcomes_user_action
  on public.action_outcomes(user_id, action_type, target_level, taken_at desc);

-- "histórico recente do usuário" (timeline / audit)
create index if not exists idx_action_outcomes_user_recent
  on public.action_outcomes(user_id, taken_at desc);

-- "outcomes pendentes de medição" (cron picks these up cheaply)
create index if not exists idx_action_outcomes_unfinalized
  on public.action_outcomes(taken_at)
  where finalized = false;

-- "padrões agrupáveis" (later: learned_patterns generator queries this)
create index if not exists idx_action_outcomes_pattern_candidates
  on public.action_outcomes(user_id, action_type, evaluation_metric)
  where pattern_candidate = true and improved = true;

-- "ligação ao alerta de origem" (alert-to-outcome traceability)
create index if not exists idx_action_outcomes_alert
  on public.action_outcomes(user_id, alert_id, taken_at desc)
  where alert_id is not null;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.action_outcomes enable row level security;

drop policy if exists "users read own outcomes" on public.action_outcomes;
create policy "users read own outcomes"
  on public.action_outcomes
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Note: NO insert/update policy for users — writes are service-role only
-- (meta-actions edge fn at action time, action-outcomes-measure-* crons
-- at 24h/72h). Keeps the dataset trustworthy.

-- ── Documentation comments ───────────────────────────────────────────────
comment on table public.action_outcomes is
  'Causal-memory dataset. Every meaningful action writes one row; crons measure aftermath at 24h+72h. Foundation for learned patterns + AI recommendation confidence.';
comment on column public.action_outcomes.metrics_before is
  'Snapshot of all relevant metrics at action time. JSONB to keep multi-metric reasoning open as the product evolves.';
comment on column public.action_outcomes.metrics_window is
  'CRITICAL: window definition for metrics_before. Without this, comparisons across rows produce silent garbage when window definitions drift. d7|d3|d14|d30|lifetime|custom.';
comment on column public.action_outcomes.hypothesis is
  'Structured AI reasoning at decision time. Lets us measure AI quality (was the cause it claimed actually right?), not just action quality (did the metric improve?).';
comment on column public.action_outcomes.impact_snapshot is
  'R$ at risk per the alert system at the moment of action. Closes the loop: lets the system report "this recovered R$X of impact".';
comment on column public.action_outcomes.evaluation_metric is
  'Which metric was used to judge improved. Decoupled from action_type so the success function can iterate without invalidating history.';
comment on column public.action_outcomes.pattern_candidate is
  'Opt-in flag for learned-patterns aggregation. Default false until aggregation rules exist; prevents premature flooding of patterns table.';
