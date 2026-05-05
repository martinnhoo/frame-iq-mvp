/**
 * hub-voice-gen — ElevenLabs Text-to-Speech pra Brilliant Hub.
 *
 * Pipeline:
 *   1. JWT auth (rejeita anônimo)
 *   2. Recebe JSON: { text, voice_id, model_id?, stability?, similarity_boost? }
 *   3. POST pra ElevenLabs /text-to-speech/{voice_id}
 *   4. Recebe audio/mpeg binário, encoda como data URL base64
 *   5. Retorna { ok, audio_url, characters, voice_id, model_id }
 *
 * Custos ElevenLabs (referência, varia por plano):
 *   - Free tier: 10k chars/mês
 *   - Starter ($5/mo): 30k chars
 *   - Creator ($22/mo): 100k chars
 *   - Pay-as-you-go: ~$0.30 / 1k chars
 *
 * Secret necessária: ELEVENLABS_API_KEY (definir no Supabase secrets)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCredits } from "../_shared/deductCredits.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Limite defensivo — ElevenLabs cobra por char, e queremos evitar
// gerar áudio gigante por engano. 5000 chars ≈ 6-7 minutos de áudio.
const MAX_CHARS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── JWT auth ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    let user_id = "";
    if (authHeader.startsWith("Bearer ")) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
      if (user) user_id = user.id;
    }
    if (!user_id) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Credit check (usa categoria translation pra simplicidade) ──
    const creditCheck = await requireCredits(supabase, user_id, "translation");
    if (!creditCheck.allowed) {
      return new Response(JSON.stringify(creditCheck.error), {
        status: 402,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Parse body ──────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const text: string = (body.text || "").toString().trim();
    const voice_id: string = (body.voice_id || "").toString().trim();
    const model_id: string = (body.model_id || "eleven_multilingual_v2").toString().trim();
    const stability = clampNumber(body.stability, 0, 1, 0.50);
    const similarity_boost = clampNumber(body.similarity_boost, 0, 1, 0.75);
    const style = clampNumber(body.style, 0, 1, 0);
    const use_speaker_boost = body.use_speaker_boost !== false;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "missing_text", message: "Texto vazio." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (text.length > MAX_CHARS) {
      return new Response(
        JSON.stringify({ error: "text_too_long", message: `Texto excede ${MAX_CHARS} caracteres (${text.length}).` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (!voice_id) {
      return new Response(
        JSON.stringify({ error: "missing_voice", message: "voice_id obrigatório." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "missing_elevenlabs_key",
          message: "ELEVENLABS_API_KEY não configurada nos secrets do Supabase. Adicione a chave em Project Settings → Edge Functions → Secrets.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── ElevenLabs TTS ──────────────────────────────────────
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id,
          voice_settings: {
            stability,
            similarity_boost,
            style,
            use_speaker_boost,
          },
        }),
      },
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("[hub-voice-gen] ElevenLabs error", elevenRes.status, errText.slice(0, 400));
      let friendly: string;
      let parsedDetail: string | undefined;
      try {
        const parsed = JSON.parse(errText);
        parsedDetail = parsed?.detail?.message || parsed?.detail?.status || parsed?.message;
      } catch { /* not json */ }
      if (elevenRes.status === 401) {
        friendly = "ELEVENLABS_API_KEY inválida ou expirada.";
      } else if (elevenRes.status === 422) {
        friendly = parsedDetail || "Parâmetros inválidos (voice_id, model_id, ou settings).";
      } else if (elevenRes.status === 429) {
        friendly = "ElevenLabs rate-limited ou quota mensal estourada.";
      } else if (elevenRes.status === 402) {
        friendly = "ElevenLabs: créditos esgotados. Recarrega a conta.";
      } else {
        friendly = parsedDetail || `ElevenLabs error ${elevenRes.status}.`;
      }
      return new Response(
        JSON.stringify({
          error: "elevenlabs_failed",
          message: friendly,
          raw: errText.slice(0, 300),
          status: elevenRes.status,
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Encode audio como data URL ──────────────────────────
    const audioBuf = await elevenRes.arrayBuffer();
    const u8 = new Uint8Array(audioBuf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < u8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);
    const audio_url = `data:audio/mpeg;base64,${base64}`;
    const sizeKB = Math.round(audioBuf.byteLength / 1024);

    return new Response(
      JSON.stringify({
        ok: true,
        audio_url,
        characters: text.length,
        size_kb: sizeKB,
        voice_id,
        model_id,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[hub-voice-gen] fatal error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(error).slice(0, 400) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
