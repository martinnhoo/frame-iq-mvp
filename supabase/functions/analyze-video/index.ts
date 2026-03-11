import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  let analysisId: string | null = null;

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
    analysisId = (formData.get('analysis_id') as string | null) ?? null;
    const title = formData.get('title') as string;
    const transcribe_only = formData.get('transcribe_only') === 'true';

    console.log('analyze-video called:', { 
      hasFile: !!videoFile, 
      fileSize: videoFile?.size, 
      fileName: videoFile?.name,
      transcribe_only, 
      hasVideoUrl: !!videoUrl 
    });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const startTime = Date.now();

    // ── Step 1: Transcribe audio ──────────────────────────────────────────
    let transcript = '';
    let duration = 30;

    if (videoFile && OPENAI_API_KEY) {
      try {
        console.log('Whisper: starting transcription, file size:', videoFile.size, 'name:', videoFile.name);
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
          console.log('Whisper: success, transcript length:', transcript.length, 'duration:', duration);
        } else {
          const errText = await whisperRes.text();
          console.error('Whisper API error:', whisperRes.status, errText);
          transcript = '[Audio transcription failed — Whisper API error]';
        }
      } catch (e) {
        console.error('Whisper error:', e);
        transcript = '[Audio transcription failed — analyzing visual context only]';
      }
    } else if (videoUrl) {
      transcript = `[Video from URL: ${videoUrl} — analyzing from URL context]`;
    }

    // ── Transcribe-only mode ──────────────────────────────────────────────
    if (transcribe_only) {
      if (!transcript || transcript.startsWith('[')) {
        const reason = !OPENAI_API_KEY 
          ? 'OPENAI_API_KEY not configured' 
          : !videoFile 
            ? 'No video file received' 
            : `Whisper failed: ${transcript}`;
        console.error('transcribe_only failed:', reason);
        return new Response(JSON.stringify({ 
          error: 'transcription_failed',
          transcript: '',
          message: reason
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ 
        success: true, transcript, duration,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Rate limit check ──
    if (user_id) {
      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user_id).single();
      const { data: rateCheck } = await supabase.rpc('check_and_increment_ai_usage', { p_user_id: user_id, p_plan: profile?.plan || 'free' });
      if (rateCheck && !rateCheck.allowed) {
        return new Response(JSON.stringify({ error: rateCheck.message, daily_limit: true }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Step 2: Analyze with Lovable AI (or fallback to Anthropic) ────────
    if (!analysisId) {
      return new Response(JSON.stringify({
        error: 'missing_analysis_id',
        message: 'Missing analysis_id for analysis run'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!LOVABLE_API_KEY && !Deno.env.get('ANTHROPIC_API_KEY')) {
      if (analysisId) {
        await supabase.from('analyses').update({
          status: 'failed',
          result: { error: 'No AI API key configured' }
        }).eq('id', analysisId);
      }
      return new Response(JSON.stringify({ 
        error: 'api_key_missing',
        message: 'No AI API key configured'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    let analysis: Record<string, unknown>;

    if (LOVABLE_API_KEY) {
      // Use Lovable AI Gateway
      console.log('Using Lovable AI for analysis...');
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error('Lovable AI error:', aiRes.status, errText);
        
        if (aiRes.status === 429) {
          throw new Error('Rate limit exceeded — please try again in a moment');
        }
        if (aiRes.status === 402) {
          throw new Error('AI credits exhausted — please add credits');
        }
        throw new Error(`AI analysis error: ${aiRes.status}`);
      }

      const aiData = await aiRes.json();
      const rawText = aiData.choices?.[0]?.message?.content || '{}';
      const clean = rawText.replace(/```json|```/g, '').trim();
      console.log('AI response length:', clean.length);
      analysis = JSON.parse(clean);
    } else {
      // Fallback to Anthropic
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
      console.log('Using Anthropic for analysis...');
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
      analysis = JSON.parse(clean);
    }

    const processingTime = Math.round((Date.now() - startTime) / 1000);
    console.log('Analysis complete in', processingTime, 'seconds');

    // ── Save result ──────────────────────────────────────────────────────
    const { error: saveError } = await supabase.from('analyses').update({
      status: 'completed',
      result: analysis,
      hook_strength: analysis.hook_strength as string,
      recommended_platforms: analysis.recommended_platforms as string[],
      improvement_suggestions: analysis.improvement_suggestions as string[],
      processing_time_seconds: processingTime,
    }).eq('id', analysisId);

    if (saveError) {
      throw new Error(`Failed to save analysis: ${saveError.message}`);
    }

    // Increment usage
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: currentUsage } = await supabase
      .from('usage')
      .select('analyses_count')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    if (currentUsage) {
      await supabase.from('usage').update({
        analyses_count: (currentUsage.analyses_count || 0) + 1,
      }).eq('user_id', user_id).eq('period', currentPeriod);
    } else {
      await supabase.from('usage').insert({
        user_id,
        period: currentPeriod,
        analyses_count: 1,
      });
    }

    // Save to creative_memory
    await supabase.from('creative_memory').insert({
      user_id,
      analysis_id,
      hook_type: analysis.hook_type as string,
      creative_model: analysis.creative_model as string,
      platform: (analysis.recommended_platforms as string[])?.[0] || null,
      market: (analysis.market_guess as string) || market,
      hook_score: analysis.hook_score as number,
    });

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
      success: true, analysis_id: analysisId, mock_mode: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('analyze-video error:', error);
    
    // Try to update analysis status to failed
    try {
      if (analysisId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabase.from('analyses').update({
          status: 'failed',
          result: { error: String(error) }
        }).eq('id', analysisId);
      }
    } catch {}

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
