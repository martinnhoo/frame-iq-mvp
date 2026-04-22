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

ALTER TABLE public.ai_cost_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cost_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_cost_daily_read_own ON public.ai_cost_daily;
CREATE POLICY ai_cost_daily_read_own ON public.ai_cost_daily
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_cost_config_read ON public.ai_cost_config;
CREATE POLICY ai_cost_config_read ON public.ai_cost_config
  FOR SELECT
  USING (true);