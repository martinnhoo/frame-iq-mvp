-- Table for imported ad platform data (Meta, Google, TikTok CSV exports)
CREATE TABLE IF NOT EXISTS ads_data_imports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform    text NOT NULL DEFAULT 'unknown',
  filename    text,
  date_range  text,
  total_ads   integer,
  total_spend numeric,
  currency    text DEFAULT 'USD',
  result      jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE ads_data_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own imports"
  ON ads_data_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imports"
  ON ads_data_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own imports"
  ON ads_data_imports FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_ads_data_imports_user_id ON ads_data_imports(user_id);
CREATE INDEX idx_ads_data_imports_created_at ON ads_data_imports(created_at DESC);
