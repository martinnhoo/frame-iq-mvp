-- increment_money_tracker — atomic increment helper for money_tracker totals.
--
-- Why this exists:
--   execute-action and autopilot-executor both call
--   supabase.rpc("increment_money_tracker", {...}) after a successful
--   Meta action to accumulate lifetime savings / revenue captured.
--   The function was never created in a migration, so every call was
--   returning `function does not exist` and the retry path was
--   swallowing the error. Customers saw buttons "succeed" on the UI
--   but the R$ economizado / R$ capturado dashboard stayed at zero
--   forever.
--
-- Behavior:
--   • Auto-creates the money_tracker row for the account if missing
--     (the table has UNIQUE(account_id), so ON CONFLICT is safe).
--   • Atomically increments the requested lifetime total (total_saved
--     or total_revenue_captured), the matching today snapshot, and
--     total_actions_taken.
--   • All amounts in centavos. Negative amounts are rejected (totals
--     are defined as monotonically increasing).
--
-- Inputs:
--   p_account_id  UUID   — ad_accounts.id
--   p_field       TEXT   — 'total_saved' or 'total_revenue_captured'
--   p_amount      INTEGER— centavos to add (must be >= 0)

CREATE OR REPLACE FUNCTION increment_money_tracker(
  p_account_id UUID,
  p_field TEXT,
  p_amount INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'increment_money_tracker: amount must be non-negative (got %)', p_amount;
  END IF;

  IF p_field NOT IN ('total_saved', 'total_revenue_captured') THEN
    RAISE EXCEPTION 'increment_money_tracker: invalid field % (expected total_saved or total_revenue_captured)', p_field;
  END IF;

  -- Upsert: create row if missing, then increment on conflict.
  INSERT INTO money_tracker (
    account_id, total_saved, total_revenue_captured, total_actions_taken,
    saved_today, revenue_today, last_active_date, updated_at
  ) VALUES (
    p_account_id,
    CASE WHEN p_field = 'total_saved' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'total_revenue_captured' THEN p_amount ELSE 0 END,
    1,
    CASE WHEN p_field = 'total_saved' THEN p_amount ELSE 0 END,
    CASE WHEN p_field = 'total_revenue_captured' THEN p_amount ELSE 0 END,
    CURRENT_DATE,
    NOW()
  )
  ON CONFLICT (account_id) DO UPDATE SET
    total_saved = money_tracker.total_saved
      + CASE WHEN p_field = 'total_saved' THEN p_amount ELSE 0 END,
    total_revenue_captured = money_tracker.total_revenue_captured
      + CASE WHEN p_field = 'total_revenue_captured' THEN p_amount ELSE 0 END,
    total_actions_taken = money_tracker.total_actions_taken + 1,
    -- Reset today counters if the date rolled over, then add.
    saved_today = CASE
      WHEN money_tracker.last_active_date = CURRENT_DATE
        THEN money_tracker.saved_today
          + CASE WHEN p_field = 'total_saved' THEN p_amount ELSE 0 END
      ELSE CASE WHEN p_field = 'total_saved' THEN p_amount ELSE 0 END
    END,
    revenue_today = CASE
      WHEN money_tracker.last_active_date = CURRENT_DATE
        THEN money_tracker.revenue_today
          + CASE WHEN p_field = 'total_revenue_captured' THEN p_amount ELSE 0 END
      ELSE CASE WHEN p_field = 'total_revenue_captured' THEN p_amount ELSE 0 END
    END,
    last_active_date = CURRENT_DATE,
    updated_at = NOW();
END;
$$;

-- Service role + authenticated users can call. Row-level filtering still
-- applies via money_tracker's RLS policies (own_account_data).
GRANT EXECUTE ON FUNCTION increment_money_tracker(UUID, TEXT, INTEGER) TO authenticated, service_role;
