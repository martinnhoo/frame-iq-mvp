-- AI Cost Cap: hard safety guard against runaway Anthropic spend.
--
-- Distinct from the "credit" system (which is abstract user-facing currency).
-- This tracks REAL USD spent per user per day and enforces a hard cap to protect
-- the Anthropic account from going to zero unexpectedly.

CREATE TABLE IF NOT EXISTS public.ai_cost_daily (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  spent_usd  NUMERIC(12,6) NOT NULL DEFAULT 0,
  call_count INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS ai_cost_daily_date_idx ON public.ai_cost_daily (date DESC);

COMMENT ON TABLE public.ai_cost_daily IS
  'Real USD spent per user per day across all Anthropic/AI calls. Used to enforce hard daily cost caps.';

-- Per-plan daily USD cap. Overridable per user via user_ai_profile.daily_usd_cap (optional future column).
CREATE TABLE IF NOT EXISTS public.ai_cost_config (
  plan          TEXT PRIMARY KEY,
  daily_usd_cap NUMERIC(10,4) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_cost_config (plan, daily_usd_cap) VALUES
  ('free',   0.10),
  ('maker',  0.75),
  ('pro',    2.00),
  ('studio', 6.00)
ON CONFLICT (plan) DO NOTHING;

-- RLS
ALTER TABLE public.ai_cost_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_config ENABLE ROW LEVEL SECURITY;

-- Users can read their own cost rows (for the dashboard)
DROP POLICY IF EXISTS ai_cost_daily_read_own ON public.ai_cost_daily;
CREATE POLICY ai_cost_daily_read_own ON public.ai_cost_daily
  FOR SELECT
  USING (auth.uid() = user_id);

-- Config is public-read (so clients can surface "you've used 80% of today's cap")
DROP POLICY IF EXISTS ai_cost_config_read ON public.ai_cost_config;
CREATE POLICY ai_cost_config_read ON public.ai_cost_config
  FOR SELECT
  USING (true);

-- Service role only for writes (edge functions use service key)
-- No INSERT/UPDATE/DELETE policies → RLS blocks authenticated users by default.
