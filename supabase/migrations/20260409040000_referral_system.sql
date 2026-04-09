-- Referral system: share code → both get +10 bonus analyses
-- referral_codes: one code per user, auto-generated on first dashboard visit
-- referral_claims: tracks who claimed whose code

-- Add referral columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS referral_bonus_analyses integer DEFAULT 0;

-- Index for fast referral code lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
ON profiles (referral_code) WHERE referral_code IS NOT NULL;

-- Referral claims log (for leaderboard + anti-abuse)
CREATE TABLE IF NOT EXISTS referral_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id),
  referee_id uuid NOT NULL REFERENCES profiles(id),
  bonus_granted integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  UNIQUE(referee_id) -- each user can only be referred once
);

-- Index for leaderboard queries (count claims per referrer)
CREATE INDEX IF NOT EXISTS idx_referral_claims_referrer
ON referral_claims (referrer_id, created_at);

-- RLS
ALTER TABLE referral_claims ENABLE ROW LEVEL SECURITY;

-- Users can read their own claims (as referrer)
CREATE POLICY "Users can read own referral claims"
ON referral_claims FOR SELECT
USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- Only service role inserts (edge function)
-- No public insert policy needed

-- Function to generate a unique 8-char referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text AS $$
DECLARE
  new_code text;
  exists_count integer;
BEGIN
  LOOP
    -- Generate 8 uppercase alphanumeric chars
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT count(*) INTO exists_count FROM profiles WHERE referral_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Auto-assign referral codes to existing users who don't have one
UPDATE profiles
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Trigger to auto-assign referral code on new user creation
CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON profiles;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_referral_code();
