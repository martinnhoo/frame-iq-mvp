-- Fix platform_connections to be scoped per user + platform + persona_id
-- This ensures each account (persona) has its own isolated Meta connection

-- First, drop the old unique constraint if it exists
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_user_id_platform_key;

-- Add new unique constraint scoped to user + platform + persona_id
-- persona_id NULL = global user connection (no account selected)
ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_user_platform_persona_key
  UNIQUE (user_id, platform, persona_id);

-- Enable RLS
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own connections
DROP POLICY IF EXISTS "Users see own connections" ON platform_connections;
CREATE POLICY "Users see own connections"
  ON platform_connections FOR ALL
  USING (auth.uid() = user_id);
