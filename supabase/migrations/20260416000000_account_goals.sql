-- ================================================================
-- CONVERSION INTELLIGENCE SYSTEM
-- User-defined objectives, primary metric, and conversion type
-- ================================================================

-- Add goal columns directly to ad_accounts (one goal per account)
ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS goal_objective TEXT DEFAULT NULL
    CHECK (goal_objective IN ('leads', 'sales', 'traffic', 'awareness')),
  ADD COLUMN IF NOT EXISTS goal_primary_metric TEXT DEFAULT NULL
    CHECK (goal_primary_metric IN ('cpa', 'roas', 'cpc', 'cpm')),
  ADD COLUMN IF NOT EXISTS goal_conversion_event TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goal_target_value INTEGER DEFAULT NULL,  -- centavos or basis points depending on metric
  ADD COLUMN IF NOT EXISTS goal_configured_at TIMESTAMPTZ DEFAULT NULL;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_ad_accounts_goal
  ON ad_accounts (user_id) WHERE goal_objective IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ad_accounts.goal_objective IS 'User-defined business objective: leads, sales, traffic, awareness';
COMMENT ON COLUMN ad_accounts.goal_primary_metric IS 'Primary metric for judging performance: cpa (leads), roas (sales), cpc (traffic), cpm (awareness)';
COMMENT ON COLUMN ad_accounts.goal_conversion_event IS 'Meta action_type to count as conversion: lead, purchase, complete_registration, etc.';
COMMENT ON COLUMN ad_accounts.goal_target_value IS 'Target value in centavos (CPA/CPC) or basis points (ROAS). E.g. CPA R$20 = 2000, ROAS 3x = 30000';
COMMENT ON COLUMN ad_accounts.goal_configured_at IS 'When the user last configured their goal — NULL means not yet set';
