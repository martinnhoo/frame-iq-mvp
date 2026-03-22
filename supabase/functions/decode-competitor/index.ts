// decode-competitor v6 — CS sênior briefing, prosa densa, copy pronto
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

    // Smart URL handling — try to extract content from public pages
    const isUrl = /^https?:\/\/\S+$/.test(ad_text.trim());
    let extractedContent = ad_text;
    let extractionNote = '';

    if (isUrl) {
      const url = ad_text.trim();
      let domain = '';
      try { domain = new URL(url).hostname.replace('www.', ''); } catch { domain = url; }

      try {
        const fetchRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] || '';
          const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)?.[1] || '';
          const twitterDesc = html.match(/<meta[^>]+name="twitter:description"[^>]+content="([^"]+)"/i)?.[1] || '';
          const bodyText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ').trim().slice(0, 2000);

          const extracted = [ogTitle, ogDesc, twitterDesc, bodyText].filter(Boolean).join(' | ').slice(0, 3000);

          if (extracted.length > 80) {
            extractedContent = `[URL: ${url}]\n${extracted}`;
            extractionNote = `Conteúdo extraído de ${domain}.`;
          } else {
            const msgs: Record<string, string> = {
              pt: `Acessei ${domain} mas não encontrei texto suficiente (provável bloqueio ou conteúdo em vídeo). Cole o copy, legenda ou roteiro do anúncio diretamente.`,
              es: `Accedí a ${domain} pero no hay texto suficiente (probable bloqueo o contenido en video). Pega el copy o subtítulos directamente.`,
              en: `Accessed ${domain} but not enough text found (likely blocked or video-only content). Paste the ad copy or captions directly.`,
            };
            return new Response(JSON.stringify({ error_type: 'insufficient_content', message: msgs[lang] || msgs.pt }), { headers: { ...cors, 'Content-Type': 'application/json' } });
          }
        } else {
          const msgs: Record<string, string> = {
            pt: `${domain} bloqueou o acesso automático (${fetchRes.status}). Cole o texto, copy ou legenda do anúncio diretamente — funciona com qualquer coisa que você conseguir copiar.`,
            es: `${domain} bloqueó el acceso automático. Pega el copy o subtítulos del anuncio directamente.`,
            en: `${domain} blocked automatic access. Paste the ad copy or captions directly.`,
          };
          return new Response(JSON.stringify({ error_type: 'blocked', message: msgs[lang] || msgs.pt }), { headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      } catch (_e) {
        const msgs: Record<string, string> = {
          pt: `Não consegui acessar esse link. Cole o texto, copy ou legenda do anúncio diretamente.`,
          es: `No pude acceder al enlace. Pega el texto del anuncio directamente.`,
          en: `Could not access this link. Paste the ad text directly.`,
        };
        return new Response(JSON.stringify({ error_type: 'fetch_error', message: msgs[lang] || msgs.pt }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    const LANG_NAMES: Record<string, string> = { pt: 'Português Brasileiro (PT-BR)', es: 'Español', en: 'English' };
    const langName = LANG_NAMES[lang] || LANG_NAMES.pt;

    const systemPrompt = `IDIOMA: ${langName}. Escreva TUDO em ${langName}. Sem inglês, sem exceção.

Você é um Creative Strategist sênior com +$50M gastos em tráfego pago.
Sua função é analisar anúncios de concorrentes e entregar um briefing denso, específico e acionável.
Você pensa como alguém que vai replicar e superar esse anúncio amanhã.

PRINCÍPIOS:
- Seja específico ao ponto de dor. Nunca genérico.
- Cada frase deve fazer alguém agir diferente.
- Copy pronto = copiar e colar, sem adaptar.
- Se o anúncio for fraco, diga por que claramente.
- Identifique o setor/nicho DO CONTEÚDO — não assuma.

SCORE DE HOOK (0–1000) — use sempre os mesmos critérios:
0–200:   Genérico, zero scroll-stop, esquecível imediatamente.
201–400: Um elemento de hook presente, execução fraca.
401–550: Funcional, previsível. Visto mil vezes. Não vence.
551–700: Bom. Gatilho claro, relevante. Consegue cliques.
701–850: Forte. Para o scroll, emoção + clareza. Top 20%.
851–950: Viral potential. Inesperado + relatable + plataforma-nativo. Top 5%.
951–1000: Excepcional. Hall of fame.
Âncoras: "Clique aqui"=120 | "Esse app mudou minha vida"=380 | "90% das pessoas perdem dinheiro apostando. Você é uma delas?"=710 | "Fiz R$4.800 em 3 dias, aqui está o que eu fiz"=870

Retorne APENAS JSON válido. Zero texto fora do JSON.`;

    const userPrompt = `Analise este anúncio concorrente:

CONTEÚDO:
${extractedContent}

${extractionNote ? `NOTA: ${extractionNote}` : ''}\n${observation ? `FOCO DO USUÁRIO: ${observation}` : ''}
${persona_context ? `CONTEXTO DA CONTA: ${persona_context}` : ''}

Retorne este JSON exato (todos os valores em ${langName}, prosa densa, sem bullet points nos campos de texto):
{
  "industry": "<setor + nicho específico detectado do conteúdo>",
  "market": "<mercado detectado>",
  "hook_score": <inteiro 0-1000>,
  "hook_score_label": "<rótulo do score>",

  "diagnosis": "<2-3 frases densas: o que esse anúncio está fazendo exatamente. Estrutura, mecanismo, oferta, público. Seja específico — como se estivesse explicando para alguém que vai replicar esse anúncio agora.>",

  "why_it_works_or_fails": "<2-3 frases: por que funciona ou falha. Cite o elemento psicológico específico que ativa ou quebra. Se for fraco, explique o que está faltando e por que o público não converte.>",

  "your_move": "<2-3 frases: como responder a esse anúncio. Ângulo específico, gatilho emocional diferente, formato sugerido. Não seja vago — diga exatamente o que fazer.>",

  "steal_this": "<1-2 frases: o único elemento mais forte desse anúncio e como adaptar para a sua conta. Específico.>",

  "hooks": [
    "<hook pronto para usar — copiar e colar, mesmo idioma do anúncio, 1 ângulo diferente do concorrente>",
    "<hook com gatilho emocional diferente>",
    "<hook de interrupção de padrão — surpreende no scroll>"
  ],

  "mismatch_detected": false,
  "mismatch_reason": ""
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: '{' }, // prefill forces JSON start, prevents English preamble
        ],
      }),
    });

    if (!res.ok) { const t = await res.text(); throw new Error(`Anthropic ${res.status}: ${t.slice(0,200)}`); }
    const data = await res.json();
    const rawText = data.content?.[0]?.type === 'text' ? data.content[0].text : '{}';
    // Prepend '{' because we prefilled the assistant response with it
    const raw = '{' + rawText;
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return new Response(JSON.stringify({ ...parsed, mock_mode: false }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('decode-competitor error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// redeploy 202603261200
