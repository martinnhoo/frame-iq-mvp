// generate-image-hub — Image Generator interno (Brilliant Hub).
//
// Modelo único: gpt-image-2. Sem fallback. dall-e-3 é inútil pra
// criativos de ad — só polui a galeria com imagens de qualidade
// inferior. Se gpt-image-2 não tá disponível, retorna erro acionável
// (verify org) e a UI mostra a tela de "destravar".
//
// Brand context: front manda { brand_id, brand_hint, include_license,
// license_text }. A função injeta brand_hint no início e instrução
// pra reservar rodapé pro disclaimer no fim do prompt.

const FN_VERSION = "v18b-image-array-2026-05-06";

// Timeout explícito na chamada OpenAI. Supabase Edge Functions matam
// requests > 150s com a mensagem 'Request idle timeout limit (150s)
// reached' que vira 'fn=desconhecida' no frontend (resposta inutilizável).
// Cortamos antes em 130s pra retornar erro JSON limpo + mensagem útil
// pro user em vez do timeout cru do Supabase.
const OPENAI_TIMEOUT_MS = 130_000;

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

console.log(`[hub-image] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("[hub-image] OPENAI_API_KEY not configured");
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "openai_not_configured",
        message: "OPENAI_API_KEY não configurado no Supabase.",
      }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sem token de auth." }, 401);
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized", message: "Sessão inválida." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      prompt,
      aspect_ratio = "1:1",
      quality = "medium",
      brand_id = null,
      brand_hint = "",
      market = null,
      include_license = false,
      license_text = "",
      transparent = false,
      input_image_base64 = null,
      input_images_base64 = null,
    } = body as {
      prompt?: string;
      aspect_ratio?: string;
      quality?: "low" | "medium" | "high";
      brand_id?: string | null;
      brand_hint?: string;
      market?: string | null;
      include_license?: boolean;
      license_text?: string;
      transparent?: boolean;
      input_image_base64?: string | null;
      input_images_base64?: string[] | null;
    };

    // Consolida ambos os campos de input image numa única array.
    // - input_image_base64 (singular, legacy): PNG converter, 1 imagem
    // - input_images_base64 (array, novo): elementos do Image Studio, N imagens
    const allInputImages: string[] = [];
    if (input_image_base64) allInputImages.push(input_image_base64);
    if (Array.isArray(input_images_base64)) {
      for (const img of input_images_base64) {
        if (typeof img === "string" && img.length > 0) allInputImages.push(img);
      }
    }
    // gpt-image-2 edits: max 16 imagens.
    if (allInputImages.length > 16) allInputImages.length = 16;

    if (!prompt || prompt.trim().length < 5) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "invalid_prompt",
        message: "Descreva a imagem com pelo menos 5 caracteres.",
      }, 400);
    }

    // Constrói prompt final: [brand context] + [user prompt] + [disclaimer]
    const userPrompt = prompt.trim();
    const parts: string[] = [];
    if (brand_hint && brand_hint.trim()) parts.push(brand_hint.trim());
    parts.push(userPrompt);
    if (include_license && license_text && license_text.trim()) {
      parts.push(
        "IMPORTANT FOR COMPOSITION: Keep the bottom 12% of the image visually clean — " +
        "no important characters, text, faces or focal elements in this strip. " +
        "It will be covered by a regulatory disclaimer overlay in post-production. " +
        "Position main subjects in the upper 88% of the canvas."
      );
    }
    const finalPrompt = parts.join("\n\n").slice(0, 4000);
    const size = SIZE_MAP[aspect_ratio] || SIZE_MAP["1:1"];

    console.log("[hub-image] start", JSON.stringify({
      user_id: authUser.id, aspect_ratio, quality,
      brand_id: brand_id || null, market: market || null,
      include_license, prompt_len: finalPrompt.length,
    }));

    // ── Routing: edits (image-to-image) vs generations (text-to-image) ──
    // Quando há QUALQUER input image, usa /v1/images/edits. Casos:
    //   - PNG converter: 1 imagem (background removal)
    //   - Image Studio com elementos: N imagens (referências visuais)
    //   - Múltiplos elementos + bg removal: combinado
    let r: Response;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), OPENAI_TIMEOUT_MS);
    try {
      if (allInputImages.length > 0) {
        const fd = new FormData();
        fd.append("model", "gpt-image-2");

        // Adiciona TODAS as imagens como inputs visuais. gpt-image-2 edits
        // aceita até 16 e usa todas como contexto — ideal pra elementos
        // (mascote + ícones + objetos) servirem como referência visual fiel.
        let totalBytes = 0;
        for (let i = 0; i < allInputImages.length; i++) {
          const cleanBase64 = allInputImages[i].replace(/^data:[^;]+;base64,/, "");
          const binary = atob(cleanBase64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          totalBytes += bytes.length;
          // Detecta MIME por magic bytes (PNG: 89 50 4E 47, JPEG: FF D8 FF, WEBP: RIFF...WEBP)
          let mime = "image/png";
          let ext = "png";
          if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            mime = "image/jpeg"; ext = "jpg";
          } else if (
            bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
          ) {
            mime = "image/webp"; ext = "webp";
          }
          const inputBlob = new Blob([bytes], { type: mime });
          // OpenAI exige 'image[]' (com colchetes) pra múltiplas imagens.
          // Se mandar 'image' repetido N vezes, API retorna 'Duplicate parameter'.
          // Pra 1 imagem 'image[]' também funciona — então usa array sempre.
          fd.append("image[]", inputBlob, `input-${i}.${ext}`);
        }

        fd.append("prompt", finalPrompt);
        fd.append("size", size);
        fd.append("quality", quality);
        fd.append("n", "1");
        if (transparent) {
          fd.append("background", "transparent");
          fd.append("output_format", "png");
        }

        console.log("[hub-image] using EDITS endpoint, images:", allInputImages.length, "totalBytes:", totalBytes);
        r = await fetch("https://api.openai.com/v1/images/edits", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
          body: fd,
          signal: abortController.signal,
        });
      } else {
        r = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt: finalPrompt,
            size,
            quality,
            n: 1,
            moderation: "low",
            ...(transparent ? { background: "transparent", output_format: "png" } : {}),
          }),
          signal: abortController.signal,
        });
      }
    } catch (e) {
      // AbortError quando estourou o nosso timeout interno (130s)
      if ((e as Error).name === "AbortError") {
        console.error("[hub-image] OpenAI timeout after", OPENAI_TIMEOUT_MS, "ms");
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "openai_timeout",
          message: "OpenAI demorou demais pra responder. Tenta com qualidade 'Médio' ou 'Rascunho' — geração fica mais rápida.",
        }, 504);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!r.ok) {
      const errText = await r.text();
      let errMsg = "", errCode = "";
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed?.error?.message || "";
        errCode = parsed?.error?.code || "";
      } catch {}

      console.error(`[hub-image] gpt-image-2 ${r.status}:`, errText);

      // Detecta erro de "verify org" — vira código especial pra UI
      // mostrar tela de destravar org, com link direto.
      const m = errMsg.toLowerCase();
      const needsVerify = r.status === 403
        || m.includes("must be verified")
        || m.includes("verify organization")
        || m.includes("organization must be verified")
        || m.includes("does not have access");

      if (needsVerify) {
        return jsonResponse({
          _v: FN_VERSION, ok: false, error: "needs_org_verification",
          message: "Sua organização OpenAI precisa ser verificada pra usar gpt-image-2.",
          openai_status: r.status, openai_message: errMsg,
          verify_url: "https://platform.openai.com/settings/organization/general",
        }, 502);
      }

      let userError = "image_gen_failed";
      let userMessage = errMsg || `OpenAI retornou ${r.status}.`;
      if (errCode === "content_policy_violation" || m.includes("safety")) {
        userError = "content_policy";
        userMessage = "Prompt rejeitado por política de conteúdo da OpenAI.";
      } else if (r.status === 429) {
        userError = "rate_limited";
        userMessage = "Rate limit OpenAI atingido. Tenta de novo em ~1min.";
      } else if (r.status === 401) {
        userError = "openai_auth";
        userMessage = "Chave OpenAI inválida ou expirada.";
      } else if (r.status === 404) {
        userError = "model_not_found";
        userMessage = "Modelo gpt-image-2 não encontrado na conta OpenAI.";
      }

      return jsonResponse({
        _v: FN_VERSION, ok: false, error: userError, message: userMessage,
        openai_status: r.status, openai_message: errMsg, openai_code: errCode,
        detail: errText.slice(0, 500),
      }, 502);
    }

    const data = await r.json();
    const imgData = data?.data?.[0];
    const tempImageUrl: string | null = imgData?.url || null;
    let b64: string | null = imgData?.b64_json || null;
    const revisedPrompt = imgData?.revised_prompt || userPrompt;

    if (!tempImageUrl && !b64) {
      console.error("[hub-image] no image in response");
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_image_returned",
        message: "gpt-image-2 não retornou imagem.",
      }, 502);
    }

    // ── Converte pra data URL (base64) — sem Storage ─────────────────
    // Decisão: não usar Supabase Storage pra economizar custo. Em vez
    // disso, salva a imagem inteira como data URL no creative_memory.
    // A imagem fica permanente no banco, sem dependência de URL externa.
    // Trade-off: linhas DB ficam ~2MB cada. Pra uso interno (dezenas
    // de imagens, 5-10 users) é completamente OK.
    if (!b64 && tempImageUrl) {
      try {
        const imgRes = await fetch(tempImageUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const bytes = new Uint8Array(buf);
          // Encode bytes → base64
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          b64 = btoa(binary);
        } else {
          console.error("[hub-image] failed to fetch from openai url:", imgRes.status);
        }
      } catch (fetchErr) {
        console.error("[hub-image] fetch error:", fetchErr);
      }
    }

    const finalImageUrl = b64
      ? `data:image/png;base64,${b64}`
      : tempImageUrl;
    if (!finalImageUrl) {
      return jsonResponse({
        _v: FN_VERSION, ok: false, error: "no_image_returned",
        message: "Nenhuma URL de imagem disponível.",
      }, 502);
    }

    // ── Persiste na biblioteca como data URL (sem Storage) ──────────
    let memoryId: string | null = null;
    let dbDebug: { stage: string; message?: string; details?: unknown; code?: string; hint?: string } | null = null;
    try {
      const insertPayload = {
        user_id: authUser.id,
        type: "hub_image",
        content: {
          prompt: userPrompt,
          revised_prompt: revisedPrompt,
          final_prompt: finalPrompt,
          image_url: finalImageUrl,
          aspect_ratio, size, quality,
          model: "gpt-image-2",
          brand_id: brand_id || null,
          market: market || null,
          license_included: include_license,
          license_text: include_license ? license_text : null,
        },
        created_at: new Date().toISOString(),
      };
      console.log(`[hub-image] inserting — content size: ${JSON.stringify(insertPayload.content).length} bytes`);

      const { data: inserted, error: dbErr } = await sb.from("creative_memory")
        .insert(insertPayload)
        .select("id")
        .single();
      if (dbErr) {
        console.error("[hub-image] DB insert error:", JSON.stringify(dbErr));
        dbDebug = {
          stage: "insert_error",
          message: dbErr.message,
          details: dbErr.details,
          code: (dbErr as { code?: string }).code,
          hint: dbErr.hint,
        };
      } else {
        memoryId = inserted?.id || null;
        if (!memoryId) {
          dbDebug = { stage: "no_id_returned", details: inserted };
        }
      }
    } catch (dbErr) {
      console.error("[hub-image] DB insert exception:", dbErr);
      dbDebug = { stage: "exception", message: String(dbErr) };
    }

    console.log(`[hub-image] success — model=gpt-image-2 memory_id=${memoryId} dbDebug=${JSON.stringify(dbDebug)}`);

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      image_url: finalImageUrl,
      memory_id: memoryId,
      db_debug: dbDebug,
      prompt: userPrompt,
      revised_prompt: revisedPrompt,
      final_prompt: finalPrompt,
      aspect_ratio, size, quality,
      model_used: "gpt-image-2",
      brand_id: brand_id || null,
      market: market || null,
      license_included: include_license,
    }, 200);

  } catch (e) {
    console.error("[hub-image] unexpected error:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});
