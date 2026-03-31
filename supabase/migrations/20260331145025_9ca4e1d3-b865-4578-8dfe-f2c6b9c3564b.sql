
-- Revoke column-level access to sensitive token columns
-- First grant SELECT on all columns, then revoke on sensitive ones
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.platform_connections FROM anon;
