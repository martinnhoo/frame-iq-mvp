-- Re-create the SELECT RLS policy dropped by the previous security migration
CREATE POLICY "Users read own connections"
  ON public.platform_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Add DELETE policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'platform_connections' AND policyname = 'Users delete own connections'
  ) THEN
    EXECUTE 'CREATE POLICY "Users delete own connections" ON public.platform_connections FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;