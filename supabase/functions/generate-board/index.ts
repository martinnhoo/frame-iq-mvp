import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MARKET_CONFIGS = {
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

const PLATFORM_CONFIGS = {
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

    const { 
      prompt, 
      market = 'GLOBAL', 
      duration = 30,
      platform = 'all',
      context,
      has_talent = false,
      talent_name,
      user_id
    } = await req.json();

    // Input validation
    if (!prompt || prompt.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Please describe your video idea in more detail (minimum 10 characters).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
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
      .select('boards_count')
      .eq('user_id', user_id)
      .eq('period', currentPeriod)
      .single();

    const limits = { free: 3, studio: 30, scale: 300 };
    const plan = profile?.plan || 'free';
    const usageCount = usage?.boards_count || 0;

    if (usageCount >= limits[plan as keyof typeof limits]) {
      return new Response(
        JSON.stringify({ 
          error: 'limit_reached', 
          plan,
          message: `You've reached your ${plan} plan limit of ${limits[plan as keyof typeof limits]} boards this month.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get market config
    const marketConfig = MARKET_CONFIGS[market as keyof typeof MARKET_CONFIGS] || MARKET_CONFIGS.GLOBAL;
    const platformConfig = PLATFORM_CONFIGS[platform as keyof typeof PLATFORM_CONFIGS] || PLATFORM_CONFIGS.all;
    
    const vo_language = marketConfig.language;
    const market_flag = marketConfig.flag;
    const aspect_ratio = platformConfig.aspect_ratio;

    // Calculate scene count
    const scene_count = Math.ceil(duration / 6);

    // TODO: Call Claude API for all 7 steps when ANTHROPIC_API_KEY is available
    /*
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    // Step 1: Talent identification
    // Step 2: Audience profile
    // Step 3: Character profile  
    // Step 4: Creative strategy
    // Step 5: Scene breakdown
    // Step 6: Production notes
    // Step 7: Compliance check
    */

    // MOCK comprehensive board response
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
        pain_points: [
          'Limited time for content creation',
          'Difficulty standing out on social platforms',
          'Need for professional-quality video'
        ],
        desires: [
          'Create engaging content quickly',
          'Boost brand visibility',
          'Drive conversions through video'
        ],
        platform_behavior: 'Active daily users who consume short-form video content, engage with UGC, and respond well to authentic storytelling',
        peak_hours: '6-9 PM local time, weekdays',
        purchase_trigger: 'Social proof, urgency, and clear value demonstration',
        audience_language: vo_language,
        cultural_notes: `${marketConfig.name} audience values authenticity and relatable content. Adjust tone and references for local cultural context.`
      },
      character: has_talent ? {
        type: talent_name ? 'real_person' : 'ugc_creator',
        name: talent_name || 'UGC Creator',
        role: 'Product Advocate',
        why_they_work: 'Relatable personality that builds immediate trust with the target audience',
        tone: 'Conversational and enthusiastic',
        speech_style: 'Natural, energetic delivery with authentic reactions',
        dos: [
          'Maintain eye contact with camera',
          'Use natural gestures',
          'Speak with genuine enthusiasm',
          'Show product in use'
        ],
        donts: [
          'Avoid reading from script',
          'Don\'t over-rehearse',
          'No overly promotional language',
          'Avoid static poses'
        ],
        wardrobe_suggestion: 'Casual, relatable attire that matches target audience style',
        setting_suggestion: 'Natural lighting, home or studio setting with minimal background distractions'
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
        key_message: 'Transform your content creation with powerful AI-driven tools in seconds'
      },
      scenes: Array.from({ length: scene_count }, (_, i) => ({
        scene_number: i + 1,
        timestamp: `0:${String(i * 6).padStart(2, '0')} - 0:${String((i + 1) * 6).padStart(2, '0')}`,
        duration_seconds: 6,
        type: i === 0 ? 'hook' : i < scene_count - 1 ? 'build' : 'cta',
        visual_description: `Scene ${i + 1}: ${i === 0 ? 'Eye-catching opening with product reveal' : i < scene_count - 1 ? 'Demonstrate key feature with smooth transitions' : 'Strong call-to-action with clear next steps'}`,
        vo_script: `Mock VO script for scene ${i + 1} in ${vo_language}`,
        onscreen_text: i === 0 || i === scene_count - 1 ? `TEXT ${i + 1}` : null,
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
        wardrobe_detail: has_talent ? 'Casual, on-brand attire' : 'N/A',
        lighting: 'ring-light',
        lighting_detail: 'Soft, even lighting with key light at 45 degrees',
        editing_style: 'Fast-paced cuts with dynamic transitions',
        music_bpm: '120-130',
        music_reference: 'Upbeat electronic track with modern feel',
        caption_font_style: 'Bold sans-serif, high contrast',
        aspect_ratio,
        resolution: aspect_ratio === '9:16' ? '1080x1920' : '1920x1080',
        fps: 30,
        export_format: 'MP4',
        max_file_size: '100MB',
        special_effects: 'Dynamic text animations, product highlight effects',
        editor_briefing: `Create a ${duration}-second ${platform} video optimized for ${marketConfig.name} market. Use fast cuts, bold captions, and maintain high energy throughout. Ensure all text is in ${vo_language}.`
      },
      compliance: {
        platform_safe: true,
        overall_risk: 'low',
        issues: [],
        suggestions: [
          'Ensure all claims are substantiated',
          'Include relevant disclosures if needed',
          'Follow platform-specific advertising guidelines'
        ],
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

    if (insertError) {
      throw insertError;
    }

    // Increment usage count
    await supabaseClient
      .from('usage')
      .upsert({
        user_id,
        period: currentPeriod,
        boards_count: usageCount + 1
      }, {
        onConflict: 'user_id,period'
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        board: boardRecord,
        mock_mode: true,
        message: 'Board generated using comprehensive mock data. Add ANTHROPIC_API_KEY to enable real AI-powered board generation with Claude.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-board:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
        .from("usage")
        .insert({ user_id: user.id, period, boards_count: 1 });
    }

    return new Response(JSON.stringify({ board_id: board.id, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-board error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.startsWith("RATE_LIMIT") ? 429
      : message.startsWith("CREDITS") ? 402
      : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
