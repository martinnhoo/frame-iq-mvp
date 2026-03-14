
-- Creative entries: each creative tracked with parsed metadata + performance data
CREATE TABLE public.creative_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  creative_type TEXT,
  market TEXT,
  editor TEXT,
  date_code TEXT,
  talent TEXT,
  client TEXT,
  aspect_ratio TEXT,
  version TEXT,
  platform TEXT,
  hook_type TEXT,
  hook_angle TEXT,
  audience_temp TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  ctr NUMERIC,
  cpc NUMERIC,
  cpm NUMERIC,
  roas NUMERIC,
  conversions INTEGER DEFAULT 0,
  thumb_stop_rate NUMERIC,
  hold_rate NUMERIC,
  source TEXT DEFAULT 'manual',
  import_batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.creative_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own creative entries"
  ON public.creative_entries FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Learned patterns: AI-discovered winning combinations
CREATE TABLE public.learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pattern_key TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  avg_ctr NUMERIC,
  avg_cpc NUMERIC,
  avg_roas NUMERIC,
  avg_thumb_stop NUMERIC,
  sample_size INTEGER DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  is_winner BOOLEAN DEFAULT false,
  insight_text TEXT,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learned_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own learned patterns"
  ON public.learned_patterns FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Nomenclature config: customizable filename parsing pattern
CREATE TABLE public.nomenclature_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  separator TEXT DEFAULT '-',
  fields JSONB NOT NULL DEFAULT '[{"position":0,"name":"type","label":"Creative Type"},{"position":1,"name":"market","label":"Market"},{"position":2,"name":"editor","label":"Editor"},{"position":3,"name":"date","label":"Date Code"},{"position":4,"name":"talent","label":"Talent/Model"},{"position":5,"name":"client","label":"Client"},{"position":6,"name":"ratio","label":"Aspect Ratio"},{"position":7,"name":"version","label":"Version"}]',
  example_filename TEXT DEFAULT 'UGC-BR-JD-260314-MT-ACME-9v16-01',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nomenclature_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own nomenclature config"
  ON public.nomenclature_config FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Predictive scores: cached predictions for briefs/scripts
CREATE TABLE public.predictive_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creative_hash TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}',
  predicted_ctr NUMERIC,
  predicted_roas NUMERIC,
  confidence NUMERIC DEFAULT 0,
  score INTEGER DEFAULT 0,
  reasoning TEXT,
  patterns_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.predictive_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own predictive scores"
  ON public.predictive_scores FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
