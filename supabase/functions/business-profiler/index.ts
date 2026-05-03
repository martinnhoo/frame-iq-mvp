// business-profiler v2
// Pesquisa o negócio real antes de falar sobre ele
// Fontes: site da empresa + DuckDuckGo (sem key) + Brave (se disponível)
// Salva business_profile permanente: indústria, compliance, tom, diferenciadores
// Acionado: automaticamente quando persona é criada + sob demanda no chat
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import { checkCostCap, recordCost, capExceededResponse } from "../_shared/cost-cap.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');
  const BRAVE_KEY = Deno.env.get('BRAVE_SEARCH_API_KEY'); // optional

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id, product_name, website, market, niche, force_refresh } = body;

    if (!user_id) return new Response(
      JSON.stringify({ error: 'user_id required' }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    );

    // Auth: allow cron (service role) or authenticated user
    const authed = isCronAuthorized(req) || await isUserAuthorized(req, sb, user_id);
    if (!authed) return unauthorizedResponse(cors);

    // ── Load persona context if provided ────────────────────────────────────
    let personaResult: any = {};
    let personaName = product_name || '';

    if (persona_id) {
      const { data: p } = await sb.from('personas' as any)
        .select('name, headline, result').eq('id', persona_id).maybeSingle();
      if (p) {
        personaName = product_name || p.name || '';
        personaResult = (typeof p.result === 'string' ? JSON.parse(p.result) : p.result) || {};
      }
    }

    const businessMarket = market || personaResult?.preferred_market || 'BR';
    const businessWebsite = website || '';
    const businessNiche = niche || personaResult?.bio?.slice(0, 80) || '';

    // ── Check cache (valid 7 days, force_refresh bypasses) ──────────────────
    const patternKey = `business_profile_${persona_id || 'default'}`;
    const { data: existing } = await sb.from('learned_patterns' as any)
      .select('id, insight_text, variables, last_updated')
      .eq('user_id', user_id).eq('pattern_key', patternKey).maybeSingle();

    if (existing && !force_refresh) {
      const age = Date.now() - new Date(existing.last_updated).getTime();
      if (age < 7 * 86400000) {
        return new Response(JSON.stringify({
          ok: true, cached: true,
          profile: existing.variables,
          summary: existing.insight_text,
        }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
    }

    if (!personaName && !businessWebsite && !businessNiche) {
      return new Response(
        JSON.stringify({ error: 'need product_name, website, or niche to research' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // ── Collect research from multiple sources ───────────────────────────────
    const researchChunks: string[] = [];

    // 1. Fetch website directly — always the best source
    if (businessWebsite) {
      try {
        const siteUrl = businessWebsite.startsWith('http') ? businessWebsite : `https://${businessWebsite}`;
        const r = await fetch(siteUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BusinessResearch/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const html = await r.text();
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ').trim().slice(0, 4000);
          if (text.length > 100) researchChunks.push(`WEBSITE (${siteUrl}):\n${text}`);
        }
      } catch(e) { /* non-fatal */ }
    }

    // 2. Search: business info + compliance + market position
    const queries = [
      personaName ? `"${personaName}" ${businessMarket} empresa sobre` : `${businessNiche} ${businessMarket}`,
      personaName ? `"${personaName}" licença regulamentação compliance ${businessMarket}` : `${businessNiche} regulamentação ${businessMarket}`,
      personaName ? `"${personaName}" concorrentes mercado` : `${businessNiche} concorrentes`,
    ];

    for (const q of queries) {
      try {
        let snippet = '';

        if (BRAVE_KEY) {
          // Brave Search — best results
          const r = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`,
            { headers: { 'Accept': 'application/json', 'X-Subscription-Token': BRAVE_KEY }, signal: AbortSignal.timeout(8000) }
          );
          if (r.ok) {
            const d = await r.json();
            snippet = (d.web?.results || []).slice(0, 4)
              .map((x: any) => `${x.title}: ${x.description || ''}`)
              .join('\n');
          }
        } else {
          // DuckDuckGo — no key needed
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

        if (snippet.length > 50) researchChunks.push(`BUSCA: "${q}"\n${snippet}`);
      } catch(e) { /* non-fatal */ }
    }

    // Fallback: use persona info as context even without external research
    if (personaResult && Object.keys(personaResult).length > 0) {
      researchChunks.push(`PERSONA DATA:\nPains: ${(personaResult.pains || []).join(' | ')}\nDesires: ${(personaResult.desires || []).join(' | ')}\nBio: ${personaResult.bio || ''}`);
    }

    // Even with no external data, build a profile from what the user told us
    // Small businesses often have no web presence — that's fine
    if (!researchChunks.length) {
      researchChunks.push(`DADOS DO ONBOARDING:
Negócio: ${personaName}
Mercado: ${businessMarket}
Nicho/Produto: ${businessNiche}
Nota: sem presença digital encontrada — perfil baseado apenas nas informações fornecidas`);
    }

    // ── AI synthesizes into structured profile ───────────────────────────────
    if (!ANTHROPIC) throw new Error('ANTHROPIC_API_KEY not set');

    // Cost cap antes do Claude — protege contra signup spam attacks (script
    // que cria N contas e dispara N pesquisas Brave + N calls Claude). Pega
    // plano do user pra cap correto. Free=$0.10/dia, Maker=$0.75, etc.
    const { data: planRow } = await sb.from('profiles')
      .select('plan').eq('id', user_id).maybeSingle();
    const plan = (planRow as any)?.plan || 'free';
    const cap = await checkCostCap(sb, user_id, plan);
    if (!cap.allowed) {
      return capExceededResponse(cap, cors);
    }

    const contextText = researchChunks.join('\n\n---\n\n').slice(0, 7000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        // System prompt cacheado (mesmo em todas chamadas) — 90% off em
        // hits subsequentes dentro do TTL de 5min.
        system: [{
          type: 'text',
          text: `Você é um especialista em análise de negócios e compliance de marketing digital no Brasil e LATAM.
Analise as informações e construa um perfil honesto. Se incerto, diga explicitamente.
Responda APENAS JSON válido, sem markdown.`,
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{
          role: 'user',
          content: `Empresa: ${personaName || 'desconhecida'}
Website: ${businessWebsite || 'não informado'}
Mercado: ${businessMarket}
Nicho: ${businessNiche}

PESQUISA:
${contextText}

Construa o business_profile:
{
  "business_name": "nome real",
  "industry": "setor específico (ex: apostas esportivas licenciadas BR, envelopamento automotivo SP, clínica médica)",
  "business_model": "como ganha dinheiro: venda única / recorrência / lead / marketplace",
  "is_regulated": true/false,
  "regulatory_body": "órgão regulador real (SPA/MF, ANVISA, BACEN, CONAR, CFM) ou null",
  "license_status": "licensed / unlicensed / unknown / not_applicable",
  "compliance_rules": [
    "regra específica e concreta que DEVE ser seguida no marketing",
    "outra regra com exemplo do que é proibido"
  ],
  "forbidden_phrases": ["frases proibidas ou perigosas para esta empresa específica"],
  "required_disclaimers": ["disclaimers obrigatórios ou fortemente recomendados"],
  "brand_tone": "como a marca se comunica: formal/informal, humor/seriedade, aspiracional/técnico",
  "target_audience": "público real baseado na pesquisa",
  "main_differentiators": ["diferenciais reais identificados"],
  "competitors_mentioned": ["concorrentes que aparecem na pesquisa"],
  "marketing_angles": ["ângulos de marketing que funcionam para este negócio — específicos"],
  "sensitive_topics": ["tópicos que a IA deve tratar com cuidado para esta empresa"],
  "what_to_never_say": ["o que NUNCA dizer sobre ou para esta empresa"],
  "confidence": "high / medium / low",
  "research_notes": "o que foi encontrado e limitações — seja honesto. Se dados são escassos, diga isso."
}

IMPORTANTE: Dados escassos ou empresa sem web presence = ainda assim retorne perfil completo com confidence "low".
Nunca retorne erro. Empresa pequena sem site: infira indústria, público e compliance pelo nome e nicho.`
        }],
      }),
    });

    const aiData = await res.json();

    // Record cost — pra que o checkCostCap em chamadas subsequentes saiba
    // quanto já gastou hoje. Sem isso o cap nunca dispara mesmo se o user
    // bater 100 calls.
    try {
      const u = aiData?.usage || {};
      const inTok = Number(u.input_tokens || 0);
      const outTok = Number(u.output_tokens || 0);
      if (inTok || outTok) {
        recordCost(sb, user_id, aiData?.model || 'claude-haiku-4-5-20251001', inTok, outTok).catch(() => {});
      }
    } catch (_) { /* non-fatal */ }

    const aiText = (aiData.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    let profile: any;
    try { profile = JSON.parse(aiText); }
    catch { return new Response(JSON.stringify({ error: 'profile parse failed', raw: aiText.slice(0, 300) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }); }

    // ── Save as permanent learned_pattern ────────────────────────────────────
    const summary = [
      `${profile.business_name} | ${profile.industry}`,
      profile.license_status !== 'not_applicable' ? `Licença: ${profile.license_status}` : '',
      profile.compliance_rules?.length ? `${profile.compliance_rules.length} regras de compliance` : '',
      `Confiança: ${profile.confidence}`,
    ].filter(Boolean).join(' | ');

    const patternData = {
      user_id, persona_id: persona_id || null,
      pattern_key: patternKey,
      insight_text: summary,
      hook_type: 'business_profile',
      confidence: profile.confidence === 'high' ? 0.9 : profile.confidence === 'medium' ? 0.7 : 0.5,
      is_winner: null, sample_size: 1,
      variables: { ...profile, fetched_at: new Date().toISOString(), website: businessWebsite, market: businessMarket },
      last_updated: new Date().toISOString(),
    };

    if (existing) {
      await sb.from('learned_patterns' as any).update(patternData).eq('id', existing.id);
    } else {
      await sb.from('learned_patterns' as any).insert(patternData);
    }

    // Update ai_profile with business context for immediate use in chat
    await sb.from('user_ai_profile' as any).upsert({
      user_id,
      industry: profile.industry,
      pain_point: [
        `Indústria: ${profile.industry}`,
        profile.license_status !== 'not_applicable' ? `Licença: ${profile.license_status} (${profile.regulatory_body || '—'})` : '',
        profile.compliance_rules?.length ? `Compliance: ${profile.compliance_rules.slice(0, 2).join(' | ')}` : '',
        `Tom: ${profile.brand_tone}`,
        profile.what_to_never_say?.length ? `Nunca dizer: ${profile.what_to_never_say.slice(0, 2).join(' | ')}` : '',
      ].filter(Boolean).join('|||'),
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({ ok: true, cached: false, profile, summary }),
      { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch(e) {
    console.error('business-profiler:', e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// v2
