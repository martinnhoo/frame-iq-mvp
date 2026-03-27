-- ── Atomic usage increment to prevent race conditions ──────────────────────
-- Replaces the read-then-write pattern in adbrief-ai-chat with a single
-- atomic operation that increments AND enforces the daily cap in one shot.
-- Returns: { allowed: bool, daily_count: int, monthly_count: int }

CREATE OR REPLACE FUNCTION increment_chat_usage(
  p_user_id   uuid,
  p_daily_cap integer,
  p_today     text,   -- YYYY-MM-DD
  p_month_key text    -- YYYY-MM
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_daily   integer := 0;
  v_monthly integer := 0;
BEGIN
  -- Upsert row, resetting counts when date/month rolls over, then atomically increment
  INSERT INTO free_usage (user_id, chat_count, last_reset, monthly_msg_count, monthly_reset)
  VALUES (p_user_id, 1, p_today, 1, p_month_key)
  ON CONFLICT (user_id) DO UPDATE SET
    -- Reset daily counter if date changed
    chat_count        = CASE
                          WHEN free_usage.last_reset = p_today
                          THEN free_usage.chat_count + 1
                          ELSE 1
                        END,
    last_reset        = p_today,
    -- Reset monthly counter if month changed
    monthly_msg_count = CASE
                          WHEN free_usage.monthly_reset = p_month_key
                          THEN free_usage.monthly_msg_count + 1
                          ELSE 1
                        END,
    monthly_reset     = p_month_key
  RETURNING
    chat_count,
    monthly_msg_count
  INTO v_daily, v_monthly;

  -- If daily cap exceeded, undo the increment and return not allowed
  IF v_daily > p_daily_cap THEN
    UPDATE free_usage
    SET chat_count = p_daily_cap
    WHERE user_id = p_user_id AND last_reset = p_today;

    RETURN jsonb_build_object(
      'allowed', false,
      'daily_count', p_daily_cap,
      'monthly_count', v_monthly
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'daily_count', v_daily,
    'monthly_count', v_monthly
  );
END;
$$;

-- Grant execute to service role (edge functions use service role key)
GRANT EXECUTE ON FUNCTION increment_chat_usage(uuid, integer, text, text) TO service_role;
