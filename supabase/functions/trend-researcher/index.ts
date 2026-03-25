// trend-researcher v2
// Entende o que uma trend/meme REALMENTE é lendo fontes culturais primárias
// Vai direto ao X/Twitter (via Nitter), Reddit, TikTok — não só jornais
// Resultado: brief cultural que a IA usa para entender antes de agir
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Nitter instances — public, no auth needed, mirrors do Twitter
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.cz',
  'https://nitter.net',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');
  const BRAVE_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    const { trend_term, geo = 'BR', force_refresh = false } = body;

    if (!trend_term) return new Response(
      JSON.stringify({ error: 'trend_term required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

    // ── Cache check — trends valid for 6h ────────────────────────────────────
    const cacheKey = `trend_research_${trend_term.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
    const { data: cached } = await sb.from('learned_patterns' as any)
      .select('id, insight_text, variables, last_updated')
      .eq('pattern_key', cacheKey).maybeSingle();

    if (cached && !force_refresh) {
      const ageH = (Date.now() - new Date(cached.last_updated).getTime()) / 3600000;
      if (ageH < 6) return new Response(JSON.stringify({
        ok: true, cached: true, research: cached.variables, summary: cached.insight_text,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Multi-source cultural research ───────────────────────────────────────
    const sources: { type: string; content: string }[] = [];

    // SOURCE 1: Twitter/X via Nitter — tweets reais sobre a trend
    for (const instance of NITTER_INSTANCES) {
      try {
        const searchUrl = `${instance}/search?f=tweets&q=${encodeURIComponent(trend_term)}&lang=pt`;
        const r = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendResearcher/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const html = await r.text();
          // Extract tweet text from Nitter HTML
          const tweetMatches = html.match(/<div class="tweet-content[^"]*">([\s\S]*?)<\/div>/g) || [];
          const tweets = tweetMatches
            .slice(0, 15)
            .map(t => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(t => t.length > 20);

          if (tweets.length > 0) {
            sources.push({ type: 'twitter_tweets', content: `TWEETS REAIS sobre "${trend_term}":\n${tweets.join('\n')}` });
            break; // Got what we need from first working instance
          }
        }
      } catch { /* try next instance */ }
    }

    // SOURCE 2: Reddit — discussões orgânicas em PT e EN
    const redditQueries = [
      `${trend_term} site:reddit.com`,
      `${trend_term} meme brasil reddit`,
    ];
    for (const q of redditQueries.slice(0, 1)) {
      try {
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=8&sort=relevance&t=month`;
        const r = await fetch(redditUrl, {
          headers: { 'User-Agent': 'TrendResearcher/1.0 (research bot)' },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const d = await r.json();
          const posts = (d.data?.children || []).slice(0, 6).map((p: any) => {
            const post = p.data;
            return `r/${post.subreddit}: "${post.title}" — ${post.selftext?.slice(0, 200) || post.url}`;
          });
          if (posts.length) sources.push({ type: 'reddit', content: `REDDIT posts:\n${posts.join('\n')}` });
        }
      } catch { /* non-fatal */ }
    }

    // SOURCE 3: Web search — mix de notícias + threads + contexto cultural
    // Prioriza fontes culturais (não só jornais genéricos)
    const searchQueries = [
      `"${trend_term}" origem quem criou meme brasil`,
      `"${trend_term}" twitter comentários meme template`,
      `"${trend_term}" marcas usaram como usar`,
    ];

    for (const q of searchQueries) {
      try {
        let snippet = '';
        if (BRAVE_KEY) {
          const r = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=6&country=${geo}`,
            { headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_KEY }, signal: AbortSignal.timeout(8000) }
          );
          if (r.ok) {
            const d = await r.json();
            snippet = (d.web?.results || []).slice(0, 5)
              .map((x: any) => `${x.title}: ${x.description || ''}`)
              .join('\n');

            // Also fetch the most cultural-looking result (Twitter, Reddit, Know Your Meme, etc.)
            const culturalResult = (d.web?.results || []).find((x: any) =>
              x.url?.match(/twitter|x\.com|reddit|knowyourmeme|memedroid|9gag/i)
            );
            if (culturalResult?.url) {
              try {
                const pr = await fetch(culturalResult.url, {
                  headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000)
                });
                if (pr.ok) {
                  const html = await pr.text();
                  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
                  if (text.length > 100) snippet += `\n\nPÁGINA CULTURAL (${culturalResult.url}):\n${text}`;
                }
              } catch { /* non-fatal */ }
            }
          }
        } else {
          // DuckDuckGo fallback
          const r = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (r.ok) {
            const d = await r.json();
            snippet = [d.Abstract, d.Answer, ...(d.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text || '')]
              .filter(Boolean).join('\n');
          }
        }
        if (snippet.length > 80) sources.push({ type: 'web_search', content: `BUSCA "${q}":\n${snippet}` });
      } catch { /* non-fatal */ }
    }

    if (!sources.length) {
      return new Response(JSON.stringify({
        ok: false, error: 'no sources found for this trend',
        hint: 'add BRAVE_SEARCH_API_KEY for significantly better results'
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── AI synthesizes into cultural brief ───────────────────────────────────
    if (!ANTHROPIC) throw new Error('ANTHROPIC_API_KEY not set');

    const sourcesText = sources.map(s => `[${s.type.toUpperCase()}]\n${s.content}`).join('\n\n---\n\n').slice(0, 9000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: `Você é um especialista em cultura digital brasileira, memes e comportamento de redes sociais.
REGRA CRÍTICA: Baseie-se EXCLUSIVAMENTE nas fontes fornecidas. Não invente contexto.
Se os tweets mostram que é sobre X → é sobre X, mesmo que pareça óbvio diferente.
Se há comentários reais → eles revelam como o público REALMENTE usa o meme.
Seja honesto sobre o que não tem nas fontes.
Responda APENAS JSON válido.`,
        messages: [{
          role: 'user',
          content: `Analise a trend/meme: "${trend_term}" (${geo})

FONTES PRIMÁRIAS (tweets reais, threads, comentários):
${sourcesText}

Construa o cultural_brief baseado APENAS no que as fontes mostram:
{
  "term": "${trend_term}",
  "real_origin": "quem criou, onde, quando, qual contexto EXATO — baseado nas fontes",
  "core_mechanic": "a lógica interna do meme — o que o torna engraçado/viral — seja preciso",
  "template_structure": "a estrutura exata que as pessoas replicam (ex: 'não é X, é sabor X' — pausa dramática + aspas)",
  "what_people_are_doing_with_it": "como o público real está usando — baseado nos tweets/posts coletados",
  "tone": "irônico / absurdo / crítico / celebratório — e a razão específica desse tom",
  "target_audience": "quem entende naturalmente — dados do público dos tweets/posts",
  "lifespan_status": "nascendo / subindo / pico / caindo / morto — com justificativa das fontes",
  "brand_examples": [{"brand": "nome", "how": "como usou", "worked": true/false, "why": "por quê"}],
  "wrong_applications": ["aplicação que pareceria óbvia mas estaria errada — com explicação baseada na lógica do meme"],
  "industry_fit": {
    "automotive_wrapping": "fit real com ângulo específico OU por que NÃO se aplica — baseado na lógica do meme",
    "food_beverage": "idem",
    "health_medical": "idem",
    "igaming_betting": "idem",
    "fashion": "idem",
    "fitness": "idem",
    "tech_saas": "idem"
  },
  "usage_window": "janela de tempo estimada — quantos dias ainda tem relevância",
  "keywords_to_monitor": ["termos relacionados subindo junto"],
  "confidence": "high / medium / low — baseado na qualidade das fontes",
  "sources_quality": "avaliação das fontes coletadas — o que foi encontrado de útil",
  "warning": "algo crítico que marca deve saber antes de usar — ou null"
}`
        }],
      }),
    });

    const aiData = await res.json();
    const aiText = (aiData.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    let research: any;
    try { research = JSON.parse(aiText); }
    catch { return new Response(JSON.stringify({ error: 'parse failed', raw: aiText.slice(0, 300) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }

    // ── Save globally so all accounts benefit ────────────────────────────────
    const summary = `TREND "${trend_term}": ${research.core_mechanic?.slice(0, 80)} | Status: ${research.lifespan_status} | Tom: ${research.tone}`;

    const { data: anyUser } = await sb.from('profiles' as any).select('id').limit(1).maybeSingle();

    const patternData = {
      user_id: anyUser?.id || null,
      persona_id: null,
      pattern_key: cacheKey,
      insight_text: summary,
      hook_type: 'trend_research',
      confidence: research.confidence === 'high' ? 0.85 : research.confidence === 'medium' ? 0.65 : 0.45,
      is_winner: null, sample_size: 1,
      variables: { ...research, sources_count: sources.length, sources_types: sources.map(s => s.type), fetched_at: new Date().toISOString(), geo },
      last_updated: new Date().toISOString(),
    };

    if (cached) {
      await sb.from('learned_patterns' as any).update(patternData).eq('id', cached.id);
    } else if (anyUser) {
      await sb.from('learned_patterns' as any).insert(patternData).catch(() => {});
    }

    return new Response(JSON.stringify({
      ok: true, cached: false, research, summary,
      sources_used: sources.length, sources_types: sources.map(s => s.type),
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch(e) {
    console.error('trend-researcher:', e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// v2
