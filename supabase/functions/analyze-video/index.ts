import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  video_file: File;
  market: string;
  campaign_goal?: string;
  notes?: string;
  user_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const videoFile = formData.get('video_file') as File;
    const market = formData.get('market') as string;
    const campaign_goal = formData.get('campaign_goal') as string | null;
    const notes = formData.get('notes') as string | null;
    const user_id = formData.get('user_id') as string;

    // Pre-flight: Validate file
    if (!videoFile) {
      return new Response(
        JSON.stringify({ error: 'No video file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
    if (!allowedTypes.includes(videoFile.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Allowed: MP4, MOV, AVI, MKV, WebM' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxSize = 500 * 1024 * 1024; // 500MB
    if (videoFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size: 500MB' }),
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
      .select('analyses_count')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    const limits = { free: 3, studio: 30, scale: 500 };
    const plan = profile?.plan || 'free';
    const usageCount = usage?.analyses_count || 0;

    if (usageCount >= limits[plan as keyof typeof limits]) {
      return new Response(
        JSON.stringify({ 
          error: 'limit_reached', 
          plan,
          message: `You've reached your ${plan} plan limit of ${limits[plan as keyof typeof limits]} analyses this month.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1 — Extract audio (MOCK)
    // TODO: Uncomment when OPENAI_API_KEY is available:
    /*
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    
    const transcription = await openai.audio.transcriptions.create({
      file: videoFile,
      model: 'whisper-1',
      response_format: 'verbose_json'
    });
    */

    // MOCK transcription
    const transcription = {
      text: 'Mock transcript — connect OpenAI API key to enable real transcription. This is a sample of what would be extracted from your video.',
      language: 'en',
      duration: 30
    };

    // Step 2 — Analyze with Claude (MOCK)
    // TODO: Uncomment when ANTHROPIC_API_KEY is available:
    /*
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are a creative intelligence analyst for performance marketing. 
        Analyze this video transcript and return ONLY valid JSON with this structure:
        {
          creative_model: "ugc|testimonial|tutorial|promo|react|slideshow|general",
          visual_hook: "what happens in first 3 seconds",
          audio_hook: "exact words in first 3 seconds",
          brief: "2-3 sentences on creative strategy",
          engagement_score: 1-10,
          language_detected: "language code",
          market_guess: "country code",
          hook_strength: "low|medium|high|viral",
          recommended_platforms: ["platform1", "platform2"],
          improvement_suggestions: ["suggestion1", "suggestion2", "suggestion3"]
        }`,
      messages: [{ 
        role: 'user', 
        content: transcription.text 
      }]
    });
    
    const analysis = JSON.parse(response.content[0].text);
    */

    // MOCK analysis
    const analysis = {
      creative_model: 'UGC',
      visual_hook: 'Creator holds product directly to camera with confident smile',
      audio_hook: 'Mock hook — connect ANTHROPIC_API_KEY to analyze real content',
      brief: 'This appears to be a UGC-style product demonstration following the problem-solution narrative arc. The creator establishes trust through direct eye contact and authentic delivery.',
      engagement_score: 7,
      language_detected: transcription.language,
      market_guess: market || 'US',
      hook_strength: 'medium',
      recommended_platforms: ['reels', 'tiktok', 'youtube_shorts'],
      improvement_suggestions: [
        'Add API keys to see real AI-powered suggestions',
        'Connect OPENAI_API_KEY for transcription',
        'Connect ANTHROPIC_API_KEY for creative analysis'
      ]
    };

    // Save to analyses table
    const { data: analysisRecord, error: insertError } = await supabaseClient
      .from('analyses')
      .insert({
        user_id,
        status: 'completed',
        title: videoFile.name,
        video_url: null, // Would be storage URL in production
        result: analysis,
        hook_strength: analysis.hook_strength,
        recommended_platforms: analysis.recommended_platforms,
        improvement_suggestions: analysis.improvement_suggestions,
        video_duration_seconds: Math.round(transcription.duration),
        file_size_mb: Number((videoFile.size / (1024 * 1024)).toFixed(2)),
        processing_time_seconds: 2
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
        analyses_count: usageCount + 1
      }, {
        onConflict: 'user_id,period'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysisRecord,
        mock_mode: true,
        message: 'Analysis completed using mock data. Add OPENAI_API_KEY and ANTHROPIC_API_KEY to enable real AI processing.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-video:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
