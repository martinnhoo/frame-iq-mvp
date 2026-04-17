-- ============================================================
-- DECISION PIPELINE: Financial + Safety + Explainability layers
-- ============================================================
-- Architecture: INPUT → DECISION ENGINE → FINANCIAL FILTER → SAFETY LAYER → OUTPUT
-- This migration adds the data foundation for all three layers.

-- ────────────────────────────────────────────────────────────
-- 1. FINANCIAL CONFIG on ad_accounts
--    Allows per-account margin/LTV/budget configuration
-- ────────────────────────────────────────────────────────────

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS profit_margin_pct numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS break_even_roas numeric GENERATED ALWAYS AS (
    CASE WHEN profit_margin_pct > 0 THEN round((1.0 / (profit_margin_pct / 100.0))::numeric, 2)
    ELSE NULL END
  ) STORED,
  ADD COLUMN IF NOT EXISTS ltv_estimate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS monthly_budget_target numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL';

COMMENT ON COLUMN ad_accounts.profit_margin_pct IS 'Product profit margin as percentage (e.g. 40 = 40%). Used to calculate break-even ROAS.';
COMMENT ON COLUMN ad_accounts.break_even_roas IS 'Auto-calculated: 1 / (margin/100). ROAS below this = losing money.';
COMMENT ON COLUMN ad_accounts.ltv_estimate IS 'Estimated customer lifetime value in account currency. Adjusts CPA thresholds.';
COMMENT ON COLUMN ad_accounts.monthly_budget_target IS 'Monthly budget target for pacing calculations.';

-- ────────────────────────────────────────────────────────────
-- 2. SAFETY CONFIG on ad_accounts
--    Per-account guardrails for autonomous actions
-- ────────────────────────────────────────────────────────────

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS max_budget_increase_pct numeric DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_actions_per_day integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS auto_rollback_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS rollback_roas_drop_pct numeric DEFAULT 30,
  ADD COLUMN IF NOT EXISTS rollback_window_hours integer DEFAULT 48,
  ADD COLUMN IF NOT EXISTS gradual_scaling_enabled boolean DEFAULT true;

COMMENT ON COLUMN ad_accounts.max_budget_increase_pct IS 'Maximum single budget increase (%). Default 20%. Prevents runaway spend.';
COMMENT ON COLUMN ad_accounts.max_actions_per_day IS 'Maximum automated actions per day. Default 5. Safety valve.';
COMMENT ON COLUMN ad_accounts.auto_rollback_enabled IS 'If true, auto-reverts budget when ROAS drops after scale action.';
COMMENT ON COLUMN ad_accounts.rollback_roas_drop_pct IS 'ROAS drop % that triggers auto-rollback. Default 30%.';
COMMENT ON COLUMN ad_accounts.rollback_window_hours IS 'Hours after action to monitor for rollback. Default 48h.';

-- ────────────────────────────────────────────────────────────
-- 3. ACTION LOG — audit trail + rollback capability
--    Every automated action is logged with before/after state
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),

  -- Who & where
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  persona_id text,

  -- What was done
  action_type text NOT NULL,  -- 'pause' | 'enable' | 'scale_budget' | 'duplicate' | 'rollback'
  target_id text NOT NULL,    -- Meta ad/adset/campaign ID
  target_type text NOT NULL DEFAULT 'ad',  -- 'ad' | 'adset' | 'campaign'
  target_name text,

  -- Before/after for rollback
  previous_value jsonb,       -- e.g. {"daily_budget": 5000, "status": "ACTIVE"}
  new_value jsonb,            -- e.g. {"daily_budget": 6000}

  -- Decision context
  confidence numeric NOT NULL DEFAULT 0,  -- 0.0 to 1.0
  risk_level text NOT NULL DEFAULT 'moderate',  -- 'safe' | 'moderate' | 'high'
  financial_verdict text,     -- 'profitable' | 'break_even' | 'losing' | 'unknown'
  explanation jsonb NOT NULL DEFAULT '{}',
  -- explanation schema: {
  --   "data_point": "ROAS 0.6 over 72h",
  --   "threshold": "break_even_roas = 2.5",
  --   "financial_check": "ROAS < break_even → losing money",
  --   "safety_check": "within daily action limit (2/5)",
  --   "verdict": "Pause justified — saving ~R$45/day"
  -- }

  -- Execution state
  executed boolean DEFAULT false,
  executed_at timestamptz,
  execution_result jsonb,     -- Meta API response

  -- Rollback
  rolled_back boolean DEFAULT false,
  rolled_back_at timestamptz,
  rollback_reason text,       -- 'roas_drop' | 'manual' | 'safety_limit'
  rollback_action_id uuid REFERENCES action_log(id),

  -- Source
  source text NOT NULL DEFAULT 'system',  -- 'system' | 'user' | 'auto_pilot'
  triggered_by text,           -- 'check-critical-alerts' | 'daily-intelligence' | 'user-click'

  -- Shadow mode
  is_shadow boolean DEFAULT false,  -- true = logged by shadow pipeline, NOT executed

  -- Decision tag — categorizes strategy type for performance analysis
  -- Enables: "which strategy type delivers best ROAS improvement?"
  decision_tag text  -- 'scale_aggressive' | 'scale_safe' | 'pause_loss' | 'pause_fatigue' |
                     -- 'recover_test' | 'budget_rebalance' | 'creative_refresh' | 'audience_shift'
);

CREATE INDEX IF NOT EXISTS idx_action_log_account ON action_log(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_user ON action_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_target ON action_log(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_rollback ON action_log(account_id, rolled_back, executed_at)
  WHERE executed = true AND rolled_back = false;

-- ────────────────────────────────────────────────────────────
-- 4. DAILY ACTION COUNTER view
--    Used by safety layer to enforce max_actions_per_day
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_action_counts AS
SELECT
  account_id,
  date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS action_date,
  count(*) FILTER (WHERE executed = true) AS executed_count,
  count(*) FILTER (WHERE action_type = 'scale_budget' AND executed = true) AS scale_count,
  count(*) FILTER (WHERE action_type = 'pause' AND executed = true) AS pause_count
FROM action_log
GROUP BY account_id, date_trunc('day', created_at AT TIME ZONE 'UTC')::date;

-- ────────────────────────────────────────────────────────────
-- 5. PENDING ROLLBACKS view
--    Actions within rollback window that haven't been checked
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW pending_rollback_checks AS
SELECT
  al.id,
  al.account_id,
  al.user_id,
  al.target_id,
  al.target_type,
  al.action_type,
  al.previous_value,
  al.new_value,
  al.executed_at,
  aa.rollback_roas_drop_pct,
  aa.rollback_window_hours
FROM action_log al
JOIN ad_accounts aa ON aa.id = al.account_id
WHERE al.executed = true
  AND al.rolled_back = false
  AND al.action_type = 'scale_budget'
  AND aa.auto_rollback_enabled = true
  AND al.executed_at > now() - interval '72 hours';

-- ────────────────────────────────────────────────────────────
-- 6. RLS policies
-- ────────────────────────────────────────────────────────────

ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own action log"
  ON action_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage action log"
  ON action_log FOR ALL
  USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 7. FEATURE FLAG — per-account engine version
--    v1 = current system (no pipeline)
--    v2_shadow = new pipeline runs in parallel, logs only
--    v2_active = new pipeline controls decisions
-- ────────────────────────────────────────────────────────────

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS decision_engine_version text DEFAULT 'v1';

COMMENT ON COLUMN ad_accounts.decision_engine_version IS 'v1=current, v2_shadow=new pipeline logs only, v2_active=new pipeline executes';

-- Shadow entries index (for comparing old vs new decisions)
CREATE INDEX IF NOT EXISTS idx_action_log_shadow ON action_log(account_id, is_shadow, created_at DESC)
  WHERE is_shadow = true;

-- Decision tag index (for strategy performance analysis)
CREATE INDEX IF NOT EXISTS idx_action_log_tag ON action_log(account_id, decision_tag, created_at DESC)
  WHERE decision_tag IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 8. A/B TEST — per-account group assignment
-- ────────────────────────────────────────────────────────────

ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS ab_test_group text DEFAULT NULL;

COMMENT ON COLUMN ad_accounts.ab_test_group IS 'NULL=not in test, control=v1, treatment=v2. Set when enabling A/B comparison.';

-- ────────────────────────────────────────────────────────────
-- 9. STRATEGY PERFORMANCE view
--    Measures which decision tags lead to best outcomes
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW strategy_performance AS
SELECT
  al.account_id,
  al.decision_tag,
  count(*) AS total_actions,
  count(*) FILTER (WHERE al.rolled_back = true) AS rolled_back_count,
  round(avg(al.confidence)::numeric, 2) AS avg_confidence,
  count(*) FILTER (WHERE al.executed = true) AS executed_count,
  min(al.created_at) AS first_action,
  max(al.created_at) AS last_action
FROM action_log al
WHERE al.decision_tag IS NOT NULL
  AND al.is_shadow = false
GROUP BY al.account_id, al.decision_tag;
