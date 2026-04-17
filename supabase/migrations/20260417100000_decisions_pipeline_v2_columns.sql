-- Add pipeline v2 columns to decisions table
-- These columns store the output of the financial filter, safety layer, and data confidence scoring.

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS pipeline_approved boolean;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS financial_verdict text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS break_even_roas numeric;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS margin_of_safety numeric;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS risk_level text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS data_confidence numeric;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS confidence_gate text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS safety_status text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS cooldown_active boolean DEFAULT false;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS gradual_step integer;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS rollback_plan text;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS explanation_chain jsonb;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS pipeline_mode text DEFAULT 'v1';
