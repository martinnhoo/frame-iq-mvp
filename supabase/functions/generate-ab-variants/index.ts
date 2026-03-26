const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
    // ─────────────────────────────────────────────────────────────────────────

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const { script, product, platform, market } = await req.json();

    if (!script) return new Response(JSON.stringify({ error: 'Missing script' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        variants: [
          { angle: 'Curiosity Gap', hook: `Nobody's talking about what ${product} actually does to your results...`, script_rewrite: script.substring(0, 200) + ' [CURIOSITY VERSION]', predicted_score: 7.8, hook_type: 'curiosity', key_change: 'Opens with mystery, withholds key info until mid-script' },
          { angle: 'Social Proof', hook: `Over 50,000 people switched to ${product} last month — here's why...`, script_rewrite: script.substring(0, 200) + ' [SOCIAL PROOF VERSION]', predicted_score: 8.2, hook_type: 'social_proof', key_change: 'Leads with volume/momentum, creates FOMO' },
          { angle: 'Direct Offer', hook: `Get ${product} today — and here\'s exactly what happens in the first 7 days:`, script_rewrite: script.substring(0, 200) + ' [DIRECT VERSION]', predicted_score: 7.5, hook_type: 'direct_offer', key_change: 'No buildup — leads with the offer and a specific promise' },
        ],
        mock_mode: true
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `════════════════════════════════════════════════════════════
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

════════════════════════════════════════════════════════════\n\nYou are a world-class performance marketing creative director. Take this ad script and rewrite it 3 times — each with a completely different psychological angle/hook strategy.

ORIGINAL SCRIPT:
${script}

Product: ${product || 'the product'}
Platform: ${platform || 'TikTok/Reels'}
Market: ${market || 'global'}

Create 3 distinct A/B test variants. Each must:
- Keep the core offer/message identical
- Change ONLY the hook angle and narrative structure
- Be platform-native (authentic, not salesy)
- Have meaningfully different psychological triggers

Return ONLY valid JSON:
{
  "variants": [
    {
      "angle": "Short name for this angle (e.g. 'Curiosity Gap', 'Social Proof', 'Direct Offer', 'Fear/Pain', 'Transformation')",
      "hook": "The exact opening 1-2 sentences of this variant",
      "script_rewrite": "Full rewritten script — same length as original",
      "predicted_score": 8.1,
      "hook_type": "curiosity|social_proof|pattern_interrupt|direct_offer|emotional|fear|transformation",
      "key_change": "One sentence explaining the core psychological shift from original"
    }
  ]
}`
        }]
      })
    });

    if (!res.ok) throw new Error(`Claude API: ${res.status}`);
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify({ variants: parsed.variants, mock_mode: false }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
