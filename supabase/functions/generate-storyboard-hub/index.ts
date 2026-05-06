// generate-storyboard-hub — Storyboard contínuo (Brilliant Hub).
//
// Pipeline:
//   1. Recebe { script, scene_count, brand_id, brand_hint, market,
//      aspect_ratio, quality }
//   2. Chama gpt-4o-mini pra dividir o roteiro em N cenas com "bible"
//      de continuidade visual — descrição exata do personagem +
//      cenário que vai em TODA cena pra garantir consistência
//   3. Em paralelo, chama gpt-image-2 N vezes (uma por cena)
//   4. Salva cada cena em creative_memory com type='hub_storyboard' +
//      storyboard_id agrupando todas. Imagens armazenadas como base64
//      data URLs (sem Storage — economia)
//   5. Retorna array de scenes + storyboard_id
//
// Output esperado: 3-8 imagens visualmente coerentes que o user
// pode baixar e juntar num editor de vídeo externo pra gerar o ad.

const FN_VERSION = "v1-storyboard-2026-05-05";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIZE_MAP: Record<string, string> = {
  "1:1":  "1024x1024",
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "4:5":  "1024x1536",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface SceneSpec { n: number; prompt: string }
interface SplitterResponse { bible: string; scenes: SceneSpec[] }

async function splitScript(args: {
  apiKey: string;
  script: string;
  sceneCount: number;
  brandHint: string;
  marketContext: string;
}): Promise<SplitterResponse> {
  const sys = `You are a storyboard designer for advertising creatives. ` +
    `You output a JSON object with two keys: "bible" and "scenes". ` +
    `\n\nThe "bible" is a 2-3 sentence visual reference that describes the recurring main character(s) ` +
    `(age, ethnicity, hair, clothing, expression style) and the overall setting/atmosphere ` +
    `(location, lighting, color palette, mood). This exact description MUST be embedded in every ` +
    `scene prompt below to guarantee visual continuity across the storyboard. ` +
    `\n\nThe "scenes" array has exactly N scene objects: { "n": <number>, "prompt": "<visual prompt>" }. ` +
    `Each scene prompt should: ` +
    `\n- Begin with the bible verbatim (so the character/setting stay consistent). ` +
    `\n- Then describe the action and emotion for that specific moment. ` +
    `\n- Be 2-3 sentences maximum, dense with visual detail. ` +
    `\n- Keep lighting, color palette, mood identical to other scenes. ` +
    `\n\nDo not output anything besides the JSON.`;

  const user = `Brand context: ${args.brandHint || "(no specific brand)"}\n\n` +
    `Target market context: ${args.marketContext || "(no specific market)"}\n\n` +
    `Script / idea:\n${args.script}\n\n` +
    `Generate exactly ${args.sceneCount} continuous scenes.`;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`splitter ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("splitter empty response");
  const parsed: SplitterResponse = JSON.parse(content);
  if (!parsed.bible || !Array.isArray(parsed.scenes)) {
    throw new Error("splitter malformed response");
  }
  return parsed;
}

interface SceneResult {
  n: number;
  prompt: string;
  image_url: string | null;
  error?: string;
}

async function generateScene(args: {
  apiKey: string;
  prompt: string;
  size: string;
  quality: string;
}): Promise<{ ok: boolean; b64?: string; error?: string }> {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: args.prompt.slice(0, 4000),
      size: args.size,
      quality: args.quality,
      n: 1,
      moderation: "low",
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    let msg = "";
    try { msg = JSON.parse(t)?.error?.message || t.slice(0, 200); } catch { msg = t.slice(0, 200); }
    return { ok: false, error: `${r.status}: ${msg}` };
  }
  const data = await r.json();
  const imgData = data?.data?.[0];
  let b64: string | null = imgData?.b64_json || null;
  // Se OpenAI retornou URL, converte pra b64
  if (!b64 && imgData?.url) {
    try {
      const imgRes = await fetch(imgData.url);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        b64 = btoa(binary);
      }
    } catch { /* swallow */ }
  }
  if (!b64) return { ok: false, error: "no image returned" };
  return { ok: true, b64 };
}

console.log(`[hub-storyboard] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      script,
      scene_count = 4,
      aspect_ratio = "9:16",
      quality = "medium",
      brand_id = null,
      brand_hint = "",
      market = null,
      market_context = "",
    } = body as {
      script?: string;
      scene_count?: number;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
      brand_id?: string | null;
      brand_hint?: string;
      market?: string | null;
      market_context?: string;
    };

    if (!script || script.trim().length < 10) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_script",
        message: "Roteiro precisa ter pelo menos 10 caracteres.",
      }, 400);
    }
    const N = Math.max(2, Math.min(8, Math.floor(scene_count)));
    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["9:16"];

    console.log(`[hub-storyboard] start — user=${authUser.id} N=${N} size=${size}`);

    // ── 1. Splitter: roteiro → bible + N scene prompts ──────────────
    let split: SplitterResponse;
    try {
      split = await splitScript({
        apiKey: OPENAI_API_KEY,
        script: script.trim(),
        sceneCount: N,
        brandHint: brand_hint,
        marketContext: market_context,
      });
    } catch (e) {
      console.error("[hub-storyboard] splitter error:", e);
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "splitter_failed",
        message: "Falha ao dividir o roteiro em cenas.",
        detail: String(e).slice(0, 300),
      }, 502);
    }

    const scenes: SceneSpec[] = split.scenes.slice(0, N).map((s, i) => ({
      n: typeof s.n === "number" ? s.n : i + 1,
      prompt: String(s.prompt || "").trim(),
    }));

    console.log(`[hub-storyboard] splitter ok — bible_len=${split.bible.length} scenes=${scenes.length}`);

    // ── 2. Gera N cenas EM PARALELO ─────────────────────────────────
    const results = await Promise.all(scenes.map(async s => {
      const r = await generateScene({
        apiKey: OPENAI_API_KEY,
        prompt: s.prompt,
        size,
        quality,
      });
      const result: SceneResult = {
        n: s.n,
        prompt: s.prompt,
        image_url: r.ok && r.b64 ? `data:image/png;base64,${r.b64}` : null,
        error: r.error,
      };
      return result;
    }));

    const okCount = results.filter(r => r.image_url).length;
    if (okCount === 0) {
      // Detecta se foi acesso (gpt-image-2 não verificada na conta)
      const firstErr = results[0]?.error || "unknown";
      const needsVerify = /must be verified|organization|verify/i.test(firstErr);
      return jsonResponse({
        _v: FN_VERSION, ok: false,
        error: needsVerify ? "needs_org_verification" : "all_scenes_failed",
        message: needsVerify
          ? "Sua organização OpenAI precisa ser verificada pra usar gpt-image-2."
          : "Todas as cenas falharam.",
        first_error: firstErr,
        verify_url: needsVerify ? "https://platform.openai.com/settings/organization/general" : undefined,
      }, 502);
    }

    // ── 3. Persiste cada cena no creative_memory ────────────────────
    const storyboardId = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    try {
      const rows = results
        .filter(r => r.image_url)
        .map(r => ({
          user_id: authUser.id,
          type: "hub_storyboard",
          content: {
            storyboard_id: storyboardId,
            scene_n: r.n,
            scene_count: scenes.length,
            prompt: r.prompt,
            image_url: r.image_url,
            aspect_ratio,
            size,
            quality,
            model: "gpt-image-2",
            brand_id: brand_id || null,
            market: market || null,
            script: script.trim(),
            bible: split.bible,
          },
          created_at: createdAt,
        }));
      if (rows.length > 0) {
        const { error: dbErr } = await sb.from("creative_memory").insert(rows);
        if (dbErr) console.warn("[hub-storyboard] DB insert error:", dbErr.message);
      }
    } catch (dbErr) {
      console.warn("[hub-storyboard] DB exception:", dbErr);
    }

    console.log(`[hub-storyboard] success — ${okCount}/${scenes.length} scenes generated`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      storyboard_id: storyboardId,
      bible: split.bible,
      scenes: results,
      total: scenes.length,
      succeeded: okCount,
      failed: scenes.length - okCount,
      aspect_ratio,
      size,
      brand_id: brand_id || null,
      market: market || null,
    }, 200);

  } catch (e) {
    console.error("[hub-storyboard] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
