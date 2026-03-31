-- Fix: restore access_token and refresh_token access for service_role
-- The previous migration revoked column access for authenticated/anon (correct)
-- but GRANT needs to be explicit for service_role on those columns

GRANT SELECT (access_token, refresh_token) ON public.platform_connections TO service_role;

-- Also ensure service_role has full table access (bypasses RLS by default, but be explicit)
GRANT ALL ON public.platform_connections TO service_role;
