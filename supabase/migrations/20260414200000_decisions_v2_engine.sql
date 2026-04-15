-- Extend decisions table for v2 engine (patterns, insights, nullable ad_id)

-- 1. Allow NULL ad_id (pattern/insight decisions don't reference a specific ad)
ALTER TABLE decisions ALTER COLUMN ad_id DROP NOT NULL;

-- 2. Drop and recreate type check to include 'pattern'
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_type_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_type_check
  CHECK (type IN ('kill', 'fix', 'scale', 'pattern', 'alert', 'insight'));

-- 3. Drop and recreate impact_type check to include 'learning'
ALTER TABLE decisions DROP CONSTRAINT IF EXISTS decisions_impact_type_check;
ALTER TABLE decisions ADD CONSTRAINT decisions_impact_type_check
  CHECK (impact_type IN ('waste', 'savings', 'revenue', 'learning'));

-- 4. Add metrics_snapshot column if not exists (legacy engine used this name)
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS metrics_snapshot JSONB DEFAULT '{}';

-- 5. Make access_token_encrypted nullable on ad_accounts (bridge populates it)
ALTER TABLE ad_accounts ALTER COLUMN access_token_encrypted DROP NOT NULL;
