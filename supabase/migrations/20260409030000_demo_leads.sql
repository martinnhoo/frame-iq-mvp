-- demo_leads: capture emails from pre-signup ad analysis demo
CREATE TABLE IF NOT EXISTS demo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address text,
  analysis_score integer DEFAULT 0,
  analysis_result jsonb DEFAULT '{}'::jsonb,
  lang text DEFAULT 'en',
  converted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for rate limiting by IP
CREATE INDEX IF NOT EXISTS idx_demo_leads_ip_created
ON demo_leads (ip_address, created_at);

-- Index for email follow-up
CREATE INDEX IF NOT EXISTS idx_demo_leads_email
ON demo_leads (email) WHERE email IS NOT NULL;

-- RLS: service role only (edge function uses service role key)
ALTER TABLE demo_leads ENABLE ROW LEVEL SECURITY;

-- No public policies — only service role can insert/read
