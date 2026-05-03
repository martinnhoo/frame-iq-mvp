import { getEffectivePlan } from "../_shared/credits.ts";
import { requireCredits } from "../_shared/deductCredits.ts";
import { createClient } from "npm:@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MARKET_CONFIGS: Record<string, { code: string; flag: string; language: string; name: string }> = {
  BR: { code: 'BR', flag: '🇧🇷', language: 'PT', name: 'Brazil' },
  MX: { code: 'MX', flag: '🇲🇽', language: 'ES', name: 'Mexico' },
  US: { code: 'US', flag: '🇺🇸', language: 'EN', name: 'United States' },
  GB: { code: 'GB', flag: '🇬🇧', language: 'EN', name: 'United Kingdom' },
  FR: { code: 'FR', flag: '🇫🇷', language: 'FR', name: 'France' },
  DE: { code: 'DE', flag: '🇩🇪', language: 'DE', name: 'Germany' },
  ES: { code: 'ES', flag: '🇪🇸', language: 'ES', name: 'Spain' },
  IT: { code: 'IT', flag: '🇮🇹', language: 'IT', name: 'Italy' },
  JP: { code: 'JP', flag: '🇯🇵', language: 'JA', name: 'Japan' },
  IN: { code: 'IN', flag: '🇮🇳', language: 'HI', name: 'India' },
  AU: { code: 'AU', flag: '🇦🇺', language: 'EN', name: 'Australia' },
  CA: { code: 'CA', flag: '🇨🇦', language: 'EN', name: 'Canada' },
  GLOBAL: { code: 'GLOBAL', flag: '🌍', language: 'EN', name: 'Global' }
};

const PLATFORM_CONFIGS: Record<string, { aspect_ratio: string; max_duration: number }> = {
  tiktok: { aspect_ratio: '9:16', max_duration: 60 },
  reels: { aspect_ratio: '9:16', max_duration: 90 },
  youtube_shorts: { aspect_ratio: '9:16', max_duration: 60 },
  youtube: { aspect_ratio: '16:9', max_duration: 120 },
  facebook: { aspect_ratio: '1:1', max_duration: 60 },
  all: { aspect_ratio: '9:16', max_duration: 30 }
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

    const body = await req.json();
    const {
      prompt,
      market: rawMarket = 'GLOBAL',
      duration: rawDuration = 30,
      platform: rawPlatform = 'all',
      has_talent = false,
      talent_name,
      user_id: bodyUserId,
      title,
      context,
      persona_context,
      persona_id: bodyPersonaId,
      funnel_stage = 'tofu',
    } = body;

    const FUNNEL_CONTEXT = {
      tofu: 'TOP OF FUNNEL (cold audience): Generate AWARENESS. Bold hook, no brand assumptions, interrupt scroll with a problem or insight.',
      mofu: 'MIDDLE OF FUNNEL (warm audience): Drive CONSIDERATION. Differentiation, social proof, deeper benefits for someone evaluating options.',
      bofu: 'BOTTOM OF FUNNEL (hot audience): Trigger CONVERSION. Urgency, specific offer, risk reversal, final push for someone ready to decide.',
    };

    // Resolve user_id — JWT always wins over body to prevent spoofing
    const authHeader = req.headers.get('Authorization') ?? '';
    let user_id: string | undefined;
    if (authHeader.startsWith('Bearer ')) {
      const { data: { user: authUser } } = await supabaseClient.auth.getUser(authHeader.slice(7));
      if (authUser) user_id = authUser.id;
    }
    // Fallback to body user_id only when no valid JWT (legacy clients)
    if (!user_id) user_id = bodyUserId;

    if (!prompt || prompt.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please describe your video idea in more detail (minimum 10 characters).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check credits
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan, email')
      .eq('id', user_id)
      .single();

    const plan = getEffectivePlan(profile?.plan, (profile as any)?.email);

    // Deduct credits for board generation
    const creditCheck = await requireCredits(supabaseClient, user_id, "board");
    if (!creditCheck.allowed) {
      return new Response(
        JSON.stringify(creditCheck.error),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const market = rawMarket as string;
    const duration = typeof rawDuration === 'number' ? rawDuration : 30;
    const platform = rawPlatform as string;
    const marketConfig = MARKET_CONFIGS[market] || MARKET_CONFIGS.GLOBAL;
    const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.all;
    const vo_language = marketConfig.language;
    const market_flag = marketConfig.flag;
    const aspect_ratio = platformConfig.aspect_ratio;
    const scene_count = Math.ceil(duration / 6);

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    // Load user's AI profile for personalized context
    const { data: userAiProfile } = await supabaseClient
      .from('user_ai_profile')
      .select('top_performing_models, best_platforms, avg_hook_score, ai_summary, creative_style')
      .eq('user_id', user_id)
      .maybeSingle();

    const aiContext = userAiProfile ? `
USER CONTEXT (from their previous work):
- Their best performing creative models: ${(userAiProfile.top_performing_models || []).join(', ') || 'none yet'}
- Their best platforms: ${(userAiProfile.best_platforms || []).join(', ') || 'none yet'}
- Their average hook score: ${userAiProfile.avg_hook_score || 'unknown'}/10
- Their creative style: ${userAiProfile.creative_style || 'not yet determined'}
Use this context to make the board MORE relevant to what works for this specific creator.` : '';

    let board: Record<string, unknown>;

    if (ANTHROPIC_API_KEY) {
      const sysPrompt = `You are a world-class performance marketing creative director. Generate a complete production board for a ${duration}s ${platform} video ad.
Market: ${marketConfig.name} (${marketConfig.code}), Language: ${vo_language}
Talent: ${has_talent ? `Yes — ${talent_name || 'unnamed creator'}` : 'Product-only, no talent'}
${aiContext}
${funnel_stage ? `
FUNNEL STAGE: ${(FUNNEL_CONTEXT as Record<string,string>)[funnel_stage] || FUNNEL_CONTEXT.tofu}
` : ""}
${persona_context ? `\nTARGET AUDIENCE PERSONA — build the entire board FOR THIS SPECIFIC PERSON:\n- ${persona_context.name}, ${persona_context.age}, ${persona_context.gender}\n- Bio: ${persona_context.bio}\n- Core pains: ${persona_context.pains?.join(', ')}\n- Desires: ${persona_context.desires?.join(', ')}\n- Purchase triggers: ${persona_context.triggers?.join(', ')}\n- Language style: ${persona_context.language_style}\n- CTA style: ${persona_context.cta_style}\n- Best formats: ${persona_context.best_formats?.join(', ')}\n- Proven hook angles: ${persona_context.hook_angles?.join(' | ')}\nEvery scene, VO line, hook, and CTA must be written specifically for this person's psychology.\n` : ''}
${context ? `Additional context: ${context}` : ''}

Return ONLY valid JSON (no markdown) with this exact structure:
{
  "overview": {"campaign_title":"string","market":"string","market_code":"string","platform":"string","duration_seconds":${duration},"aspect_ratio":"${aspect_ratio}","vo_language":"${vo_language}","scene_count":${scene_count}},
  "audience": {"age_range":"string","gender_skew":"string","income_level":"string","pain_points":["array"],"desires":["array"],"hook_insight":"string"},
  "hook": {"type":"curiosity|social_proof|pattern_interrupt|direct_offer|emotional|question|statement","hook_line":"exact first words spoken","visual_hook":"what viewer sees in first 3s","hook_score_prediction":5},
  "character": ${has_talent ? '{"name":"string","type":"real_person|ugc_creator","role":"string","gender":"string","age":"string","hair":"string","skin_tone":"string","wardrobe_suggestion":"exact outfit description for all scenes","setting_suggestion":"string","tone":"string","dos":["array"],"donts":["array"]}' : 'null'},
  "scenes": [{"scene_number":1,"duration_seconds":5,"title":"Scene title","visual_description":"what to film — include character physical details if talent is present","dialogue_or_vo":"exact words","on_screen_text":"text overlay","transition":"cut|fade|swipe","notes":"director note"}],
  "production": {"location":"home|studio|outdoor|product-only","location_detail":"specific description of the location/set","props":["array"],"lighting":"ring-light|natural|studio","editing_style":"string","music_bpm":"number range","aspect_ratio":"${aspect_ratio}","resolution":"string","fps":30,"export_format":"MP4","editor_briefing":"string"},
  "compliance": {"platform_safe":true,"overall_risk":"low|medium|high","issues":[],"suggestions":["array"],"disclaimer_needed":false,"disclaimer_text":null}
}

IMPORTANT: If talent is involved, every scene's visual_description MUST reference the SAME character with CONSISTENT appearance (same clothes, hair, setting). Describe the character's physical appearance in detail in the character object.`;

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          // System prompt cacheado — bloco grande (constituição + schema JSON)
          // repete em toda chamada. cache_control ephemeral = 90% off em
          // input tokens pra hits subsequentes (5min TTL).
          system: [{ type: 'text', text: sysPrompt, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: `Create the board for this brief: ${prompt}` }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const rawText = (claudeData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
        board = JSON.parse(rawText);
      } else {
        throw new Error(`Claude API error: ${claudeRes.status}`);
      }
    } else {
      // MOCK board (API key not set)
      board = {
      overview: {
        campaign_title: prompt.substring(0, 60),
        market: marketConfig.name,
        market_code: marketConfig.code,
        platform,
        duration_seconds: duration,
        aspect_ratio,
        vo_language,
        scene_count
      },
      audience: {
        age_range: '18-34',
        gender_skew: 'balanced',
        income_level: 'mid',
        interests: ['Technology', 'Social Media', 'Innovation', 'Content Creation', 'Digital Marketing'],
        pain_points: ['Limited time for content creation', 'Difficulty standing out', 'Need professional-quality video'],
        desires: ['Create engaging content quickly', 'Boost brand visibility', 'Drive conversions'],
        platform_behavior: 'Active daily users who consume short-form video content',
        peak_hours: '6-9 PM local time',
        purchase_trigger: 'Social proof, urgency, and clear value demonstration',
        audience_language: vo_language,
        cultural_notes: `${marketConfig.name} audience values authenticity and relatable content.`
      },
      character: has_talent ? {
        type: talent_name ? 'real_person' : 'ugc_creator',
        name: talent_name || 'UGC Creator',
        role: 'Product Advocate',
        tone: 'Conversational and enthusiastic',
        dos: ['Maintain eye contact', 'Use natural gestures', 'Show product in use'],
        donts: ['Avoid reading from script', 'No overly promotional language'],
        wardrobe_suggestion: 'Casual, relatable attire',
        setting_suggestion: 'Natural lighting, clean background'
      } : null,
      strategy: {
        hook_type: 'pattern_interrupt',
        hook_duration_seconds: 3,
        narrative_arc: 'problem-solution',
        cta_type: 'direct',
        pacing: 'fast-cut',
        has_voiceover: true,
        has_captions: true,
        caption_style: 'bold-centered',
        music_energy: 'upbeat',
        music_genre: 'Modern electronic',
        color_grade: 'Vibrant and saturated',
        overall_tone: 'Energetic and persuasive',
        key_message: 'Transform your content creation with powerful AI-driven tools'
      },
      scenes: Array.from({ length: scene_count }, (_, i) => ({
        scene_number: i + 1,
        timestamp: `0:${String(i * 6).padStart(2, '0')} - 0:${String((i + 1) * 6).padStart(2, '0')}`,
        duration_seconds: 6,
        type: i === 0 ? 'hook' : i < scene_count - 1 ? 'build' : 'cta',
        visual_description: `Scene ${i + 1}: ${i === 0 ? 'Eye-catching opening' : i < scene_count - 1 ? 'Key feature demonstration' : 'Strong call-to-action'}`,
        vo_script: `Mock VO for scene ${i + 1} in ${vo_language}`,
        onscreen_text: (i === 0 || i === scene_count - 1) ? `TEXT ${i + 1}` : null,
        caption_text: `Caption ${i + 1}`,
        director_note: `Focus on ${i === 0 ? 'grabbing attention' : i < scene_count - 1 ? 'building interest' : 'driving action'}`,
        b_roll_suggestion: i % 2 === 0 ? 'Product close-up' : 'Result demonstration',
        transition_to_next: i < scene_count - 1 ? 'hard-cut' : 'none'
      })),
      production: {
        shoot_time_estimate: '2-4 hours',
        location: has_talent ? 'home' : 'product-only',
        location_detail: 'Well-lit space with clean background',
        props: ['Product', 'Smartphone or camera', 'Ring light'],
        lighting: 'ring-light',
        editing_style: 'Fast-paced cuts with dynamic transitions',
        music_bpm: '120-130',
        aspect_ratio,
        resolution: aspect_ratio === '9:16' ? '1080x1920' : '1920x1080',
        fps: 30,
        export_format: 'MP4',
        editor_briefing: `Create a ${duration}s ${platform} video for ${marketConfig.name}. All text in ${vo_language}.`
      },
      compliance: {
        platform_safe: true,
        overall_risk: 'low',
        issues: [],
        suggestions: ['Ensure all claims are substantiated', 'Follow platform advertising guidelines'],
        disclaimer_needed: false,
        disclaimer_text: null
      }
    };

    } // end else mock block

    // Attach brand_kit from persona if available
    const brandKit = body.persona_context?.brand_kit || null;
    if (brandKit) {
      (board as Record<string, unknown>).brand_kit = brandKit;
    }

    // Save to boards table
    const { data: boardRecord, error: insertError } = await supabaseClient
      .from('boards')
      .insert({
        user_id,
        persona_id: bodyPersonaId || null,
        title: (board.overview as Record<string, unknown>)?.campaign_title as string || prompt.substring(0, 100),
        prompt,
        market_flag: `${marketConfig.flag} ${marketConfig.code}`,
        platform,
        duration_seconds: duration,
        scene_count,
        has_talent,
        talent_name: talent_name || null,
        vo_language,
        status: 'generated',
        content: board,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Capture prompt to creative_memory for AI learning
    // persona_id added 20260501 — scopes board prompts to active persona so the
    // AI chat read path doesn't surface them in unrelated personas.
    const hookPrediction = (board.hook as Record<string, unknown>)?.type as string || null;
    supabaseClient.from('creative_memory').insert({
      user_id,
      persona_id: bodyPersonaId || null,
      analysis_id: null,
      hook_type: hookPrediction,
      creative_model: null,
      platform,
      market: marketConfig.code,
      hook_score: (board.hook as Record<string, unknown>)?.hook_score_prediction as number || null,
      notes: prompt.substring(0, 500),
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
      body: JSON.stringify({ user_id, trigger: 'board_generated' }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, board: boardRecord, board_id: boardRecord.id, mock_mode: !ANTHROPIC_API_KEY }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-board:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
