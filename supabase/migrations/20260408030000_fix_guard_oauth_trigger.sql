-- FIX: guard_oauth_token_columns usava current_setting('role') que não funciona
-- com service_role JWT de edge functions. A verificação correta é current_user.
--
-- Comportamento correto:
--   - service_role (edge functions): pode escrever access_token/refresh_token
--   - authenticated/anon (client): tokens revertidos para OLD (protegidos)

CREATE OR REPLACE FUNCTION public.guard_oauth_token_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- auth.role() returns 'service_role' when called via service_role JWT (edge functions)
  -- auth.role() returns 'authenticated' for logged-in users
  -- current_user fallback covers direct postgres connections
  IF auth.role() NOT IN ('service_role') AND current_user NOT IN ('supabase_admin', 'postgres', 'service_role') THEN
    NEW.access_token  := OLD.access_token;
    NEW.refresh_token := OLD.refresh_token;
  END IF;
  RETURN NEW;
END;
$$;

-- Recriar trigger (função já foi substituída acima, trigger permanece)
DROP TRIGGER IF EXISTS guard_oauth_token_columns ON public.platform_connections;
CREATE TRIGGER guard_oauth_token_columns
  BEFORE UPDATE ON public.platform_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_oauth_token_columns();
