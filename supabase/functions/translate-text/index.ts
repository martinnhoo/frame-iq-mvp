import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { source_text, from_language, to_language, tone, context, user_id } = await req.json();

    if (!source_text || !to_language || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: source_text, to_language, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check usage limits
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan')
      .eq('id', user_id)
      .single();

    const { data: usage } = await supabaseClient
      .from('usage')
      .select('translations_count')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    const limits = { free: 10, studio: 100, scale: 1000 };
    const plan = profile?.plan || 'free';
    const usageCount = usage?.translations_count || 0;

    if (usageCount >= limits[plan as keyof typeof limits]) {
      return new Response(
        JSON.stringify({ 
          error: 'limit_reached', 
          plan,
          message: `You've reached your ${plan} plan limit of ${limits[plan as keyof typeof limits]} translations this month.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: Uncomment when ANTHROPIC_API_KEY is available:
    /*
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    
    const systemPrompt = `You are an expert translator specializing in marketing and advertising copy.
      Translate the following text from ${from_language || 'auto-detected language'} to ${to_language}.
      ${tone ? `Tone: ${tone}` : ''}
      ${context ? `Context: ${context}` : ''}
      
      Preserve:
      - Marketing impact and persuasive elements
      - Cultural nuances and idioms (adapt when necessary)
      - Brand voice and tone
      - Call-to-action strength
      
      Return ONLY the translated text, no explanations.`;
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ 
        role: 'user', 
        content: source_text 
      }]
    });
    
    const translated_text = response.content[0].text;
    */

    // MOCK translation
    const translated_text = `${source_text} (translated to ${to_language} — connect ANTHROPIC_API_KEY for real translation)`;

    // Save to translations table
    const { data: translationRecord, error: insertError } = await supabaseClient
      .from('translations')
      .insert({
        user_id,
        source_text,
        translated_text,
        from_language: from_language || 'auto',
        to_language,
        tone: tone || null,
        context: context || null,
        character_count: source_text.length
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Increment usage count
    await supabaseClient
      .from('usage')
      .upsert({
        user_id,
        period: currentPeriod,
        translations_count: usageCount + 1
      }, {
        onConflict: 'user_id,period'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        translation: translationRecord,
        mock_mode: true,
        message: 'Translation completed using mock data. Add ANTHROPIC_API_KEY to enable real AI translation.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in translate-text:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
