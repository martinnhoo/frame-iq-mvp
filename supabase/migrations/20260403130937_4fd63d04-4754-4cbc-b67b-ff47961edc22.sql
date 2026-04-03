ALTER TABLE public.creative_entries ADD COLUMN IF NOT EXISTS persona_id uuid;
ALTER TABLE public.daily_snapshots ADD COLUMN IF NOT EXISTS avg_roas numeric DEFAULT 0;