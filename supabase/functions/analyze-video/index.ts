import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const videoFile = formData.get('video_file') as File | null;
    const videoUrl = formData.get('video_url') as string | null;
    const market = (formData.get('market') as string) || 'GLOBAL';
    const campaign_goal = formData.get('campaign_goal') as string | null;
    const user_id = formData.get('user_id') as string;
    const analysis_id = formData.get('analysis_id') as string;
    const title = formData.get('title') as string;

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!ANTHROPIC_API_KEY) {
      // Update record to failed state
      await supabase.from('analyses').update({
        status: 'failed',
        result: { error: 'API key not configured' }
      }).eq('id', analysis_id);

      return new Response(JSON.stringify({ 
        error: 'api_key_missing',
        message: 'ANTHROPIC_API_KEY not configured in Supabase Secrets'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();

    // Step 1 — Transcribe audio if file provided
    let transcript = '';
    let duration = 30;

    if (videoFile && OPENAI_API_KEY) {
      try {
        const whisperForm = new FormData();
        whisperForm.append('file', videoFile, videoFile.name || 'video.mp4');
        whisperForm.append('model', 'whisper-1');
        whisperForm.append('response_format', 'verbose_json');

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: whisperForm,
        });

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          transcript = whisperData.text || '';
          duration = Math.round(whisperData.duration || 30);
        }
      } catch (e) {
        console.error('Whisper error:', e);
        transcript = '[Audio transcription failed — analyzing visual context only]';
      }
    } else if (videoUrl) {
      transcript = `[Video from URL: ${videoUrl} — analyzing from URL context]`;
    }

    // Step 2 — Analyze with Claude
    const prompt = `You are a world-class creative intelligence analyst for performance marketing.

Analyze this video ad and return ONLY valid JSON (no markdown, no explanation) with this exact structure:

{
  "creative_model": "UGC|Testimonial|Tutorial|Problem-Solution|Before-After|Promo|React|Slideshow|Demo|Talking-Head",
  "visual_hook": "What happens visually in the first 3 seconds",
  "audio_hook": "Exact words or sounds in the first 3 seconds",
  "hook_score": <number 1-10>,
  "hook_strength": "low|medium|high|viral",
  "brief": "2-3 sentence creative strategy breakdown",
  "summary": "One paragraph full analysis of what makes this ad work or not",
  "language_detected": "<language code>",
  "market_guess": "<country code>",
  "format": "<vertical|horizontal|square>",
  "pacing": "slow|medium|fast|very_fast",
  "tone": "emotional|humorous|aggressive|soft|educational|inspirational",
  "cta_type": "verbal|text|both|none",
  "recommended_platforms": ["platform1", "platform2"],
  "improvement_suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "hook_type": "curiosity|social_proof|pattern_interrupt|direct_offer|emotional|question|statement"
}

Market context: ${market}
Campaign goal: ${campaign_goal || 'conversions'}
Transcript: ${transcript || '[No transcript available]'}
${videoUrl ? `Video URL: ${videoUrl}` : ''}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error: ${claudeRes.status} ${err}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{}';
    const clean = rawText.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    // Save result
    await supabase.from('analyses').update({
      status: 'completed',
      result: analysis,
      hook_strength: analysis.hook_strength,
      hook_score: analysis.hook_score,
      recommended_platforms: analysis.recommended_platforms,
      improvement_suggestions: analysis.improvement_suggestions,
      processing_time_seconds: processingTime,
    }).eq('id', analysis_id);

    // Increment usage
    const { data: currentUsage } = await supabase
      .from('usage')
      .select('analyses_count')
      .eq('user_id', user_id)
      .single();

    await supabase.from('usage').upsert({
      user_id,
      analyses_count: (currentUsage?.analyses_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    // Save to creative_memory for AI learning
    await supabase.from('creative_memory').insert({
      user_id,
      analysis_id,
      hook_type: analysis.hook_type,
      creative_model: analysis.creative_model,
      platform: analysis.recommended_platforms?.[0] || null,
      market: analysis.market_guess || market,
      hook_score: analysis.hook_score,
    }).catch(() => {});

    // Trigger AI profile update (non-blocking)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    fetch(`${supabaseUrl}/functions/v1/update-ai-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ user_id, trigger: 'analysis_completed' }),
    }).catch(() => {});

    return new Response(JSON.stringify({ 
      success: true, 
      analysis_id,
      mock_mode: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('analyze-video error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
