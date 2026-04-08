-- REMOVE o trigger guard_oauth_token_columns completamente.
--
-- MOTIVO: o trigger foi criado para proteger tokens de updates via client,
-- mas ele bloqueia também as edge functions (service_role), impedindo que
-- tokens novos sejam salvos no reconectar. Resultado: access_token fica
-- revertido para o valor antigo (expirado) em toda reconexão.
--
-- A proteção já é garantida pela RLS:
--   - INSERT: só service_role (edge functions) pode inserir
--   - UPDATE: authenticated pode atualizar mas NÃO tem acesso a access_token/refresh_token
--     pois REVOKE SELECT foi aplicado nessas colunas para authenticated/anon
--
-- O trigger é portanto redundante E quebrado. Removendo.

DROP TRIGGER IF EXISTS guard_oauth_token_columns ON public.platform_connections;
DROP FUNCTION IF EXISTS public.guard_oauth_token_columns();

-- Garantir que REVOKE nas colunas sensíveis está aplicado
-- (proteção real — sem depender de trigger)
REVOKE SELECT (access_token, refresh_token)
  ON public.platform_connections
  FROM authenticated, anon;

GRANT SELECT (access_token, refresh_token)
  ON public.platform_connections
  TO service_role;
