import { getEffectivePlan } from "../_shared/credits.ts";
import { requireCredits } from "../_shared/deductCredits.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VO_LANG: Record<string, string> = {
  BR: "Brazilian Portuguese", MX: "Mexican Spanish",
  US: "English", IN: "English (Indian market)",
  GLOBAL: "English",
};

const FORMAT_GUIDE: Record<string, string> = {
  ugc:          "User-generated style. Casual, first person, feels authentic and unpolished. Like a real person sharing their experience. No corporate language.",
  vsl:          "Video sales letter. Direct response. Problem → Agitate → Solution → Proof → CTA. Every line earns the next.",
  talking_head: "Direct to camera. Educational or authority positioning. Clear, confident, structured. Can include personal story or insight.",
  hook_only:    "Only the first 3–5 seconds. Pattern interrupt that stops the scroll. No need to resolve — just hook hard.",
  product_demo: "Show the product. Feature → Benefit → Proof. Visual-led. VO supports what's on screen.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Auth header verification (prevents user_id spoofing) ────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authUser) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const verified_user_id = authUser.id;
    // ─────────────────────────────────────────────────────────────────────────
    const { product, offer, audience, format, duration, market, angle, extra_context, user_id, ui_language } = await req.json();
    const effectiveUserId = verified_user_id;

    // ── Credit check — must occur before AI logic ───────────────────────────
    const creditCheck = await requireCredits(supabase, verified_user_id, "script");
    if (!creditCheck.allowed) return new Response(JSON.stringify(creditCheck.error), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (!product) return new Response(JSON.stringify({ error: "Missing product" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // ── Load full account intelligence in parallel ──────────────────────────
    let loopContext = "";
    if (effectiveUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const restHeaders = { apikey: svcKey, Authorization: `Bearer ${svcKey}` };
      try {
        const [profileRes, snapshotRes, loopFetch, memoryFetch] = await Promise.allSettled([
          fetch(`${supabaseUrl}/rest/v1/user_ai_profile?user_id=eq.${effectiveUserId}&select=industry,pain_point,avg_hook_score,creative_style,top_performing_models`, { headers: restHeaders }),
          fetch(`${supabaseUrl}/rest/v1/daily_snapshots?user_id=eq.${effectiveUserId}&select=date,avg_ctr,total_spend,top_ads,ai_insight&order=date.desc&limit=1`, { headers: restHeaders }),
          fetch(`${supabaseUrl}/functions/v1/creative-loop`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
            body: JSON.stringify({ action: "get_context", user_id: effectiveUserId }),
          }),
          fetch(`${supabaseUrl}/rest/v1/chat_memory?user_id=eq.${effectiveUserId}&select=memory_text,memory_type,importance&order=importance.desc&limit=8`, { headers: restHeaders }),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value.ok) {
          const profiles = await profileRes.value.json();
          const p = Array.isArray(profiles) ? profiles[0] : profiles;
          if (p) {
            const rawNotes = (p.pain_point || "") as string;
            const instructions = rawNotes.split("|||").filter((s: string) => !s.startsWith("Usuário:") && !s.startsWith("Nicho:") && s.trim()).join(" | ");
            loopContext += `\n\n=== ACCOUNT PROFILE ===`;
            if (p.industry) loopContext += `\nIndustry: ${p.industry}`;
            if (p.creative_style) loopContext += `\nCreative style: ${p.creative_style}`;
            if (p.avg_hook_score) loopContext += `\nAvg hook score: ${p.avg_hook_score}/10`;
            if (instructions) loopContext += `\nPermanent instructions: ${instructions}`;
          }
        }
        if (snapshotRes.status === "fulfilled" && snapshotRes.value.ok) {
          const snaps = await snapshotRes.value.json();
          const s = Array.isArray(snaps) ? snaps[0] : snaps;
          if (s) {
            const top = ((s.top_ads as any[]) || []).filter((a: any) => a.isScalable || (a.ctr > 0.02)).slice(0, 3);
            loopContext += `\n\n=== META ADS CONTEXT (${s.date}) ===`;
            loopContext += `\nAccount CTR: ${((s.avg_ctr||0)*100).toFixed(2)}% | Spend: $${(s.total_spend||0).toFixed(0)}`;
            if (top.length) loopContext += `\nTop ads: ${top.map((a: any) => `"${a.name}" CTR ${((a.ctr||0)*100).toFixed(2)}%`).join(" | ")}`;
            if (s.ai_insight) loopContext += `\nInsight: ${s.ai_insight}`;
          }
        }
        if (loopFetch.status === "fulfilled" && loopFetch.value.ok) {
          const loopData = await loopFetch.value.json();
          if (loopData.has_data && loopData.context) {
            loopContext += `\n\n=== PROVEN CREATIVE PATTERNS ===\n${loopData.context}\n=== Use winning patterns to write scripts. ===`;
          }
        }
        if (memoryFetch.status === "fulfilled" && memoryFetch.value.ok) {
          const mems = await memoryFetch.value.json();
          const relevant = (Array.isArray(mems) ? mems : []).filter((m: any) => ['preference','rule','decision'].includes(m.memory_type)).slice(0, 5);
          if (relevant.length > 0) {
            loopContext += `\n\n=== USER PREFERENCES (from past conversations) ===`;
            loopContext += relevant.map((m: any) => `\n• ${m.memory_text}`).join('');
          }
        }
      } catch { /* context is optional */ }
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Language: ui_language (user's app language) is the PRIMARY source of truth.
    // Market is only a fallback. Never hardcode English for VISUAL/notes.
    const UI_LANG_MAP: Record<string, string> = {
      pt: "Portuguese (Brazil)",
      es: "Spanish",
      en: "English",
    };
    const visualLang = ui_language && UI_LANG_MAP[ui_language]
      ? UI_LANG_MAP[ui_language]
      : VO_LANG[market] || "English";

    const systemPrompt = `════════════════════════════════════════════════════════════
ADBRIEF AI CONSTITUTION — APLICA A TODO OUTPUT DESTA IA
════════════════════════════════════════════════════════════

BLOCO 1 — INTEGRIDADE DE DADOS (não negociável)

REGRA 1: ZERO NÚMEROS INVENTADOS
Nunca escreva percentuais, quantidades ou estatísticas que não estejam nos dados reais da conta ou contexto fornecido.
PROIBIDO: "80% dos pacientes", "2.400 casos", "15 mil clientes", "87% de sucesso", "3x mais resultados"
PERMITIDO: dados reais dos padrões da conta, ou especificidades verificáveis ("60 anos de experiência", "Jabaquara SP")
Se não há dado real → use especificidade de experiência, não estatística fabricada.

REGRA 2: ZERO CLAIMS NÃO VERIFICÁVEIS
PROIBIDO: "técnica que hospitais escondem", "médicos não querem que você saiba", "resultado garantido", "o único método"
PERMITIDO: o que a empresa pode demonstrar, mostrar, testemunhar publicamente.

REGRA 3: DADOS REAIS TÊM PRIORIDADE ABSOLUTA
Se o contexto contém dados reais da conta (CTR, ROAS, conversões, padrões aprendidos), USE-OS.
Dados reais > generalização de mercado > inferência > nada.

BLOCO 2 — INTELIGÊNCIA POR NICHO (o que torna preciso)

SAÚDE/MÉDICO: A pessoa com doença crônica já vive com o medo — NÃO amplifique.
"você pode estar acelerando a amputação" = predatório, não persuasivo.
Use: credibilidade ("60 anos tratando"), caminho forward, resultado de pacientes reais.
Evite: urgência falsa, consequências extremas, julgamento do paciente.

APOSTAS/IGAMING BR: use "autorizado" nunca "legalizado". Nunca implique ganho garantido.
CTA padrão: "Jogue agora". Inclua disclaimer de jogo responsável quando relevante.

FINANÇAS/CRÉDITO: Nunca prometa aprovação garantida. Evite linguagem que explore vulnerabilidade.

EMAGRECIMENTO/ESTÉTICA: Nunca prometa resultado específico sem laudo. Evite before/after com números sem evidência.

INFOPRODUTOS: Evite "R$X em Y dias" sem prova documental. Nunca use depoimentos de renda como padrão.

BLOCO 3 — TESTE DE QUALIDADE (antes de entregar)

Antes de finalizar qualquer output, verifique:
1. Contém número que não veio dos dados reais? → REMOVA
2. A empresa consegue provar esse claim se questionada? → Se não, REFORMULE
3. Isso poderia estar num artigo genérico sem contexto da conta? → Se sim, REESCREVA
4. Respeita as regras do nicho identificado? → Se não, AJUSTE

════════════════════════════════════════════════════════════\n\nYou are a senior performance creative director with 12 years writing scripts for paid social — iGaming, DTC, fintech, apps. Your scripts consistently outperform AI-generated content because they feel human, specific, and platform-native.

Script output format:
- VO (voiceover): written in ${visualLang} — natural spoken rhythm, not written prose
- ON-SCREEN: short text overlays in ${visualLang}, punchy, 1–5 words max each
- VISUAL: production notes in ${visualLang} — what the editor should show, transitions, pacing cues

${visualLang === "Portuguese (Brazil)" ? `EXEMPLO DE VISUAL CORRETO em Português:
❌ ERRADO: "Close-up shot of hands scrolling. Quick cut to dashboard."
✅ CORRETO: "Close nas mãos rolando a tela. Corte rápido para o dashboard."

REGRA ABSOLUTA: TODO campo do JSON — VO, ON-SCREEN, VISUAL, title, notes — deve estar em Português do Brasil. Zero palavras em inglês.` : visualLang === "Spanish" ? `EJEMPLO DE VISUAL CORRECTO en Español:
❌ INCORRECTO: "Close-up shot of hands scrolling. Quick cut to dashboard."
✅ CORRECTO: "Primer plano de manos deslizando la pantalla. Corte rápido al dashboard."

REGLA ABSOLUTA: TODO campo del JSON — VO, ON-SCREEN, VISUAL, title, notes — debe estar en Español. Cero palabras en inglés.` : ""}

Rules you never break:
- VO must sound like a real human speaking, not reading
- No buzzwords: "unlock", "elevate", "transform", "game-changer", "delve", "innovative"
- Respect the format guide exactly
- ALL fields (VO, ON-SCREEN, VISUAL, title, notes) MUST be written exclusively in ${visualLang}
- Each of the 3 scripts must have a completely different hook angle and rhythm
- Compliance: if market is BR and product is iGaming, use "autorizado" not "legalizado", CTA "Jogue agora"`;

    const userPrompt = `Generate 3 distinct script variations for:

Product: ${product}
${offer ? `Offer/CTA: ${offer}` : ""}
${audience ? `Target audience: ${audience}` : ""}
Format: ${format} — ${FORMAT_GUIDE[format] || format}
Duration: ${duration}
Market: ${market} (ALL text — VO, ON-SCREEN, VISUAL notes, director notes — must be in ${visualLang})
Creative angle: ${angle}
${extra_context ? `Extra context: ${extra_context}` : ""}
${loopContext}

CRITICAL: Every single word in the output must be in ${visualLang}. Zero English words unless market is US/GLOBAL.
${visualLang === "Portuguese (Brazil)" ? "VISUAL example — CORRETO: 'Close nas mãos rolando a tela. Corte rápido para o dashboard com métricas subindo.'" : ""}
${visualLang === "Spanish" ? "VISUAL example — CORRECTO: 'Primer plano de manos en el teléfono. Corte rápido al dashboard con métricas subiendo.'" : ""}

Return ONLY a JSON object — no markdown, no explanation:
{
  "scripts": [
    {
      "title": "Script title (5 words max)",
      "duration": "${duration}",
      "format": "${format}",
      "hook_score": 0-100,
      "lines": [
        {"type": "vo", "text": "..."},
        {"type": "onscreen", "text": "..."},
        {"type": "visual", "text": "..."}
      ],
      "notes": "Director notes for editor"
    }
  ]
}

Each script needs 8–15 lines alternating VO/on-screen/visual. Vary the angle dramatically between the 3 scripts.`;

    // Auto-retry on transient errors
    const callScript = async () => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 3000, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
    });
    let response = await callScript();
    if (!response.ok && (response.status === 500 || response.status === 529)) {
      await new Promise(r => setTimeout(r, 1000));
      response = await callScript();
    }
    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Claude API error: ${response.status}`, details: errorText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseData = await response.json();
    const rawText = responseData.content?.[0]?.type === "text" ? responseData.content[0].text : "{}";
    // Robust JSON extraction
    let raw = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonM = raw.match(/(\{[\s\S]*\})/); if (jsonM) raw = jsonM[1];
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-script error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
