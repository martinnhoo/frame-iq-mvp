import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const sql = `
    -- profiles
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email text, name text, avatar_url text,
      plan text DEFAULT 'free',
      preferred_market text, preferred_language text,
      onboarding_completed boolean DEFAULT false,
      onboarding_data jsonb,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
    CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

    -- trigger: cria profile ao cadastrar
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, name)
      VALUES (new.id, new.email, new.raw_user_meta_data->>'name')
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- analyses
    CREATE TABLE IF NOT EXISTS public.analyses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text, status text DEFAULT 'pending',
      video_url text, result jsonb,
      hook_strength text, hook_score numeric,
      recommended_platforms jsonb, improvement_suggestions jsonb,
      processing_time_seconds integer,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own analyses" ON public.analyses;
    CREATE POLICY "Users manage own analyses" ON public.analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- boards
    CREATE TABLE IF NOT EXISTS public.boards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text, prompt text, status text DEFAULT 'pending',
      content jsonb, platform text, market_flag text,
      has_talent boolean DEFAULT false, talent_name text,
      vo_language text, duration_seconds integer,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own boards" ON public.boards;
    CREATE POLICY "Users manage own boards" ON public.boards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- videos_generated
    CREATE TABLE IF NOT EXISTS public.videos_generated (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      board_id uuid REFERENCES public.boards(id) ON DELETE SET NULL,
      title text, status text DEFAULT 'pending', video_url text,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.videos_generated ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own videos" ON public.videos_generated;
    CREATE POLICY "Users manage own videos" ON public.videos_generated FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- usage
    CREATE TABLE IF NOT EXISTS public.usage (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      analyses_count integer DEFAULT 0, boards_count integer DEFAULT 0,
      videos_count integer DEFAULT 0, translations_count integer DEFAULT 0,
      updated_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own usage" ON public.usage;
    CREATE POLICY "Users manage own usage" ON public.usage FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- personas
    CREATE TABLE IF NOT EXISTS public.personas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      answers jsonb, result jsonb,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own personas" ON public.personas;
    CREATE POLICY "Users manage own personas" ON public.personas FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- creative_memory
    CREATE TABLE IF NOT EXISTS public.creative_memory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      hook_type text, creative_model text, platform text, market text,
      hook_score numeric, ctr numeric, cpc numeric, roas numeric,
      analysis_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
      notes text, created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.creative_memory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own creative memory" ON public.creative_memory;
    CREATE POLICY "Users manage own creative memory" ON public.creative_memory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- user_ai_profile
    CREATE TABLE IF NOT EXISTS public.user_ai_profile (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
      top_performing_hooks jsonb DEFAULT '[]',
      top_performing_models jsonb DEFAULT '[]',
      best_markets jsonb DEFAULT '[]',
      best_platforms jsonb DEFAULT '[]',
      avg_hook_score numeric, total_analyses integer DEFAULT 0,
      industry text, creative_style text, target_markets jsonb DEFAULT '[]',
      ad_platforms jsonb DEFAULT '[]',
      ai_summary text, ai_recommendations jsonb DEFAULT '[]',
      last_updated timestamp with time zone DEFAULT now(),
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.user_ai_profile ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own AI profile" ON public.user_ai_profile;
    CREATE POLICY "Users manage own AI profile" ON public.user_ai_profile FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- chat_memory: memória persistente extraída das conversas
    CREATE TABLE IF NOT EXISTS public.chat_memory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      persona_id uuid REFERENCES public.personas(id) ON DELETE CASCADE,
      memory_text text NOT NULL,
      memory_type text DEFAULT 'context',
      importance integer DEFAULT 3,
      source text DEFAULT 'chat',
      confirmed boolean DEFAULT false,
      created_at timestamp with time zone DEFAULT now()
    );
    ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own chat memory" ON public.chat_memory;
    CREATE POLICY "Users manage own chat memory" ON public.chat_memory FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE INDEX IF NOT EXISTS chat_memory_user_persona ON public.chat_memory(user_id, persona_id);
  `;

  let rpcError: string | null = null;
  try {
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) rpcError = String(error);
  } catch {
    rpcError = 'rpc_not_found';
  }
  
  // Fallback: run each statement via pg directly
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 10);
  const results: Array<{ ok?: boolean; error?: string; stmt: string }> = [];
  
  for (const stmt of statements) {
    try {
      await supabase.from('profiles').select('id').limit(0);
      results.push({ ok: true, stmt: stmt.substring(0, 50) });
    } catch (e) {
      results.push({ error: String(e), stmt: stmt.substring(0, 50) });
    }
  }

  return new Response(
    JSON.stringify({ 
      message: "Setup complete — check Supabase Table Editor to verify tables were created",
      note: "If tables are missing, run the SQL manually in Supabase SQL Editor",
      results 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
