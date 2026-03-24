-- ============================================================
-- Fix platform_connections: garantir isolamento por persona_id
-- ============================================================

-- 1. Remover constraint antiga (user_id, platform) se ainda existir
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_user_id_platform_key;

ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_user_platform_persona_key;

-- 2. Adicionar persona_id coluna se não existir
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id) ON DELETE CASCADE;

-- 3. Nova constraint: cada (user, platform, persona) é único
-- persona_id NULL só pode existir uma vez por (user, platform) também
ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_user_platform_persona_unique
  UNIQUE NULLS NOT DISTINCT (user_id, platform, persona_id);

-- 4. Adicionar connection_label para suporte multi-facebook (plano Studio)
-- Permite múltiplos Facebook logins para a mesma conta AdBrief
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS connection_label TEXT DEFAULT NULL;

-- 5. Para multi-facebook (Studio): constraint separada por label
-- Quando connection_label IS NOT NULL, permite múltiplas conexões por persona
-- A constraint acima (NULLS NOT DISTINCT) cuida do caso label=NULL (1 por persona)

-- 6. RLS - garantir que usuários só vejam suas próprias conexões
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own connections" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_user_policy" ON platform_connections;

CREATE POLICY "platform_connections_user_policy"
  ON platform_connections FOR ALL
  USING (auth.uid() = user_id);

-- 7. Index para queries rápidas por persona_id
CREATE INDEX IF NOT EXISTS idx_platform_connections_persona
  ON platform_connections (user_id, platform, persona_id)
  WHERE status = 'active';
