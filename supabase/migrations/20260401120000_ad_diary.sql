-- ad_diary: stores enriched ad performance entries per account
-- Auto-populated by the sync-ad-diary edge function
CREATE TABLE IF NOT EXISTS public.ad_diary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'meta' | 'google'

  -- Ad identity
  ad_id text NOT NULL,
  ad_name text,
  campaign_name text,
  adset_name text,

  -- Lifecycle
  status text, -- 'active' | 'paused' | 'deleted' | 'archived'
  launched_at date,
  paused_at date,
  days_running integer,

  -- Performance
  spend numeric(12,2) DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  ctr numeric(8,6) DEFAULT 0,
  cpc numeric(10,4) DEFAULT 0,
  conversions numeric(10,2) DEFAULT 0,
  conv_value numeric(12,2) DEFAULT 0,
  roas numeric(8,4),
  frequency numeric(6,2),

  -- Classification (computed)
  verdict text, -- 'winner' | 'loser' | 'testing' | 'scaled'
  verdict_reason text,

  -- Snapshots
  peak_ctr numeric(8,6),
  peak_date date,

  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, persona_id, platform, ad_id)
);

ALTER TABLE public.ad_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own diary" ON public.ad_diary FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS ad_diary_user_persona ON public.ad_diary(user_id, persona_id, synced_at DESC);
