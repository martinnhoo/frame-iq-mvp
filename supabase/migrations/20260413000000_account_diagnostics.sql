-- Account Diagnostics — stores instant account health analysis
-- Created by account-diagnostic edge function on first Meta connection + weekly cron

CREATE TABLE IF NOT EXISTS account_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID,
  ad_account_id TEXT NOT NULL,

  -- Hero numbers
  wasted_spend NUMERIC DEFAULT 0,
  wasted_spend_monthly NUMERIC DEFAULT 0,
  projected_roas NUMERIC,
  current_roas NUMERIC,
  roas_improvement_pct NUMERIC,

  -- Account Health Score (0-100)
  score INTEGER DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',

  -- Aggregated metrics
  metrics JSONB DEFAULT '{}',

  -- Benchmark comparison
  benchmarks JSONB DEFAULT '{}',

  -- Classified ads
  ads_to_pause JSONB DEFAULT '[]',
  ads_to_scale JSONB DEFAULT '[]',
  ads_fatigued JSONB DEFAULT '[]',
  top_performers JSONB DEFAULT '[]',

  -- Haiku-contextualized insights
  insights JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each user+account combo gets one diagnostic (upserted on re-run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_diagnostics_user_account
  ON account_diagnostics (user_id, ad_account_id);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_account_diagnostics_user
  ON account_diagnostics (user_id);

-- RLS: users only see their own diagnostics
ALTER TABLE account_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own diagnostics"
  ON account_diagnostics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all diagnostics"
  ON account_diagnostics FOR ALL
  USING (auth.role() = 'service_role');
