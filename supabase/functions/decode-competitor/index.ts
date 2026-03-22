// decode-competitor v5 — idioma forçado, score 0-1000 calibrado, detecção de URL
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const { ad_text, observation, persona_context, ui_language } = await req.json();
    if (!ad_text) return new Response(JSON.stringify({ error: 'ad_text required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const lang = ui_language || 'pt';

    // Detect if input is just a URL (can't extract content)
    const isUrl = /^https?:\/\/\S+$/.test(ad_text.trim());
    if (isUrl) {
      const msgs: Record<string, string> = {
        pt: 'Não consigo acessar o conteúdo do vídeo diretamente pelo link. Cole a transcrição, legenda ou copy do anúncio aqui — funciona com qualquer texto do vídeo.',
        es: 'No puedo acceder al contenido del video directamente por el enlace. Pega la transcripción, subtítulos o copy del anuncio aquí.',
        en: 'Cannot access video content directly from the URL. Paste the transcript, captions or ad copy here.',
      };
      return new Response(JSON.stringify({
        error_type: 'url_not_supported',
        message: msgs[lang] || msgs.pt,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Language maps
    const LANG_NAMES: Record<string, string> = { pt: 'Português Brasileiro (PT-BR)', es: 'Español', en: 'English' };
    const langName = LANG_NAMES[lang] || LANG_NAMES.pt;

    // Score rubric — fixed calibration for consistency
    const SCORE_RUBRIC = `
HOOK SCORE (0–1000) — use this exact rubric every time for calibration:
0–200:   Weak. Generic, no scroll-stop, no emotion, no specificity. Forgettable.
201–400: Below average. One hook element present but weak execution. Won't stop scroll.
401–550: Average. Functional but predictable. Seen before. Competes, doesn't win.
551–700: Good. Clear hook, one strong trigger, relevant to audience. Gets clicks.
701–850: Strong. Scroll-stopping, emotionally charged, platform-native, specific. Top 20%.
851–950: Viral potential. Pattern interrupt + strong emotion + immediate clarity. Top 5%.
951–1000: Exceptional. Rare. Combines: unexpected + relatable + platform-perfect + urgency. Hall of fame.

Calibration anchors:
- "Clique aqui para saber mais" = 150
- "Esse app mudou minha vida" = 420
- "90% das pessoas perdem dinheiro apostando. Você é 1 deles?" = 720
- "Proibido para menores: o método que corretores não querem que você veja" = 840
- "Fiz R$4.800 em 3 dias. Aqui está exatamente o que eu fiz." = 890`;

    const systemPrompt = `IDIOMA OBRIGATÓRIO: ${langName}
Você É um analista de performance que gastou mais de R$50M em anúncios.
TODAS as suas respostas DEVEM estar em ${langName} — sem exceção.
Não escreva NADA em inglês. Nem labels, nem valores, nem campos do JSON.
Se o anúncio está em outro idioma, sua análise continua em ${langName}.

${SCORE_RUBRIC}

Retorne APENAS JSON válido. Zero texto fora do JSON.`;

    const userPrompt = `Decodifique este anúncio concorrente:

CONTEÚDO DO ANÚNCIO:
${ad_text}

${observation ? `FOCO DO USUÁRIO: ${observation}` : ''}
${persona_context ? `CONTEXTO DA MINHA CONTA: ${persona_context}` : ''}

Retorne EXATAMENTE este JSON (todos os valores em ${langName}):
{
  "industry": "<setor identificado do conteúdo — seja específico: 'iGaming/Cassino BR', 'E-commerce Moda Feminina', 'SaaS B2B RH'>",
  "market": "<mercado detectado pelo idioma/moeda/gíria: 'Brasil', 'México', 'EUA'>",
  "mismatch_detected": false,
  "mismatch_reason": "",

  "hook_score": <número inteiro 0-1000 usando o rubric acima>,
  "hook_score_label": "<ex: 'Acima da média', 'Viral potential', 'Abaixo da média'>",
  "hook_type": "<tipo em ${langName}: 'Prova Social', 'Curiosidade', 'Dor', 'Oferta Direta', 'Interrupção de Padrão', 'Pergunta', 'Emocional'>",
  "hook_formula": "<fórmula extraída dos primeiros 3 segundos>",
  "hook_dissection": "<2 frases: por que este hook funciona ou falha — seja direto e específico>",

  "format": "<formato em ${langName}: 'UGC', 'Depoimento', 'Tutorial', 'Problema-Solução', 'Antes-Depois', 'Promo', 'Demo', 'Talking Head', 'Slideshow', 'Nativo'>",
  "target_audience": "<1 frase: faixa etária, intenção, estado de consciência>",
  "emotional_triggers": ["<gatilho>", "<gatilho>", "<gatilho>"],

  "strengths": ["<ponto forte + por que funciona>"],
  "weaknesses": ["<fraqueza + o que está faltando>"],

  "threat_level": "<low|medium|high|critical>",
  "counter_strategy": "<máximo 3 frases: táticas concretas para superar este anúncio. Nomeie o ângulo de hook, gatilho emocional e formato a usar.>",

  "steal_worthy": ["<elemento + como adaptar>"],

  "ready_hooks": [
    { "hook": "<hook pronto para usar — copiar e colar>", "angle": "<3-5 palavras: o que torna diferente>" },
    { "hook": "<gatilho emocional diferente>", "angle": "<ângulo>" },
    { "hook": "<abordagem de interrupção de padrão>", "angle": "<ângulo>" }
  ],

  "immediate_action": "<1 ação concreta para fazer HOJE. Específica, não vaga.>"
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic ${res.status}: ${t.slice(0,200)}`); }
    const data = await res.json();
    const raw = data.content?.[0]?.type === 'text' ? data.content[0].text : '{}';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return new Response(JSON.stringify({ ...parsed, mock_mode: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('decode-competitor error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// redeploy 202603251700
