/**
 * hub-transcribe — Whisper-based transcription pra Brilliant Hub.
 *
 * Pipeline:
 *   1. JWT auth (rejeita anônimo)
 *   2. Recebe FormData com `audio_file` + opcional `target_language`
 *   3. POST direto pra OpenAI Whisper (response_format=verbose_json)
 *      — sem passar por gateway Gemini quebrado do analyze-video
 *   4. Se `target_language` veio e difere do detectado: chama Claude
 *      Haiku 4.5 pra traduzir mantendo tom (sem culturalizar — é
 *      transcrição, não criativo)
 *   5. Retorna { transcript, language, duration, translated?, target_language? }
 *
 * Custo:
 *   - Whisper: $0.006/min de áudio
 *   - Tradução: ~1k tokens out por minuto de áudio (Haiku barato)
 *
 * Por que função dedicada (em vez de reusar analyze-video)?
 *   - analyze-video tem branch quebrado: tenta Gemini via api.anthropic.com
 *     com formato OpenAI — sempre falha. Whisper só dispara se
 *     ANTHROPIC_API_KEY ausente, que não é o nosso caso.
 *   - Hub precisa de fluxo simples: Whisper > opcional traduzir.
 *     Sem creative_memory, sem analyses, sem persona scoping.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireCredits } from "../_shared/deductCredits.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANG_NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese",
  en: "English",
  es: "Spanish (Latin American)",
  zh: "Mandarin Chinese (Simplified)",
  hi: "Hinglish (Hindi mixed with English, written in Latin/Roman script — NEVER Devanagari)",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── JWT auth ──────────────────────────────────────────────
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

    // ── Credit check ──────────────────────────────────────────
    const creditCheck = await requireCredits(supabase, user_id, "translation");
    if (!creditCheck.allowed) {
      return new Response(JSON.stringify(creditCheck.error), {
        status: 402,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Parse FormData ────────────────────────────────────────
    const fd = await req.formData();
    const file = fd.get("audio_file") as File | null;
    const target_language = (fd.get("target_language") as string | null)?.trim() || "";

    if (!file) {
      return new Response(
        JSON.stringify({ error: "missing_file", message: "Nenhum arquivo recebido (esperado audio_file)." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "missing_openai_key", message: "OPENAI_API_KEY não configurada no servidor." }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Step 1: Whisper ───────────────────────────────────────
    const whisperForm = new FormData();
    whisperForm.append("file", file, file.name || "audio.mp3");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "verbose_json");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error("[hub-transcribe] Whisper error", whisperRes.status, errText.slice(0, 400));
      const friendly = whisperRes.status === 413
        ? "Arquivo muito grande pra Whisper (max ~25MB pós-extração)."
        : whisperRes.status === 401
        ? "OpenAI API key inválida no servidor."
        : whisperRes.status === 429
        ? "OpenAI rate-limited — tenta novamente em alguns segundos."
        : `OpenAI Whisper error ${whisperRes.status}.`;
      return new Response(
        JSON.stringify({ error: "whisper_failed", message: friendly, raw: errText.slice(0, 200) }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const whisper = await whisperRes.json();
    const transcript: string = (whisper.text || "").trim();
    const detected_language: string = whisper.language || "";
    const duration: number = Math.round(whisper.duration || 0);

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "empty_transcript", message: "Whisper retornou vazio — sem fala detectada?" }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── Step 2 (opcional): Tradução ───────────────────────────
    let translated_text: string | null = null;
    let translation_target: string | null = null;

    if (target_language && target_language !== "auto") {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        // Tradução é opcional — falha silenciosa, retorna só transcrição
        console.warn("[hub-transcribe] target_language pedido mas ANTHROPIC_API_KEY ausente");
      } else {
        const targetName = LANG_NAMES[target_language] || target_language;
        const sourceName = detected_language
          ? (LANG_NAMES[detected_language] || detected_language)
          : "the source language";

        const systemPrompt =
          "You are an expert transcription translator. Your job is to translate a transcript " +
          "from one language to another, preserving all nuance, speaker intent, and natural flow. " +
          "Do NOT add commentary, do NOT summarize, do NOT split into bullet points — return the " +
          "full transcript in the target language as continuous text. Preserve paragraph breaks " +
          "and punctuation rhythm. Respond ONLY with valid JSON: " +
          '{"translated": "<full translated transcript>"}. No markdown, no preamble.';

        const userMsg =
          `Translate this transcript FROM ${sourceName} TO ${targetName}:\n\n---\n${transcript}\n---\n\nReturn ONLY valid JSON.`;

        try {
          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 4000,
              system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content: userMsg }],
              temperature: 0.2,
            }),
          });

          if (claudeRes.ok) {
            const claudeData = await claudeRes.json();
            const raw = (claudeData.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
            try {
              const jsonStart = raw.search(/[{[]/);
              const jsonEnd = raw.lastIndexOf("}");
              const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
              const parsed = JSON.parse(jsonStr);
              translated_text = (parsed.translated || raw).trim();
            } catch {
              translated_text = raw;
            }
            translation_target = target_language;
          } else {
            const errText = await claudeRes.text();
            console.error("[hub-transcribe] Claude translation failed", claudeRes.status, errText.slice(0, 300));
          }
        } catch (e) {
          console.error("[hub-transcribe] Claude translation exception:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        language: detected_language,
        duration,
        translated_text,
        translation_target,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[hub-transcribe] fatal error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(error).slice(0, 400) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
