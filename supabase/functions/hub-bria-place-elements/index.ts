/**
 * hub-bria-place-elements — coloca um elemento (mascote/personagem)
 * fielmente em uma cena gerada via BRIA Lifestyle Shot by Text.
 *
 * Diferente do gpt-image-2 que regenera tudo, BRIA Lifestyle Shot:
 *   - Mantém o elemento PIXEL-FIEL (rosto, cores, pose, identidade)
 *   - Gera uma cena ao redor dele baseada na descrição
 *   - Otimizado pra product placement / character placement
 *
 * É exatamente o equivalente API do "manda esse personagem e adiciona
 * nessa cena" do ChatGPT consumer.
 *
 * Pipeline:
 *   1. JWT auth
 *   2. Recebe { element_image_base64, scene_description, aspect_ratio?, num_results? }
 *   3. POST multipart pra BRIA /v1/product/lifestyle_shot_by_text
 *   4. Retorna PNG resultante como data URL
 *
 * Custo: parte do pacote BRIA, free tier ~50/mês.
 *
 * Secret: BRIA_API_TOKEN (mesma usada no hub-bria-bg-remove).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRIA_LIFESTYLE_URL =
  "https://engine.prod.bria-api.com/v1/product/lifestyle_shot_by_text";

// Aspect ratio → output resolution (matches gpt-image-2 sizes pra
// consistência visual com o resto do Hub).
const SIZE_MAP: Record<string, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 1024 },
  "9:16": { width: 1024, height: 1536 },
};

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

    const body = await req.json().catch(() => ({}));
    const elementBase64: string = (body.element_image_base64 || "").toString();
    const sceneDescription: string = (body.scene_description || "").toString().trim();
    const aspectRatio: string = (body.aspect_ratio || "1:1").toString();
    const numResults: number = Math.min(Math.max(parseInt(String(body.num_results || 1), 10) || 1, 1), 4);

    if (!elementBase64) {
      return new Response(
        JSON.stringify({ error: "missing_element", message: "element_image_base64 obrigatório (PNG do elemento, idealmente com fundo transparente)." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (!sceneDescription || sceneDescription.length < 5) {
      return new Response(
        JSON.stringify({ error: "missing_scene", message: "scene_description obrigatória (pelo menos 5 chars)." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const BRIA_API_TOKEN = Deno.env.get("BRIA_API_TOKEN");
    if (!BRIA_API_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "missing_bria_key",
          message: "BRIA_API_TOKEN não configurada nos secrets do Supabase.",
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Decode base64 do elemento + detect MIME
    const cleanBase64 = elementBase64.replace(/^data:[^;]+;base64,/, "");
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    let elementMime = "image/png";
    let elementFilename = "element.png";
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      elementMime = "image/jpeg";
      elementFilename = "element.jpg";
    } else if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      elementMime = "image/webp";
      elementFilename = "element.webp";
    }
    const elementBlob = new Blob([bytes], { type: elementMime });

    // Resolução output
    const size = SIZE_MAP[aspectRatio] || SIZE_MAP["1:1"];

    // ── BRIA Lifestyle Shot ─────────────────────────────────
    // Usa multipart/form-data com 'file' como product image. Outras opções:
    //   - placement_type: 'automatic' (deixa BRIA decidir o melhor lugar)
    //                     'manual_placement', 'manual_padding', 'original'
    //   - optimize_description: true (BRIA expande/refina o prompt)
    //   - sync: true (retorna direto em vez de polling de task)
    //   - num_results: 1-4
    //   - fast: true/false (modo rápido, qualidade um pouco menor)
    const briaForm = new FormData();
    briaForm.append("file", elementBlob, elementFilename);
    briaForm.append("scene_description", sceneDescription);
    briaForm.append("placement_type", "automatic");
    briaForm.append("optimize_description", "true");
    briaForm.append("num_results", String(numResults));
    briaForm.append("sync", "true");
    briaForm.append("output_resolution", `${size.width}x${size.height}`);

    console.log("[hub-bria-place-elements] calling BRIA", {
      element_bytes: bytes.length,
      scene_len: sceneDescription.length,
      output: `${size.width}x${size.height}`,
    });

    const briaRes = await fetch(BRIA_LIFESTYLE_URL, {
      method: "POST",
      headers: { "api_token": BRIA_API_TOKEN },
      body: briaForm,
    });

    if (!briaRes.ok) {
      const errText = await briaRes.text();
      console.error("[hub-bria-place-elements] BRIA error", briaRes.status, errText.slice(0, 400));
      let friendly: string;
      if (briaRes.status === 401 || briaRes.status === 403) {
        friendly = "BRIA_API_TOKEN inválida ou expirada.";
      } else if (briaRes.status === 429) {
        friendly = "BRIA rate-limited ou quota mensal estourada.";
      } else if (briaRes.status === 400) {
        friendly = "BRIA rejeitou os parâmetros — talvez a imagem precise ter fundo transparente. Tenta primeiro converter pra PNG no Gerador de PNG.";
      } else if (briaRes.status === 413) {
        friendly = "Imagem do elemento muito grande pra BRIA.";
      } else {
        friendly = `BRIA error ${briaRes.status}.`;
      }
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

    // BRIA pode retornar:
    //   - JSON { result_url: "..." } ou { result: ["url1", "url2"] }
    //   - Binary direto (depends do endpoint version)
    const briaContentType = briaRes.headers.get("content-type") || "";
    let resultDataUrl: string;
    let allUrls: string[] = [];

    if (briaContentType.includes("application/json")) {
      const briaJson = await briaRes.json();
      // Tenta múltiplas estruturas possíveis
      if (Array.isArray(briaJson.result)) {
        allUrls = briaJson.result.map((r: unknown) =>
          typeof r === "string" ? r : ((r as { url?: string })?.url || "")
        ).filter(Boolean);
      } else if (briaJson.result_url) {
        allUrls = [briaJson.result_url];
      } else if (briaJson.result && typeof briaJson.result === "string") {
        allUrls = [briaJson.result];
      } else if (briaJson.image_url) {
        allUrls = [briaJson.image_url];
      } else if (Array.isArray(briaJson.urls)) {
        allUrls = briaJson.urls;
      }

      if (allUrls.length === 0) {
        console.error("[hub-bria-place-elements] no result url in JSON:", briaJson);
        return new Response(
          JSON.stringify({
            error: "bria_no_url",
            message: "BRIA não retornou URL — pode ter mudado o formato da resposta.",
            raw: JSON.stringify(briaJson).slice(0, 400),
          }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // Pega o primeiro resultado e converte em data URL pra evitar
      // dependência de URL externa (URLs BRIA expiram em ~24h).
      const imgRes = await fetch(allUrls[0]);
      if (!imgRes.ok) {
        return new Response(
          JSON.stringify({ error: "bria_fetch_result", message: "Falha ao buscar resultado do BRIA." }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const buf = await imgRes.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let bin = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(bin);
      resultDataUrl = `data:image/png;base64,${base64}`;
    } else {
      // Binary direto
      const buf = await briaRes.arrayBuffer();
      const u8 = new Uint8Array(buf);
      let bin = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < u8.length; i += chunkSize) {
        bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(bin);
      resultDataUrl = `data:image/png;base64,${base64}`;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        image_url: resultDataUrl,
        all_urls: allUrls.length > 1 ? allUrls : undefined,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[hub-bria-place-elements] fatal error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: String(error).slice(0, 400) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
