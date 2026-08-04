/**
 * hub-bria-bg-remove — Background removal via BRIA AI.
 *
 * Substitui o uso de gpt-image-2 edits no modo "Converter imagem" do
 * PNG generator. gpt-image-2 é fundamentalmente uma ferramenta de
 * GERAÇÃO criativa — não preserva o sujeito da imagem original.
 * BRIA é um modelo dedicado a bg removal: extrai o sujeito real
 * pixel-fielmente em ~2-3s.
 *
 * Pipeline:
 *   1. JWT auth (rejeita anônimo)
 *   2. Recebe FormData ou JSON com imagem (data URL ou base64 raw)
 *   3. POST multipart pra BRIA /v1/background/remove
 *   4. Recebe PNG transparente, encoda como data URL e retorna
 *
 * Custo BRIA: free tier amplo (~50 imagens/mês free), depois pay-as-you-go.
 *
 * Secret necessária: BRIA_API_TOKEN (definir em Supabase Edge Functions secrets)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { safeFetch } from "../_shared/safe-fetch.ts";
import {
  reserveCredits, confirmCredits, refundCredits,
  insufficientCreditsResponse, getUserPlan,
} from "../_shared/hub-credits.ts";

// Versão do deploy — permite verificar de fora o que está no ar.
const FN_VERSION = "v13-2026-08-04-checkup";

const cors = {
  // Versão do deploy em todas as respostas — torna possível
  // verificar de fora o que realmente está no ar.
  "x-fn-version": FN_VERSION,
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRIA_BG_REMOVE_URL = "https://engine.prod.bria-api.com/v1/background/remove";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── JWT auth ────────────────────────────────────────
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

    // Bria cobra por chamada. Reserva antes de gastar.
    const briaPlan = await getUserPlan(supabase, user_id);
    const creditRes = await reserveCredits(supabase, user_id, briaPlan, "bg_remove");
    if (!creditRes.ok) return insufficientCreditsResponse(creditRes, cors);

    // ── Parse body — aceita JSON com base64 ou FormData ──
    const contentType = req.headers.get("content-type") || "";
    let imageBlob: Blob | null = null;
    let originalFilename = "input.png";
    let originalMime = "image/png";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      // Aceita 2 formatos: input_image_base64 (data URL ou base64 cru) OU
      // image_url (URL pública pra fazer fetch — usado pelos Workflows).
      let bytes: Uint8Array;
      const b64: string = body.input_image_base64 || "";
      const url: string = body.image_url || "";
      if (!b64 && !url) {
        // Reserva foi feita antes de validar o corpo; validação que falha
        // precisa devolver o crédito, senão o cliente paga por um 400.
        await refundCredits(supabase, creditRes.reservation_id!, "invalid_request");
        return new Response(
          JSON.stringify({ error: "missing_image", message: "input_image_base64 ou image_url obrigatório." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (b64) {
        const cleanBase64 = b64.replace(/^data:[^;]+;base64,/, "");
        const binary = atob(cleanBase64);
        bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      } else {
        // Fetch URL → bytes.
        // safeFetch e não fetch: `url` vem crua do corpo do request, e sem
        // checagem isto alcançava 169.254.169.254 e qualquer host de rede
        // privada que o runtime enxergue.
        const fetchRes = await safeFetch(url);
        if (!fetchRes.ok) {
          // A reserva de 5 créditos acontece antes de falar com a Bria.
          // Todo return de erro daqui pra frente tem que devolver, senão o
          // cliente paga por uma imagem que não existe — e o sweep só
          // conserta 30 a 60 minutos depois, com o saldo errado na tela.
          await refundCredits(supabase, creditRes.reservation_id!, "provider_failed");
          return new Response(
            JSON.stringify({ error: "input_image_fetch_failed", message: `Falha ao baixar imagem de ${url.slice(0, 80)}` }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
        const buf = await fetchRes.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
      // Detecta MIME por magic bytes
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        originalMime = "image/jpeg";
        originalFilename = "input.jpg";
      } else if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      ) {
        originalMime = "image/webp";
        originalFilename = "input.webp";
      }
      imageBlob = new Blob([bytes], { type: originalMime });
    } else {
      // FormData fallback (caso queiramos enviar do frontend direto)
      const fd = await req.formData();
      const file = fd.get("image") as File | null;
      if (!file) {
        // Reserva foi feita antes de validar o corpo; validação que falha
        // precisa devolver o crédito, senão o cliente paga por um 400.
        await refundCredits(supabase, creditRes.reservation_id!, "invalid_request");
        return new Response(
          JSON.stringify({ error: "missing_image", message: "Campo 'image' obrigatório (FormData) ou 'input_image_base64' (JSON)." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      imageBlob = file;
      originalFilename = file.name || "input.png";
    }

    const BRIA_API_TOKEN = Deno.env.get("BRIA_API_TOKEN");
    if (!BRIA_API_TOKEN) {
      // A reserva de 5 créditos acontece antes de falar com a Bria.
      // Todo return de erro daqui pra frente tem que devolver, senão o
      // cliente paga por uma imagem que não existe — e o sweep só
      // conserta 30 a 60 minutos depois, com o saldo errado na tela.
      await refundCredits(supabase, creditRes.reservation_id!, "provider_failed");
      return new Response(
        JSON.stringify({
          error: "missing_bria_key",
          message: "BRIA_API_TOKEN não configurada nos secrets do Supabase. Adicione a key em Project Settings → Edge Functions → Secrets.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // ── BRIA bg remove ────────────────────────────────────
    const briaForm = new FormData();
    briaForm.append("file", imageBlob, originalFilename);

    const briaRes = await fetch(BRIA_BG_REMOVE_URL, {
      method: "POST",
      headers: {
        "api_token": BRIA_API_TOKEN,
      },
      body: briaForm,
    });

    if (!briaRes.ok) {
      const errText = await briaRes.text();
      console.error("[hub-bria-bg-remove] BRIA error", briaRes.status, errText.slice(0, 400));
      let friendly: string;
      if (briaRes.status === 401 || briaRes.status === 403) {
        friendly = "BRIA_API_TOKEN inválida ou expirada.";
      } else if (briaRes.status === 429) {
        friendly = "BRIA rate-limited ou quota mensal estourada.";
      } else if (briaRes.status === 413) {
        friendly = "Imagem muito grande pra BRIA. Reduz pra <10MB.";
      } else {
        friendly = `BRIA error ${briaRes.status}.`;
      }
      // A reserva de 5 créditos acontece antes de falar com a Bria.
      // Todo return de erro daqui pra frente tem que devolver, senão o
      // cliente paga por uma imagem que não existe — e o sweep só
      // conserta 30 a 60 minutos depois, com o saldo errado na tela.
      await refundCredits(supabase, creditRes.reservation_id!, "provider_failed");
      return new Response(
        JSON.stringify({
          error: "bria_failed",
          message: friendly,
          raw: errText.slice(0, 300),
          status: briaRes.status,
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // BRIA pode responder de 2 formas dependendo do endpoint version:
    //   - JSON com { result_url: "https://..." } (v1 atual)
    //   - Binary PNG direto (alguns endpoints)
    // Detecta por content-type da resposta.
    const briaContentType = briaRes.headers.get("content-type") || "";
    let resultDataUrl: string;

    if (briaContentType.includes("application/json")) {
      const briaJson = await briaRes.json();
      const resultUrl = briaJson.result_url || briaJson.image_url || briaJson.url;
      if (!resultUrl) {
        console.error("[hub-bria-bg-remove] no result_url in JSON:", briaJson);
        // A reserva de 5 créditos acontece antes de falar com a Bria.
        // Todo return de erro daqui pra frente tem que devolver, senão o
        // cliente paga por uma imagem que não existe — e o sweep só
        // conserta 30 a 60 minutos depois, com o saldo errado na tela.
        await refundCredits(supabase, creditRes.reservation_id!, "provider_failed");
        return new Response(
          JSON.stringify({ error: "bria_no_url", message: "BRIA não retornou URL da imagem.", raw: JSON.stringify(briaJson).slice(0, 300) }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      // Faz fetch da result_url e converte pra data URL pra ficar self-contained
      const imgRes = await fetch(resultUrl);
      if (!imgRes.ok) {
        // A reserva de 5 créditos acontece antes de falar com a Bria.
        // Todo return de erro daqui pra frente tem que devolver, senão o
        // cliente paga por uma imagem que não existe — e o sweep só
        // conserta 30 a 60 minutos depois, com o saldo errado na tela.
        await refundCredits(supabase, creditRes.reservation_id!, "provider_failed");
        return new Response(
          JSON.stringify({ error: "bria_fetch_result", message: "Falha ao buscar resultado do BRIA." }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const buf = await imgRes.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);
      resultDataUrl = `data:image/png;base64,${base64}`;
    } else {
      // Binary direto
      const buf = await briaRes.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);
      resultDataUrl = `data:image/png;base64,${base64}`;
    }

    await confirmCredits(supabase, creditRes.reservation_id!);
    return new Response(
      JSON.stringify({
        ok: true,
        image_url: resultDataUrl,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    try { await refundCredits(supabase, creditRes.reservation_id!, "unexpected_error"); } catch { /* ignora */ }
    console.error("[hub-bria-bg-remove] fatal error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(error).slice(0, 400) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
