CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  company_size text,
  monthly_ad_spend text,
  creative_volume text,
  main_challenge text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert demo requests"
ON public.demo_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "No public read access"
ON public.demo_requests
FOR SELECT
TO authenticated
USING (false);