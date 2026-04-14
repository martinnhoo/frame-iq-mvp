-- ================================================================
-- ADBRIEF.PRO V2 — CORE SCHEMA
-- Real-Time Creative Decision Engine
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. AD ACCOUNTS (connected Meta accounts)
-- ================================================================
CREATE TABLE ad_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meta_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'BRL',
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disconnected', 'error')),
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  last_fast_sync_at TIMESTAMPTZ,
  last_full_sync_at TIMESTAMPTZ,
  last_deep_sync_at TIMESTAMPTZ,
  total_ads_synced INTEGER DEFAULT 0,
  total_spend_30d INTEGER DEFAULT 0, -- centavos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, meta_account_id)
);

-- ================================================================
-- 2. ACCOUNT BASELINES (adaptive thresholds per account)
-- ================================================================
CREATE TABLE account_baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  period_days INTEGER NOT NULL CHECK (period_days IN (7, 30, 90)),
  -- CTR percentiles
  ctr_p25 DECIMAL(10,6),
  ctr_median DECIMAL(10,6),
  ctr_p75 DECIMAL(10,6),
  ctr_p95 DECIMAL(10,6),
  -- CPA percentiles (centavos)
  cpa_p25 INTEGER,
  cpa_median INTEGER,
  cpa_p75 INTEGER,
  -- ROAS percentiles
  roas_p25 DECIMAL(8,4),
  roas_median DECIMAL(8,4),
  roas_p75 DECIMAL(8,4),
  -- Aggregates
  spend_daily_avg INTEGER, -- centavos
  conversion_rate_avg DECIMAL(8,6),
  frequency_healthy_max DECIMAL(6,2) DEFAULT 3.0,
  -- Account maturity
  maturity TEXT DEFAULT 'new' CHECK (maturity IN ('new', 'establishing', 'mature')),
  sample_size INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, period_days)
);

-- ================================================================
-- 3. CAMPAIGNS
-- ================================================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  meta_campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'UNKNOWN',
  daily_budget INTEGER, -- centavos
  lifetime_budget INTEGER, -- centavos
  buying_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, meta_campaign_id)
);

-- ================================================================
-- 4. AD SETS
-- ================================================================
CREATE TABLE ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  meta_adset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  daily_budget INTEGER, -- centavos
  lifetime_budget INTEGER,
  targeting JSONB DEFAULT '{}',
  optimization_goal TEXT,
  bid_strategy TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, meta_adset_id)
);

-- ================================================================
-- 5. CREATIVES (deduplicated via perceptual hash)
-- ================================================================
CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  meta_creative_id TEXT,
  phash TEXT, -- perceptual hash for dedup
  cluster_id UUID, -- group similar creatives
  format TEXT CHECK (format IN ('image', 'video', 'carousel', 'collection', 'unknown')),
  thumbnail_url TEXT,
  video_url TEXT,
  body TEXT,
  title TEXT,
  link_url TEXT,
  cta_type TEXT,
  -- Extracted features
  has_hook BOOLEAN,
  hook_timing_ms INTEGER, -- for videos
  hook_rate DECIMAL(6,4), -- 3s view / impressions
  has_cta BOOLEAN,
  text_density TEXT CHECK (text_density IN ('low', 'medium', 'high')),
  dominant_colors JSONB,
  -- Analysis
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creatives_phash ON creatives(phash);
CREATE INDEX idx_creatives_cluster ON creatives(cluster_id);

-- ================================================================
-- 6. ADS
-- ================================================================
CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_set_id UUID REFERENCES ad_sets(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  meta_ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'UNKNOWN',
  creative_id UUID REFERENCES creatives(id),
  effective_status TEXT,
  created_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, meta_ad_id)
);

-- ================================================================
-- 7. AD METRICS (1 row per ad per day — the core data)
-- ================================================================
CREATE TABLE ad_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID REFERENCES ads(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  -- Raw metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend INTEGER DEFAULT 0, -- centavos
  conversions INTEGER DEFAULT 0,
  revenue INTEGER DEFAULT 0, -- centavos
  reach INTEGER DEFAULT 0,
  -- Calculated metrics
  ctr DECIMAL(10,6), -- clicks/impressions
  cpc INTEGER, -- centavos
  cpa INTEGER, -- centavos (spend/conversions)
  roas DECIMAL(10,4), -- revenue/spend
  frequency DECIMAL(8,4),
  -- Video specific
  video_views_3s INTEGER DEFAULT 0,
  video_views_thruplay INTEGER DEFAULT 0,
  -- Meta
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_id, date)
);

CREATE INDEX idx_ad_metrics_date ON ad_metrics(date DESC);
CREATE INDEX idx_ad_metrics_account_date ON ad_metrics(account_id, date DESC);
CREATE INDEX idx_ad_metrics_spend ON ad_metrics(spend DESC);

-- ================================================================
-- 8. DECISIONS (the core product output)
-- ================================================================
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  ad_id UUID REFERENCES ads(id) ON DELETE CASCADE NOT NULL,
  -- Classification
  type TEXT NOT NULL CHECK (type IN ('kill', 'fix', 'scale', 'alert', 'insight')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  priority_rank INTEGER,
  -- Content
  headline TEXT NOT NULL,
  reason TEXT NOT NULL,
  -- Financial impact
  impact_type TEXT CHECK (impact_type IN ('waste', 'savings', 'revenue')),
  impact_daily INTEGER, -- centavos
  impact_7d INTEGER, -- centavos
  impact_confidence TEXT CHECK (impact_confidence IN ('high', 'medium', 'low')),
  impact_basis TEXT,
  -- Structured data
  metrics JSONB DEFAULT '[]', -- [{key, value, context, trend}]
  actions JSONB DEFAULT '[]', -- [{id, label, type, meta_api_action, params}]
  -- State
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acted', 'dismissed', 'expired')),
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decisions_account_status ON decisions(account_id, status);
CREATE INDEX idx_decisions_type_score ON decisions(type, score DESC);
CREATE INDEX idx_decisions_created ON decisions(created_at DESC);

-- ================================================================
-- 9. ACTION LOG (every action executed, with rollback)
-- ================================================================
CREATE TABLE action_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  decision_id UUID REFERENCES decisions(id),
  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN (
    'pause_ad', 'pause_adset', 'pause_campaign',
    'reactivate_ad', 'reactivate_adset',
    'increase_budget', 'decrease_budget',
    'duplicate_ad', 'generate_hook', 'generate_variation'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('ad', 'adset', 'campaign')),
  target_meta_id TEXT NOT NULL,
  target_name TEXT,
  -- State management
  previous_state JSONB NOT NULL DEFAULT '{}',
  new_state JSONB NOT NULL DEFAULT '{}',
  -- Financial impact
  estimated_daily_impact INTEGER, -- centavos (positive = savings/revenue)
  actual_impact_48h INTEGER, -- filled by validate-decisions after 48h
  -- Result
  result TEXT DEFAULT 'pending' CHECK (result IN ('pending', 'success', 'error', 'rolled_back')),
  error_message TEXT,
  meta_api_response JSONB,
  -- Rollback
  rollback_available BOOLEAN DEFAULT true,
  rollback_expires_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ,
  -- Timestamps
  executed_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ -- when 48h feedback was generated
);

CREATE INDEX idx_action_log_user ON action_log(user_id, executed_at DESC);
CREATE INDEX idx_action_log_account ON action_log(account_id, executed_at DESC);

-- ================================================================
-- 10. ACCOUNT PATTERNS (learned by the system)
-- ================================================================
CREATE TABLE account_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'creative_format', 'hook_style', 'audience', 'timing',
    'cta_type', 'copy_style', 'fatigue', 'general'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Evidence
  evidence_ad_ids UUID[] DEFAULT '{}',
  evidence_spend INTEGER DEFAULT 0, -- total spend supporting this pattern
  sample_size INTEGER DEFAULT 0,
  -- Strength
  strength DECIMAL(4,2) DEFAULT 0 CHECK (strength >= 0 AND strength <= 1),
  impact_percentage DECIMAL(8,2), -- e.g., "43% better CPA"
  -- State
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'weak', 'invalidated')),
  discovered_at TIMESTAMPTZ DEFAULT now(),
  last_validated_at TIMESTAMPTZ
);

-- ================================================================
-- 11. MONEY TRACKER (accumulated savings — the retention anchor)
-- ================================================================
CREATE TABLE money_tracker (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES ad_accounts(id) ON DELETE CASCADE NOT NULL,
  -- Running totals (ONLY GO UP — never decrease)
  total_saved INTEGER DEFAULT 0, -- centavos, lifetime
  total_revenue_captured INTEGER DEFAULT 0, -- centavos, lifetime
  total_actions_taken INTEGER DEFAULT 0,
  -- Daily snapshots
  saved_today INTEGER DEFAULT 0,
  revenue_today INTEGER DEFAULT 0,
  leaking_now INTEGER DEFAULT 0, -- current daily waste rate
  capturable_now INTEGER DEFAULT 0, -- current daily opportunity
  -- Streaks
  active_days_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  longest_streak INTEGER DEFAULT 0,
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id)
);

-- ================================================================
-- 12. NOTIFICATIONS
-- ================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES ad_accounts(id),
  decision_id UUID REFERENCES decisions(id),
  action_log_id UUID REFERENCES action_log(id),
  -- Content
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'email', 'push', 'in_app')),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'kill_alert', 'action_feedback', 'daily_summary',
    'weekly_report', 'decision_result_48h', 'churn_prevention',
    'pattern_discovered', 'welcome'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  -- State
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  -- Meta
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================================
-- 13. USER SETTINGS
-- ================================================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- Notifications
  telegram_chat_id TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  -- Preferences
  alert_threshold_score INTEGER DEFAULT 70, -- min score to send alert
  auto_mode_enabled BOOLEAN DEFAULT false,
  auto_mode_kill_threshold INTEGER DEFAULT 90,
  auto_mode_scale_threshold INTEGER DEFAULT 85,
  sounds_enabled BOOLEAN DEFAULT false,
  -- Display
  language TEXT DEFAULT 'pt',
  currency_display TEXT DEFAULT 'BRL',
  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT false,
  first_scan_completed BOOLEAN DEFAULT false,
  first_action_completed BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Direct user ownership
CREATE POLICY "own_data" ON ad_accounts FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON action_log FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_data" ON user_settings FOR ALL USING (user_id = auth.uid());

-- Via account ownership
CREATE POLICY "own_account_data" ON account_baselines FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON campaigns FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON ad_sets FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON creatives FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON ads FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON ad_metrics FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON decisions FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON account_patterns FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));
CREATE POLICY "own_account_data" ON money_tracker FOR ALL
  USING (account_id IN (SELECT id FROM ad_accounts WHERE user_id = auth.uid()));

-- ================================================================
-- FUNCTIONS
-- ================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ad_accounts_updated_at BEFORE UPDATE ON ad_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_decisions_updated_at BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_money_tracker_updated_at BEFORE UPDATE ON money_tracker
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Expire stale decisions (run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION expire_stale_decisions()
RETURNS void AS $$
BEGIN
  UPDATE decisions
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND (expires_at IS NOT NULL AND expires_at < now());
END;
$$ LANGUAGE plpgsql;
