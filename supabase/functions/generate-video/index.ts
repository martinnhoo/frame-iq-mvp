import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/credits.ts";
import { requireCredits } from "../_shared/deductCredits.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { board_id, voice_id, market, user_id } = await req.json();

    if (!board_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: board_id, user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth: verify JWT matches user_id
    const authH = req.headers.get('Authorization') ?? '';
    if (authH.startsWith('Bearer ')) {
      const { data: { user: aU }, error: aE } = await supabaseClient.auth.getUser(authH.slice(7));
      if (aE || !aU || aU.id !== user_id) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check plan access
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan, email')
      .eq('id', user_id)
      .single();

    // Check credits
    const creditCheck = await requireCredits(supabase_client, user_id, "video");
    if (!creditCheck.allowed) return new Response(JSON.stringify(creditCheck.error), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Fetch board data
    const { data: board, error: boardError } = await supabaseClient
      .from('boards')
      .select('*')
      .eq('id', board_id)
      .single();

    if (boardError || !board) {
      return new Response(
        JSON.stringify({ error: 'Board not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scenes = (board.content as any)?.scenes || [];

    // TODO: Uncomment when API keys are available:
    /*
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    // Step 1 — Generate scene images with DALL-E
    const imageUrls = [];
    for (const scene of scenes) {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: scene.visual_description,
          size: board.aspect_ratio === '9:16' ? '1024x1792' : '1792x1024',
          quality: 'standard',
          n: 1
        })
      });
      const data = await response.json();
      imageUrls.push(data.data[0].url);
    }
    
    // Step 2 — Generate voiceover with ElevenLabs
    const audioUrls = [];
    const vo_lines = scenes.map(s => s.vo_script).filter(Boolean);
    
    for (const line of vo_lines) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: line,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });
      const audioBlob = await response.blob();
      // Upload to Supabase Storage and get URL
      const audioPath = `audio/${board_id}/${Date.now()}.mp3`;
      await supabaseClient.storage.from('videos').upload(audioPath, audioBlob);
      const { data: audioData } = supabaseClient.storage.from('videos').getPublicUrl(audioPath);
      audioUrls.push(audioData.publicUrl);
    }
    
    // Step 3 — Assemble video with FFmpeg (would need ffmpeg-wasm or external service)
    // Step 4 — Upload final video to Supabase Storage
    
    const finalVideoPath = `videos/${board_id}/${Date.now()}.mp4`;
    // ... upload logic ...
    const { data: videoData } = supabaseClient.storage.from('videos').getPublicUrl(finalVideoPath);
    const output_url = videoData.publicUrl;
    */

    // MOCK response
    const output_url = null;

    // Save to videos_generated table
    const { data: videoRecord, error: insertError } = await supabaseClient
      .from('videos_generated')
      .insert({
        user_id,
        board_id,
        title: board.title || 'Generated Video',
        status: 'mock',
        voice_id: voice_id || null,
        scene_count: scenes.length,
        has_captions: (board.content as any)?.strategy?.has_captions || true,
        aspect_ratio: board.aspect_ratio || '9:16',
        duration_seconds: board.duration_seconds || 30,
        output_url,
        video_url: output_url
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        video: videoRecord,
        mock_mode: true,
        status: 'mock',
        message: 'Video generation requires OPENAI_API_KEY (DALL-E) and ELEVENLABS_API_KEY. Once configured, videos will be generated automatically.',
        preview_url: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-video:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
