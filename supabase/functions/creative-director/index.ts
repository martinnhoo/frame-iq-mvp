// creative-director — Agent orquestrador semanal
// Liga daily-intelligence + generate-hooks + capture-learning em sequência
// com decisão de IA no meio: o que testar, pausar, escalar esta semana
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id } = body;

    const authed = isCronAuthorized(req) || await isUserAuthorized(req, sb, user_id || undefined);
    if (!authed) return unauthorizedResponse(cors);

    const targets: { user_id: string; persona_id: string | null }[] = [];
    if (user_id) {
      targets.push({ user_id, persona_id: persona_id || null });
    } else {
      const { data: conns } = await sb.from('platform_connections' as any).select('user_id, persona_id').eq('status', 'active');
      (conns || []).forEach((c: any) => targets.push({ user_id: c.user_id, persona_id: c.persona_id }));
    }

    const results = [];
    for (const target of targets.slice(0, 20)) {
      try {
        const r = await runCreativeDirector(sb, ANTHROPIC, target.user_id, target.persona_id);
        results.push({ ...target, ...r });
      } catch(e) { results.push({ ...target, error: String(e) }); }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

async function runCreativeDirector(sb: any, anthropicKey: string | undefined, user_id: string, persona_id: string | null) {
  // STEP 1: Gather full account state in parallel
  const [snapshotRes, patternsRes, profileRes] = await Promise.allSettled([
    sb.from('daily_snapshots' as any)
      .select('date, total_spend, avg_ctr, active_ads, winners_count, losers_count, top_ads, ai_insight')
      .eq('user_id', user_id).eq('persona_id', persona_id || null)
      .order('date', { ascending: false }).limit(7),
    sb.from('learned_patterns' as any)
      .select('pattern_key, insight_text, avg_ctr, avg_roas, confidence, is_winner, hook_type, sample_size')
      .eq('user_id', user_id).order('confidence', { ascending: false }).limit(30),
    sb.from('user_ai_profile' as any)
      .select('ai_summary, industry, pain_point').eq('user_id', user_id).maybeSingle(),
  ]);

  const snapshots = snapshotRes.status === 'fulfilled' ? snapshotRes.value.data || [] : [];
  const patterns = patternsRes.status === 'fulfilled' ? patternsRes.value.data || [] : [];
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;

  if (!snapshots.length && !patterns.length) return { skipped: 'insufficient data' };

  const latest = snapshots[0];
  const topAds = latest ? (latest.top_ads as any[] || []) : [];
  const winners = patterns.filter((p: any) => p.is_winner && p.confidence > 0.4);
  const losers = patterns.filter((p: any) => !p.is_winner && p.confidence > 0.4);

  const brief = {
    account: latest?.account_name || 'conta',
    ctr_atual: latest ? ((latest.avg_ctr || 0) * 100).toFixed(3) + '%' : 'N/A',
    spend_semana: 'R$' + (latest?.total_spend?.toFixed(0) || '0'),
    ads_ativos: latest?.active_ads || 0,
    tendencia_ctr: snapshots.slice(0, 5).map((s: any) => `${s.date}: ${((s.avg_ctr||0)*100).toFixed(2)}%`).join(' | '),
    escalando: topAds.filter((a: any) => a.isScalable).slice(0, 4).map((a: any) => `"${a.name?.slice(0,40)}" CTR ${(a.ctr*100).toFixed(2)}%`),
    morrendo: topAds.filter((a: any) => a.needsPause || a.isFatigued).slice(0, 4).map((a: any) => `"${a.name?.slice(0,40)}" CTR ${(a.ctr*100).toFixed(2)}% (${a.isFatigued ? 'fadiga' : 'sem retorno'})`),
    angulos_provados: winners.slice(0, 6).map((p: any) => `✓ ${p.insight_text?.slice(0,70)} CTR ${p.avg_ctr ? (p.avg_ctr*100).toFixed(2)+'%' : '?'}`),
    angulos_fracassados: losers.slice(0, 4).map((p: any) => `✗ ${p.insight_text?.slice(0,60)}`),
    perfil: profile?.ai_summary?.slice(0, 150) || '',
  };

  // STEP 2: AI Director decides
  let decisions: any = null;
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        system: 'Você é diretor criativo sênior de mídia paga. Analise a conta e decida o que fazer esta semana. Responda APENAS JSON válido, sem markdown.',
        messages: [{
          role: 'user',
          content: `Conta:\n${JSON.stringify(brief, null, 2)}\n\nDecida:\n{\n  "resumo": "2 frases: situação real e tendência",\n  "pausar": [{"ad": "nome", "motivo": "dado específico"}],\n  "escalar": [{"ad": "nome", "acao": "ex: +30% budget", "motivo": "dado"}],\n  "criar_esta_semana": [{"hook": "texto exato", "angulo": "tipo", "por_que": "baseado em qual padrão"}],\n  "proximo_teste": "a UMA coisa mais importante a testar",\n  "alerta": "algo urgente ou null"\n}`,
        }],
      }),
    });
    const data = await res.json();
    const text = (data.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    try { decisions = JSON.parse(text); } catch { decisions = { resumo: text.slice(0, 150) }; }
  }

  // STEP 3: Persist decisions as alerts + new patterns to test
  if (decisions) {
    // Alert with weekly directive
    await sb.from('account_alerts' as any).insert({
      user_id, persona_id: persona_id || null,
      type: 'system', urgency: decisions.alerta ? 'high' : 'low',
      detail: `[Diretor Criativo Semanal] ${decisions.resumo || ''} | Teste: ${decisions.proximo_teste || ''}`,
      created_at: new Date().toISOString(),
    }).catch(() => {});

    // New hooks proposed by director become patterns with confidence 0.5 (unvalidated)
    if (decisions.criar_esta_semana?.length) {
      for (const h of decisions.criar_esta_semana.slice(0, 5)) {
        await sb.from('learned_patterns' as any).insert({
          user_id, persona_id: persona_id || null,
          pattern_key: `director_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          insight_text: h.hook?.slice(0, 200),
          hook_type: h.angulo || 'director_proposed',
          confidence: 0.5, is_winner: null, sample_size: 0,
          variables: { source: 'creative_director', por_que: h.por_que, proposed_at: new Date().toISOString() },
          last_updated: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    // Update ai_profile summary
    await sb.from('user_ai_profile' as any).upsert({
      user_id, ai_summary: decisions.resumo || '',
      ai_recommendations: { weekly_directive: decisions, generated_at: new Date().toISOString() },
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' }).catch(() => {});
  }

  return {
    ok: true, account: brief.account,
    pausar: decisions?.pausar?.length || 0,
    escalar: decisions?.escalar?.length || 0,
    criar: decisions?.criar_esta_semana?.length || 0,
    proximo_teste: decisions?.proximo_teste,
    resumo: decisions?.resumo,
  };
}
// v1
