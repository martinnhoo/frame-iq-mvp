-- Add share_id to demo_leads for shareable URLs
ALTER TABLE demo_leads ADD COLUMN IF NOT EXISTS share_id text UNIQUE;

-- Create index for fast lookups by share_id
CREATE INDEX IF NOT EXISTS idx_demo_leads_share_id
ON demo_leads (share_id);
