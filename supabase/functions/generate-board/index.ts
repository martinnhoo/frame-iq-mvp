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
    } = body;

    // Resolve user_id from body OR JWT
    let user_id = bodyUserId;
    if (!user_id) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');
      if (token) {
        const anonClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user } } = await anonClient.auth.getUser();
        user_id = user?.id;
      }
    }

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

    // Check usage limits
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan')
      .eq('id', user_id)
      .single();

    const { data: usage } = await supabaseClient
      .from('usage')
      .select('boards_count')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    const limits: Record<string, number> = { free: 3, studio: 30, scale: 300 };
    const plan = profile?.plan || 'free';
    const usageCount = (usage?.boards_count as number) || 0;
    const planLimit = limits[plan] ?? 3;

    if (usageCount >= planLimit) {
      return new Response(
        JSON.stringify({ error: 'limit_reached', plan, message: `You've reached your ${plan} plan limit of ${planLimit} boards this month.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // TODO: Uncomment when ANTHROPIC_API_KEY is available
    /*
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    // Step 1-7: Claude API calls for talent, audience, character, strategy, scenes, production, compliance
    */

    // MOCK board
    const mockBoard = {
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

    // Save to boards table
    const { data: boardRecord, error: insertError } = await supabaseClient
      .from('boards')
      .insert({
        user_id,
        title: prompt.substring(0, 100),
        prompt,
        market: marketConfig.code,
        market_flag,
        platform,
        duration_seconds: duration,
        scene_count,
        has_talent,
        talent_name: talent_name || null,
        vo_language,
        status: 'generated',
        content: mockBoard
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Increment usage
    if (usage) {
      await supabaseClient
        .from('usage')
        .update({ boards_count: usageCount + 1 })
        .eq('user_id', user_id)
        .eq('period', currentPeriod);
    } else {
      await supabaseClient
        .from('usage')
        .insert({ user_id, period: currentPeriod, boards_count: 1 });
    }

    return new Response(
      JSON.stringify({ success: true, board: boardRecord, mock_mode: true }),
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
