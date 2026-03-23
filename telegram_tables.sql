-- Run this in Lovable SQL Editor

-- Telegram connections (1 per user)
CREATE TABLE IF NOT EXISTS telegram_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  chat_id text NOT NULL,
  telegram_username text,
  telegram_first_name text,
  active boolean DEFAULT true,
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram_connections_user" ON telegram_connections FOR ALL USING (auth.uid() = user_id);

-- Pairing tokens (short-lived, 10 min)
CREATE TABLE IF NOT EXISTS telegram_pairing_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE telegram_pairing_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram_tokens_user" ON telegram_pairing_tokens FOR ALL USING (auth.uid() = user_id);

-- Add telegram_sent_at to account_alerts if not exists
ALTER TABLE account_alerts ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz;

-- Cleanup job: delete expired tokens (optional, cron can do this)
-- DELETE FROM telegram_pairing_tokens WHERE expires_at < now();
