-- Fix: chat_memory and chat_examples RLS policies

-- chat_memory
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat memory" ON public.chat_memory;
CREATE POLICY "Users manage own chat memory"
  ON public.chat_memory
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access chat_memory" ON public.chat_memory;
CREATE POLICY "Service role full access chat_memory"
  ON public.chat_memory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- chat_examples
ALTER TABLE public.chat_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat examples" ON public.chat_examples;
CREATE POLICY "Users manage own chat examples"
  ON public.chat_examples
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access chat_examples" ON public.chat_examples;
CREATE POLICY "Service role full access chat_examples"
  ON public.chat_examples
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);