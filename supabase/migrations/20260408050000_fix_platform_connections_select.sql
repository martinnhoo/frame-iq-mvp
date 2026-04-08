-- FIX: authenticated users precisam de SELECT na tabela raw para que
-- platform_connections_safe (security_invoker=true) funcione.
--
-- A migration 20260401220000 removeu o SELECT policy para authenticated,
-- mas a view com security_invoker=true herda as políticas da tabela base.
-- Sem SELECT policy, a view retorna vazio → connections=[] → LivePanel nunca aparece.
--
-- Solução: recriar SELECT policy para authenticated (sem colunas de token —
-- access_token e refresh_token já têm REVOKE SELECT FROM authenticated).

DROP POLICY IF EXISTS "platform_connections_select" ON public.platform_connections;

CREATE POLICY "platform_connections_select"
  ON public.platform_connections
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- access_token e refresh_token continuam protegidos pelo REVOKE no nível de coluna
-- Authenticated pode ver as outras colunas (platform, status, persona_id, etc.)
-- mas NÃO pode ver os tokens mesmo com SELECT policy ativa
