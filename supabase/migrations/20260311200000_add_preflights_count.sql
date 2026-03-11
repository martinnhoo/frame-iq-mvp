-- Add preflights_count column to usage table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'usage'
    AND column_name = 'preflights_count'
  ) THEN
    ALTER TABLE public.usage ADD COLUMN preflights_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
