-- ============================================================================
-- AdBrief Credit System Migration
-- Replaces per-action counters with unified credit pool per user per month
-- ============================================================================

-- 1. Credits ledger table — tracks monthly credit balance and usage
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,            -- YYYY-MM
  total_credits INTEGER NOT NULL DEFAULT 0,   -- monthly pool
  used_credits INTEGER NOT NULL DEFAULT 0,    -- total consumed
  bonus_credits INTEGER NOT NULL DEFAULT 0,   -- from referrals, promos
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_period ON user_credits(user_id, period);

-- RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_credits_own ON user_credits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Credit transactions log — every deduction/addition is recorded
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,            -- YYYY-MM
  action TEXT NOT NULL,            -- 'chat', 'analysis', 'hooks', etc.
  credits INTEGER NOT NULL,        -- positive = consumed, negative = refunded/bonus
  balance_after INTEGER NOT NULL,  -- remaining credits after this transaction
  metadata JSONB,                  -- optional: persona_id, session context, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_period ON credit_transactions(user_id, period);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_tx_action ON credit_transactions(action);

-- RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_tx_own_select ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);
-- Only service_role can INSERT (edge functions)
CREATE POLICY credit_tx_service_insert ON credit_transactions
  FOR INSERT WITH CHECK (true);

-- 3. Atomic credit deduction function
-- Returns: { allowed: bool, remaining: int, used: int, total: int }
-- Creates the period row if it doesn't exist (with plan credits)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_action TEXT,
  p_credits INTEGER,
  p_total_credits INTEGER,     -- plan credit pool (passed by edge function)
  p_bonus_credits INTEGER DEFAULT 0,  -- any pending bonus to add
  p_metadata JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period TEXT;
  v_row user_credits%ROWTYPE;
  v_available INTEGER;
  v_new_used INTEGER;
BEGIN
  v_period := to_char(now(), 'YYYY-MM');

  -- Upsert: create row for this period if not exists
  INSERT INTO user_credits (user_id, period, total_credits, used_credits, bonus_credits)
  VALUES (p_user_id, v_period, p_total_credits, 0, p_bonus_credits)
  ON CONFLICT (user_id, period) DO UPDATE SET
    total_credits = GREATEST(user_credits.total_credits, p_total_credits),
    bonus_credits = user_credits.bonus_credits + p_bonus_credits,
    updated_at = now();

  -- Lock and read current state
  SELECT * INTO v_row FROM user_credits
  WHERE user_id = p_user_id AND period = v_period
  FOR UPDATE;

  v_available := (v_row.total_credits + v_row.bonus_credits) - v_row.used_credits;

  -- Check if enough credits
  IF v_available < p_credits THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', v_available,
      'used', v_row.used_credits,
      'total', v_row.total_credits + v_row.bonus_credits
    );
  END IF;

  -- Deduct
  v_new_used := v_row.used_credits + p_credits;
  UPDATE user_credits SET used_credits = v_new_used, updated_at = now()
  WHERE user_id = p_user_id AND period = v_period;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, period, action, credits, balance_after, metadata)
  VALUES (p_user_id, v_period, p_action, p_credits,
          (v_row.total_credits + v_row.bonus_credits) - v_new_used,
          p_metadata);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', (v_row.total_credits + v_row.bonus_credits) - v_new_used,
    'used', v_new_used,
    'total', v_row.total_credits + v_row.bonus_credits
  );
END;
$$;

-- 4. Add bonus credits function (for referrals, promos)
CREATE OR REPLACE FUNCTION add_bonus_credits(
  p_user_id UUID,
  p_credits INTEGER,
  p_reason TEXT DEFAULT 'referral',
  p_total_credits INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period TEXT;
  v_row user_credits%ROWTYPE;
BEGIN
  v_period := to_char(now(), 'YYYY-MM');

  -- Upsert period row
  INSERT INTO user_credits (user_id, period, total_credits, used_credits, bonus_credits)
  VALUES (p_user_id, v_period, p_total_credits, 0, p_credits)
  ON CONFLICT (user_id, period) DO UPDATE SET
    bonus_credits = user_credits.bonus_credits + p_credits,
    updated_at = now();

  SELECT * INTO v_row FROM user_credits
  WHERE user_id = p_user_id AND period = v_period;

  -- Log as negative credits (addition)
  INSERT INTO credit_transactions (user_id, period, action, credits, balance_after, metadata)
  VALUES (p_user_id, v_period, p_reason, -p_credits,
          (v_row.total_credits + v_row.bonus_credits) - v_row.used_credits,
          jsonb_build_object('type', 'bonus', 'reason', p_reason));

  RETURN jsonb_build_object(
    'success', true,
    'remaining', (v_row.total_credits + v_row.bonus_credits) - v_row.used_credits,
    'bonus_total', v_row.bonus_credits
  );
END;
$$;

-- 5. Get credit balance function (fast read)
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period TEXT;
  v_row user_credits%ROWTYPE;
BEGIN
  v_period := to_char(now(), 'YYYY-MM');

  SELECT * INTO v_row FROM user_credits
  WHERE user_id = p_user_id AND period = v_period;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object(
      'total', 0, 'used', 0, 'bonus', 0, 'remaining', 0,
      'period', v_period
    );
  END IF;

  RETURN jsonb_build_object(
    'total', v_row.total_credits,
    'used', v_row.used_credits,
    'bonus', v_row.bonus_credits,
    'remaining', (v_row.total_credits + v_row.bonus_credits) - v_row.used_credits,
    'period', v_period
  );
END;
$$;

-- 6. Grant execute to authenticated + service_role
GRANT EXECUTE ON FUNCTION deduct_credits TO service_role;
GRANT EXECUTE ON FUNCTION add_bonus_credits TO service_role;
GRANT EXECUTE ON FUNCTION get_credit_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_credit_balance TO service_role;

-- 7. Admin view for monitoring (no RLS — service_role only)
CREATE OR REPLACE VIEW credit_usage_overview AS
SELECT
  uc.user_id,
  p.email,
  p.plan,
  uc.period,
  uc.total_credits,
  uc.used_credits,
  uc.bonus_credits,
  (uc.total_credits + uc.bonus_credits) - uc.used_credits AS remaining,
  ROUND(uc.used_credits::numeric / NULLIF(uc.total_credits + uc.bonus_credits, 0) * 100, 1) AS usage_pct,
  uc.updated_at
FROM user_credits uc
JOIN profiles p ON p.id = uc.user_id
ORDER BY uc.period DESC, usage_pct DESC NULLS LAST;
