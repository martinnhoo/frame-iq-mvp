import { getEffectivePlan, getLimit, isWithinLimit } from "../_shared/plans.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Cost-based progressive throttle ──────────────────────────────────────────
const _COST_PER = { analysis:(3000/1e6*3)+(800/1e6*15), board:(2500/1e6*3)+(700/1e6*15), preflight:(2000/1e6*3)+(600/1e6*15), translation:(800/1e6*3)+(400/1e6*15), hook:(1500/1e6*3)+(400/1e6*15) };
const _PLAN_REV: Record<string,number> = { free:0, maker:19, pro:49, studio:149 };
async function checkThrottle(sb: any, uid: string): Promise<{allowed:boolean;retry_after:number}> {
  const period = new Date().toISOString().slice(0,7);
  const [{data:prof},{data:usage}] = await Promise.all([
    sb.from('profiles').select('plan,last_ai_action_at').eq('id',uid).single(),
    sb.from('usage').select('analyses_count,boards_count,translations_count,preflights_count,hooks_count').eq('user_id',uid).eq('period',period).single(),
  ]);
  const p = (prof as any);
  const u = (usage as any);
  const rev = _PLAN_REV[p?.plan||'free']??0;
  if(rev<=0) return {allowed:true,retry_after:0};
  const cost=(u?.analyses_count||0)*_COST_PER.analysis+(u?.boards_count||0)*_COST_PER.board+(u?.translations_count||0)*_COST_PER.translation+(u?.preflights_count||0)*_COST_PER.preflight+(u?.hooks_count||0)*_COST_PER.hook;
  const ratio=cost/rev;
  if(ratio<0.80) return {allowed:true,retry_after:0};
  const maxSec=480;
  const cooldown=ratio>=1?maxSec:Math.round(((ratio-0.80)/0.20)*maxSec);
  const elapsed=p?.last_ai_action_at?(Date.now()-new Date(p.last_ai_action_at).getTime())/1000:cooldown+1;
  const wait=Math.max(0,Math.ceil(cooldown-elapsed));
  if(wait>0) return {allowed:false,retry_after:wait};
  await sb.from('profiles').update({last_ai_action_at:new Date().toISOString()} as any).eq('id',uid);
  return {allowed:true,retry_after:0};
}
// ─────────────────────────────────────────────────────────────────────────────


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

    // ── JWT auth — verify caller before processing expensive API calls ────────
    const authHeader = req.headers.get('Authorization') ?? '';
    let verified_user_id = '';
    if (authHeader.startsWith('Bearer ')) {
      const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.slice(7));
      if (authUser) verified_user_id = authUser.id;
    }
    // Fall back to formData user_id only if JWT validation failed (legacy clients)
    // but log a warning — this path should eventually be removed

    const formData = await req.formData();
    const videoFile = formData.get('video_file') as File | null;
    const videoUrl = formData.get('video_url') as string | null;
    const meta_performance_data = formData.get('meta_performance_data') as string | null;
    const meta_ad_name = formData.get('meta_ad_name') as string | null;
    const campaign_goal = formData.get('campaign_goal') as string | null;
    // Always prefer JWT-verified identity
    const user_id = verified_user_id || (formData.get('user_id') as string) || '';
    analysisId = (formData.get('analysis_id') as string | null) ?? null;
    const title = formData.get('title') as string;
    const transcribe_only = formData.get('transcribe_only') === 'true';
    const market = (formData.get('market') as string) || '';

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    const startTime = Date.now();

    // ── Step 1: Transcribe audio via Lovable AI (Gemini) ─────────────────
    let transcript = '';
    let duration = 30;

    if (videoFile && LOVABLE_API_KEY) {
      try {
        
        // Convert file to base64 for Gemini
        const arrayBuffer = await videoFile.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Audio = btoa(binary);
        
        // Determine MIME type
        const mimeType = videoFile.type || (videoFile.name?.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg');
        
        const transcribeRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe this audio file. Return ONLY a JSON object with two fields: {"text": "<full transcription>", "duration_seconds": <estimated duration in seconds>}. No markdown, no explanation. If the audio is in a non-English language, transcribe in the original language.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Audio}`
                  }
                }
              ]
            }],
          }),
        });

        if (transcribeRes.ok) {
          const transcribeData = await transcribeRes.json();
          const rawText = transcribeData.choices?.[0]?.message?.content || '';
          const clean = rawText.replace(/```json|```/g, '').trim();
          try {
            const parsed = JSON.parse(clean);
            transcript = parsed.text || clean;
            duration = Math.round(parsed.duration_seconds || 30);
          } catch {
            // If not JSON, use the raw text as transcript
            transcript = clean;
          }
        } else {
          const errText = await transcribeRes.text();
          console.error('Transcription API error:', transcribeRes.status, errText);
          if (transcribeRes.status === 429) {
            transcript = '[Rate limited — please try again in a moment]';
          } else if (transcribeRes.status === 402) {
            transcript = '[AI credits exhausted — please add credits]';
          } else {
            transcript = '[Audio transcription failed — AI error]';
          }
        }
      } catch (e) {
        console.error('Transcription error:', e);
        transcript = '[Audio transcription failed — analyzing visual context only]';
      }
    } else if (videoFile && OPENAI_API_KEY) {
      // Fallback to Whisper if no LOVABLE_API_KEY
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
      // Fail only if truly no transcript at all or no AI key available
      const hasKey = LOVABLE_API_KEY || OPENAI_API_KEY;
      const transcriptFailed = !transcript || (transcript.startsWith('[') && (
        transcript.includes('failed') || transcript.includes('exhausted') || transcript.includes('Rate limited') || transcript.includes('error')
      ));
      if (!hasKey || !videoFile) {
        const reason = !videoFile ? 'No video file received' : 'No AI API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)';
        console.error('transcribe_only failed:', reason);
        return new Response(JSON.stringify({ 
          error: 'transcription_failed', transcript: '', message: reason
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (transcriptFailed) {
        console.error('transcribe_only failed: transcript error:', transcript);
        return new Response(JSON.stringify({ 
          error: 'transcription_failed', transcript: '', message: transcript || 'Transcription failed — try again or paste text manually'
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ 
        success: true, transcript, duration,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Rate limit check ──
    if (user_id) {
      const { data: profile } = await supabase.from('profiles').select('plan, email').eq('id', user_id).single();
      const _plan = getEffectivePlan(profile?.plan, (profile as any)?.email);
      // ── Cost-based throttle check ──
      const throttle = await checkThrottle(supabase, user_id);
      if (!throttle.allowed) {
        return new Response(JSON.stringify({
          error: 'rate_limited',
          message: 'Processing will be available shortly. Please try again in a moment.',
          retry_after_seconds: throttle.retry_after,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
${videoUrl ? `Video URL: ${videoUrl}` : ''}
${meta_performance_data ? `\nREAL PERFORMANCE DATA FROM META ADS (use this to cross-reference your visual analysis):\n${meta_performance_data}\n\nIMPORTANT: When real performance data is provided, your analysis MUST:\n1. Cross-reference the hook score with actual CTR (low CTR + weak hook = confirmed problem)\n2. If video retention drops early but conversions are strong = hook problem, offer is solid\n3. If ROAS is high but spend is low = winning creative being under-scaled\n4. Reference the actual numbers in your summary and improvement_suggestions\n5. Add a field "performance_verdict": one sentence verdict combining visual analysis + real data` : ''}`;

    let analysis: Record<string, unknown>;

    if (LOVABLE_API_KEY) {
      // Use Lovable AI Gateway
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
      analysis = JSON.parse(clean);
    } else {
      // Fallback to Anthropic
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
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
      analysis_id: analysisId,
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
