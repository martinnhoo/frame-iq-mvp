import { createClient } from "npm:@supabase/supabase-js@2";
const createSvcClient = createClient;
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createSvcClient(
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
    const { product, offer, objective, market, audience, competitors, extra_context, user_id } = await req.json();
    // ── Plan gate — verify server-side, cannot be bypassed via frontend ──────
    if (user_id) {
      const { data: prof } = await supabase.from('profiles').select('plan').eq('id', user_id).maybeSingle();
      const plan = prof?.plan || 'free';
      const allowed = ['maker','pro','studio','creator','starter','scale'].includes(plan);
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'plan_required', message: 'This tool requires a paid plan.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }


    if (!product) return new Response(JSON.stringify({ error: "Missing product" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    // Fetch accumulated creative context from the loop
    let loopContext = "";
    if (user_id) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const loopRes = await fetch(`${supabaseUrl}/functions/v1/creative-loop`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ action: "get_context", user_id }),
        });
        if (loopRes.ok) {
          const loopData = await loopRes.json();
          if (loopData.has_data && loopData.context) {
            loopContext = `\n\n--- ACCOUNT CREATIVE INTELLIGENCE (learned from this client's real ad data) ---\n${loopData.context}\n--- Use these insights to calibrate the brief. Favor proven patterns when applicable. ---`;
          }
        }
      } catch { /* loop context is optional */ }
    }

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });

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

════════════════════════════════════════════════════════════\n\nYou are a senior creative strategist at a performance marketing agency. You write campaign briefs that editors and creative teams can execute immediately — specific, actionable, no filler.

A good brief:
- Tells the editor exactly who they're talking to and why that person should care
- Defines the ONE core message — not five
- Gives format recommendations with rationale based on the objective and audience
- Includes visual direction that's concrete (not "dynamic and engaging")
- Lists what NOT to do — this is as important as what to do
- Respects compliance rules for the market and industry

You never write generic briefs. Every line should feel specific to this product and this audience.`;

    const userPrompt = `Create a complete campaign creative brief for:

Product: ${product}
${offer ? `Offer/Promotion: ${offer}` : ""}
Objective: ${objective}
Market: ${market}
${audience ? `Audience notes: ${audience}` : ""}
${competitors ? `Competitors/References: ${competitors}` : ""}
${extra_context ? `Extra context: ${extra_context}` : ""}
${loopContext}

Return ONLY a JSON object — no markdown, no explanation:
{
  "campaign_name": "short descriptive name",
  "objective": "specific campaign objective in 2-3 sentences",
  "target_audience": {
    "demographics": "age, gender, location, income level",
    "psychographics": "lifestyle, interests, behavior, values",
    "pain_points": ["pain 1", "pain 2", "pain 3"],
    "triggers": ["trigger 1", "trigger 2", "trigger 3"]
  },
  "core_message": "the single most important thing to communicate",
  "value_proposition": "why this product, why now, why for them",
  "tone_and_voice": "specific tone description with examples",
  "formats": [
    {"format": "format name", "rationale": "why this format", "duration": "15s/30s/60s"}
  ],
  "key_messages": ["message 1", "message 2", "message 3"],
  "cta": "exact CTA text",
  "compliance_notes": "compliance rules or empty string",
  "visual_direction": "specific visual style — concrete not vague",
  "reference_style": "describe reference creative style",
  "kpis": ["KPI 1", "KPI 2", "KPI 3"],
  "do_not": ["avoid 1", "avoid 2", "avoid 3", "avoid 4"]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    let brief;
    try {
      brief = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ brief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-brief error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
