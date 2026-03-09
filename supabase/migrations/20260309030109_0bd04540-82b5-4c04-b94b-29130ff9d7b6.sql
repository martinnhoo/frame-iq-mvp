CREATE TABLE public.signup_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access needed - only edge function with service role accesses this
CREATE POLICY "No public access"
ON public.signup_rate_limits
FOR ALL
TO anon, authenticated
USING (false);

-- Index for fast IP lookups
CREATE INDEX idx_signup_rate_limits_ip_created ON public.signup_rate_limits (ip_address, created_at DESC);

-- Auto-cleanup old entries (older than 24h)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.signup_rate_limits
  WHERE created_at < now() - interval '24 hours';
$$;