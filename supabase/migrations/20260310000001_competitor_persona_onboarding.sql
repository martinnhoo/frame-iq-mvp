-- competitor_trackers table
CREATE TABLE IF NOT EXISTS public.competitor_trackers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  market text NOT NULL DEFAULT 'GLOBAL',
  platform text NOT NULL DEFAULT 'Meta',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_trackers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitors"
ON public.competitor_trackers
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- personas table
CREATE TABLE IF NOT EXISTS public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb,
  result jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personas"
ON public.personas
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add onboarding_data column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'onboarding_data'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_data jsonb;
  END IF;
END $$;
