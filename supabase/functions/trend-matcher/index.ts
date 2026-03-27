// trend-matcher v1
// Pega um trend já pesquisado e score contra TODAS as contas ativas
// Usa Haiku ($0.001/chamada) para scoring — muito barato
// Quando score >= 7 E ângulo específico: dispara content-brief + Telegram alert
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    // Can receive a trend_term (to fetch research) OR pre-fetched research
    const { trend_term, trend_research, user_id, persona_id } = body;

    // ── Get trend research ────────────────────────────────────────────────────
    let research = trend_research;
    if (!research && trend_term) {
      const cacheKey = `trend_research_${trend_term.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
      const { data: cached } = await sb.from('learned_patterns' as any)
        .select('variables').eq('pattern_key', cacheKey).maybeSingle();
      if (cached) research = cached.variables;
    }

    if (!research) {
      return new Response(JSON.stringify({ error: 'trend_research required — run trend-researcher first' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Get all active accounts to score ─────────────────────────────────────
    let personasQuery = sb.from('personas' as any).select('id, user_id, name, headline, result');
    if (user_id) personasQuery = personasQuery.eq('user_id', user_id);
    if (persona_id) personasQuery = personasQuery.eq('id', persona_id);

    const { data: personas } = await personasQuery.limit(50);
    if (!personas?.length) return new Response(
      JSON.stringify({ ok: true, matches: [], reason: 'no personas found' }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );

    // ── Score each account with Haiku ─────────────────────────────────────────
    const matches = [];
    const term = research.term || trend_term || 'trend';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    for (const persona of personas) {
      if (!ANTHROPIC) break;

      // ── Dedup: skip if this trend×persona was already scored today ────────
      // Prevents re-scoring 48x/day — a score is valid for 24h
      const dedupKey = `trend_scored_${term.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}_${persona.id.slice(0, 8)}`;
      const { data: existing } = await sb.from('learned_patterns' as any)
        .select('last_updated').eq('pattern_key', dedupKey).maybeSingle();
      if (existing?.last_updated && existing.last_updated.slice(0, 10) === today) {
        continue; // already scored today — skip Anthropic call
      }

      const personaResult = typeof persona.result === 'string'
        ? JSON.parse(persona.result || '{}')
        : (persona.result || {});

      // Get business_profile for this persona if exists
      const { data: bizProfile } = await sb.from('learned_patterns' as any)
        .select('variables').eq('user_id', persona.user_id)
        .eq('pattern_key', `business_profile_${persona.id}`)
        .maybeSingle();

      const bizCtx = bizProfile?.variables as any;

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: `TREND: "${term}"
Mecânica do meme: ${research.core_mechanic || '—'}
Template: ${research.template_structure || '—'}
Tom: ${research.tone || '—'}
Status: ${research.lifespan_status || '—'}
Usos errados conhecidos: ${(research.wrong_applications || []).slice(0, 2).join(' | ')}

CONTA: ${persona.name} | ${persona.headline || ''}
Indústria: ${bizCtx?.industry || personaResult?.bio?.slice(0, 60) || '—'}
Tom da marca: ${bizCtx?.brand_tone || '—'}
Público: ${(personaResult?.pains || []).slice(0, 2).join(' | ')}
O que não pode dizer: ${(bizCtx?.what_to_never_say || []).slice(0, 2).join(' | ')}

Score de fit 0-10:
- 0-3: forçado, vexatório, não conecta com a marca
- 4-6: possível mas muito esforço, resultado medíocre
- 7-8: fit real com ângulo específico e claro
- 9-10: feito um para o outro, usar imediatamente

CRÍTICO: Analise a LÓGICA do meme. Não conecte superficialmente (cor, nome). 
Conecte pela ESTRUTURA (workaround, circular logic, aspas, pausa dramática).

Responda JSON:
{"score": 7, "angle": "ângulo específico baseado na lógica do meme — não genérico", "hook": "texto exato pronto para usar", "why": "por que esse ângulo funciona — cite a estrutura do meme", "urgency": "high/medium/low"}`
            }],
          }),
        });

        if (res.ok) {
          const d = await res.json();
          const text = (d.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
          const scored = JSON.parse(text);

          if (scored.score >= 7 && scored.angle && scored.hook) {
            matches.push({
              persona_id: persona.id,
              user_id: persona.user_id,
              persona_name: persona.name,
              score: scored.score,
              angle: scored.angle,
              hook: scored.hook,
              why: scored.why,
              urgency: scored.urgency || 'medium',
            });
          }
        }
      } catch(e) { console.error(`Score error for ${persona.name}:`, e); }

      // Save dedup marker — regardless of score, mark as scored today
      await sb.from('learned_patterns' as any).upsert({
        user_id: persona.user_id,
        persona_id: persona.id,
        pattern_key: dedupKey,
        insight_text: `Trend "${term.slice(0, 40)}" scored for ${persona.name} on ${today}`,
        confidence: 0,
        sample_size: 0,
        is_winner: null,
        variables: { trend: term, scored_date: today },
        last_updated: new Date().toISOString(),
      }, { onConflict: 'pattern_key' }).catch(() => {});

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    // ── For each match: create account_alert + Telegram notification ──────────
    for (const match of matches) {
      // Save as account alert (shows up in chat next time user opens)
      const alertDetail = [
        `[Trend Alert] "${term}" tem fit ${match.score}/10 para esta conta.`,
        `Ângulo: ${match.angle}`,
        `Hook sugerido: "${match.hook}"`,
        `Por quê funciona: ${match.why}`,
        `Janela: ${research.usage_window || 'verificar'}`,
      ].join('\n');

      await sb.from('account_alerts' as any).insert({
        user_id: match.user_id,
        persona_id: match.persona_id,
        type: 'opportunity',
        urgency: match.urgency,
        detail: alertDetail.slice(0, 500),
        ad_name: `Trend: ${term.slice(0, 40)}`,
        campaign_name: null,
      created_at: new Date().toISOString(),
      } as any);

      // Also save proposed hook as learned_pattern for generate-hooks to use
      await sb.from('learned_patterns' as any).insert({
        user_id: match.user_id,
        persona_id: match.persona_id,
        pattern_key: `trend_hook_${term.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}_${Date.now()}`,
        insight_text: match.hook.slice(0, 200),
        hook_type: 'trend_opportunity',
        confidence: match.score / 10,
        is_winner: null, sample_size: 0,
        variables: {
          trend: term, angle: match.angle, why: match.why,
          trend_mechanic: research.core_mechanic,
          proposed_at: new Date().toISOString(),
          source: 'trend_matcher',
        },
        last_updated: new Date().toISOString(),
      } as any);

      // Send Telegram alert if connected
      try {
        const { data: tgConn } = await sb.from('telegram_connections' as any)
          .select('chat_id').eq('user_id', match.user_id).eq('active', true).maybeSingle();

        if (tgConn?.chat_id) {
          const msg = [
            `🎯 *Oportunidade de Trend*`,
            ``,
            `*Trend:* ${term}`,
            `*Conta:* ${match.persona_name}`,
            `*Fit:* ${match.score}/10`,
            ``,
            `*Ângulo:* ${match.angle}`,
            ``,
            `*Hook pronto:*`,
            `_"${match.hook}"_`,
            ``,
            `*Por quê funciona:* ${match.why}`,
            ``,
            `⏱ Janela: ${research.usage_window || 'verificar urgência'}`,
            ``,
            `👉 Abra o AdBrief para criar o brief completo`,
          ].join('\n');

          await sb.functions.invoke('send-telegram', {
            body: { chat_id: tgConn.chat_id, message: msg, parse_mode: 'Markdown' }
          });
        }
      } catch { /* non-fatal */ }
    }

    return new Response(JSON.stringify({
      ok: true,
      trend: term,
      personas_evaluated: personas.length,
      matches_found: matches.length,
      matches: matches.map(m => ({
        persona: m.persona_name,
        score: m.score,
        angle: m.angle,
        hook: m.hook,
      })),
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch(e) {
    console.error('trend-matcher:', e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
// v1
