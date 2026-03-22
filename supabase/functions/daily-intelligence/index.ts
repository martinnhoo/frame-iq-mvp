// daily-intelligence v2 — inteligência real focada na dor do gestor de tráfego
// Roda: (1) todo dia às 12h via cron, (2) ao abrir o chat se sem snapshot hoje
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY');
    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id } = body;

    // Cron mode: run for all active Meta users
    const targets: { user_id: string; persona_id: string | null }[] = [];
    if (user_id) {
      targets.push({ user_id, persona_id: persona_id || null });
    } else {
      const { data: conns } = await sb.from('platform_connections' as any)
        .select('user_id, persona_id').eq('platform', 'meta').eq('status', 'active');
      // Deduplicate by user_id — only run once per user
      const seen = new Set<string>();
      (conns || []).forEach((c: any) => {
        if (!seen.has(c.user_id)) { seen.add(c.user_id); targets.push({ user_id: c.user_id, persona_id: c.persona_id }); }
      });
    }

    const results = [];
    for (const target of targets) {
      try {
        const r = await analyzeAccount(sb, ANTHROPIC, target.user_id, target.persona_id);
        results.push({ ...target, result: r });
      } catch (e) { results.push({ ...target, error: String(e) }); }
    }

    return new Response(JSON.stringify({ ok: true, processed: targets.length, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

async function analyzeAccount(sb: any, anthropicKey: string | undefined, user_id: string, persona_id: string | null) {
  // ── Get Meta token ───────────────────────────────────────────────────────
  let conn: any = null;
  if (persona_id) {
    const { data } = await sb.from('platform_connections' as any)
      .select('access_token, ad_accounts, selected_account_id')
      .eq('user_id', user_id).eq('platform', 'meta').eq('persona_id', persona_id).maybeSingle();
    conn = data;
  }
  if (!conn) {
    const { data } = await sb.from('platform_connections' as any)
      .select('access_token, ad_accounts, selected_account_id')
      .eq('user_id', user_id).eq('platform', 'meta').is('persona_id', null).maybeSingle();
    conn = data;
  }
  if (!conn?.access_token) return { skipped: 'No Meta connection' };

  const token = conn.access_token;
  const accounts = (conn.ad_accounts as any[]) || [];
  const selectedId = conn.selected_account_id;
  const account = (selectedId && accounts.find((a: any) => a.id === selectedId)) || accounts[0];
  if (!account?.id) return { skipped: 'No active account' };

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const now = new Date();
  const today = fmt(now);
  const d7 = fmt(new Date(now.getTime() - 7 * 86400000));
  const d14 = fmt(new Date(now.getTime() - 14 * 86400000));
  const yesterday = fmt(new Date(now.getTime() - 86400000));

  // ── Pull Meta data: ad-level with time breakdown ─────────────────────────
  const fields = [
    'ad_id', 'ad_name', 'adset_name', 'campaign_name',
    'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'reach', 'frequency',
    'actions', 'cost_per_action_type', 'video_play_actions', 'video_avg_time_watched_actions',
    'date_start', 'date_stop'
  ].join(',');

  const [wk1Res, wk2Res, ydRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d7}","until":"${today}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d14}","until":"${d7}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${yesterday}","until":"${today}"}&sort=spend_descending&limit=20&access_token=${token}`),
  ]);

  const [wk1, wk2, yd] = await Promise.all([wk1Res.json(), wk2Res.json(), ydRes.json()]);
  if (wk1.error) throw new Error(`Meta: ${wk1.error.message}`);

  const curr: any[] = wk1.data || [];
  const prev: any[] = wk2.data || [];
  const yest: any[] = yd.data || [];

  // ── Process and enrich ───────────────────────────────────────────────────
  const prevMap: Record<string, any> = {};
  prev.forEach((a: any) => prevMap[a.ad_name || a.ad_id] = a);

  const parseN = (v: any) => parseFloat(v || '0');
  const getConversions = (ad: any) => {
    const actions = (ad.actions || []) as any[];
    const conv = actions.find((a: any) => ['purchase', 'lead', 'complete_registration', 'app_install'].includes(a.action_type));
    return conv ? parseFloat(conv.value || '0') : 0;
  };
  const getVideoRetention = (ad: any) => {
    const plays = (ad.video_play_actions || []) as any[];
    const avg = (ad.video_avg_time_watched_actions || []) as any[];
    return { plays: plays[0]?.value || 0, avg_watch: avg[0]?.value || 0 };
  };

  const enriched = curr.map((ad: any) => {
    const p = prevMap[ad.ad_name || ad.ad_id];
    const spend = parseN(ad.spend);
    const ctr = parseN(ad.ctr);
    const cpc = parseN(ad.cpc);
    const impressions = parseN(ad.impressions);
    const frequency = parseN(ad.frequency);
    const prevCtr = p ? parseN(p.ctr) : null;
    const prevSpend = p ? parseN(p.spend) : null;
    const conversions = getConversions(ad);
    const video = getVideoRetention(ad);
    const roas = conversions > 0 && spend > 0 ? (conversions * 30) / spend : null; // estimate: avg order R$30

    // Fatigue signals
    const isFatigued = frequency > 3.5 || (prevCtr !== null && prevCtr > 0 && ctr / prevCtr < 0.7);
    const isScalable = ctr > 0.02 && spend > 10 && (!prevCtr || ctr >= prevCtr * 0.9);
    const needsPause = (ctr < 0.005 && spend > 20) || (cpc > 5 && conversions === 0 && spend > 30);
    const deltaCtr = prevCtr !== null ? ((ctr - prevCtr) / Math.max(prevCtr, 0.001) * 100) : null;

    return {
      id: ad.ad_id, name: ad.ad_name || 'Sem nome',
      adset: ad.adset_name, campaign: ad.campaign_name,
      spend, ctr, cpc, cpm: parseN(ad.cpm), impressions, frequency,
      conversions, roas,
      prevCtr, deltaCtr,
      videoPlays: video.plays, avgWatch: video.avg_watch,
      isFatigued, isScalable, needsPause,
      trend: deltaCtr === null ? 'new' : deltaCtr > 5 ? 'up' : deltaCtr < -5 ? 'down' : 'stable',
    };
  });

  enriched.sort((a: any, b: any) => b.spend - a.spend);

  const totalSpend = enriched.reduce((s: number, a: any) => s + a.spend, 0);
  const totalConversions = enriched.reduce((s: number, a: any) => s + a.conversions, 0);
  const avgCtr = totalSpend > 0
    ? enriched.reduce((s: number, a: any) => s + a.ctr * a.spend, 0) / totalSpend
    : 0;
  const ydSpend = yest.reduce((s: number, a: any) => s + parseN(a.spend), 0);
  const ydCtr = yest.length ? yest.reduce((s: number, a: any) => s + parseN(a.ctr), 0) / yest.length : 0;

  const scalable = enriched.filter((a: any) => a.isScalable);
  const fatigued = enriched.filter((a: any) => a.isFatigued);
  const toPause = enriched.filter((a: any) => a.needsPause);
  const newAds = enriched.filter((a: any) => a.trend === 'new');
  const trending = enriched.filter((a: any) => a.trend === 'up');

  // ── Patterns: learn hook types that work ─────────────────────────────────
  for (const ad of scalable.slice(0, 10)) {
    if (ad.ctr < 0.01) continue;
    const key = `meta_ad_${ad.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35)}`;
    const { data: ex } = await sb.from('learned_patterns').select('id, sample_size, avg_ctr, avg_roas, variables')
      .eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
    const vars: any = (ex?.variables as any) || {};
    const history = vars.history || [];
    history.unshift({ date: today, ctr: ad.ctr, spend: ad.spend, conversions: ad.conversions, trend: ad.trend });
    if (ex) {
      const n = ex.sample_size || 0;
      await sb.from('learned_patterns').update({
        sample_size: n + 1,
        avg_ctr: ((ex.avg_ctr || 0) * n + ad.ctr) / (n + 1),
        avg_roas: ad.roas || ex.avg_roas,
        is_winner: ad.ctr > 0.018,
        confidence: Math.min(1, (n + 1) / 14),
        insight_text: `"${ad.name.slice(0, 45)}": CTR ${(ad.ctr*100).toFixed(2)}% (${ad.trend}) | ${ad.spend.toFixed(0)} spend`,
        last_updated: new Date().toISOString(),
        variables: { ...vars, history: history.slice(0, 30), campaign: ad.campaign, adset: ad.adset, frequency: ad.frequency }
      }).eq('id', ex.id);
    } else {
      await sb.from('learned_patterns').insert({
        user_id, pattern_key: key, is_winner: ad.ctr > 0.018, sample_size: 1,
        avg_ctr: ad.ctr, avg_roas: ad.roas || null, confidence: 0.07,
        insight_text: `"${ad.name.slice(0, 45)}": CTR ${(ad.ctr*100).toFixed(2)}% | ${ad.spend.toFixed(0)} spend`,
        variables: { history: history.slice(0, 30), campaign: ad.campaign, adset: ad.adset }
      });
    }
  }

  // ── AI Insight — focused on what to DO today ─────────────────────────────
  let aiInsight = '';
  let aiActions: any[] = [];
  if (anthropicKey && curr.length > 0) {
    try {
      const ctx = {
        account: account.name || account.id,
        period: `${d7} → ${today}`,
        spend_total: totalSpend.toFixed(2),
        spend_yesterday: ydSpend.toFixed(2),
        conversions: totalConversions,
        avg_ctr_pct: (avgCtr * 100).toFixed(2),
        ctr_yesterday_pct: (ydCtr * 100).toFixed(2),
        active_ads: curr.length,
        new_ads_this_week: newAds.length,
        top3: enriched.slice(0, 3).map((a: any) => ({
          name: a.name.slice(0, 40),
          ctr_pct: (a.ctr * 100).toFixed(2),
          spend: a.spend.toFixed(0),
          conversions: a.conversions,
          trend: a.trend,
          frequency: a.frequency.toFixed(1),
        })),
        scale_now: scalable.slice(0, 3).map((a: any) => a.name.slice(0, 40)),
        fatigued: fatigued.slice(0, 3).map((a: any) => ({ name: a.name.slice(0, 40), freq: a.frequency.toFixed(1), ctr_drop: a.deltaCtr?.toFixed(1) })),
        pause_now: toPause.slice(0, 3).map((a: any) => a.name.slice(0, 40)),
      };

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `Você é um analista sênior de performance em mídia paga. Responda SEMPRE em Português Brasileiro.
Analise os dados da conta e retorne JSON com:
{
  "resumo": "<1 frase: situação geral da conta>",
  "insight_principal": "<2 frases: o insight mais importante hoje — específico, não genérico>",
  "acoes": [
    {"tipo": "escalar|pausar|criar|revisar", "anuncio": "<nome>", "motivo": "<1 frase curta>", "urgencia": "alta|media|baixa"},
    ...máximo 4 ações
  ],
  "alerta": "<se houver algo urgente, 1 frase. Senão: null>"
}`,
          messages: [{ role: 'user', content: JSON.stringify(ctx, null, 2) }],
        }),
      });
      const aiData = await aiRes.json();
      const rawText = aiData.content?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      aiInsight = parsed.insight_principal || parsed.resumo || '';
      aiActions = parsed.acoes || [];
      if (parsed.alerta) aiInsight = `⚠️ ${parsed.alerta} — ${aiInsight}`;
    } catch (e) {
      console.error('AI insight error:', e);
    }
  }

  // ── Save snapshot ─────────────────────────────────────────────────────────
  const snapshot = {
    user_id, persona_id: persona_id || null, date: today,
    account_id: account.id, account_name: account.name || account.id,
    total_spend: totalSpend, avg_ctr: avgCtr, total_clicks: enriched.reduce((s: number, a: any) => s + parseInt(a.impressions > 0 ? String(a.ctr * a.impressions / 100) : '0'), 0),
    active_ads: curr.length, winners_count: scalable.length, losers_count: toPause.length,
    yesterday_spend: ydSpend, yesterday_ctr: ydCtr,
    top_ads: enriched.slice(0, 15).map((a: any) => ({
      id: a.id, name: a.name, campaign: a.campaign, spend: a.spend,
      ctr: a.ctr, cpc: a.cpc, conversions: a.conversions, roas: a.roas,
      trend: a.trend, isFatigued: a.isFatigued, isScalable: a.isScalable, needsPause: a.needsPause,
      frequency: a.frequency, deltaCtr: a.deltaCtr
    })),
    ai_insight: aiInsight,
    raw_period: { since: d7, until: today, actions: aiActions, fatigued: fatigued.slice(0, 5).map((a: any) => a.name), scalable: scalable.slice(0, 5).map((a: any) => a.name) },
  };

  await sb.from('daily_snapshots' as any).upsert(snapshot, { onConflict: 'user_id,persona_id,date' });

  // Send daily intelligence email
  try {
    await sb.functions.invoke('send-daily-intelligence-email', { body: { user_id } });
  } catch (e) { console.error('email dispatch error:', e); }

  // ── Rebuild ai_profile ────────────────────────────────────────────────────
  const { data: patterns } = await sb.from('learned_patterns').select('is_winner, avg_ctr, insight_text, confidence')
    .eq('user_id', user_id).order('confidence', { ascending: false }).limit(20);
  const winners = (patterns || []).filter((p: any) => p.is_winner && p.confidence > 0.2);

  const summary = [
    `Conta: ${account.name || account.id}. Semana: R$${totalSpend.toFixed(0)} spend, CTR ${(avgCtr*100).toFixed(2)}%, ${curr.length} ads ativos.`,
    scalable.length ? `Escalar agora: ${scalable.slice(0,2).map((a: any) => a.name.slice(0,30)).join(', ')}.` : '',
    toPause.length ? `Pausar: ${toPause.slice(0,2).map((a: any) => a.name.slice(0,30)).join(', ')}.` : '',
    aiInsight || '',
  ].filter(Boolean).join(' ');

  await sb.from('user_ai_profile' as any).upsert({
    user_id, ai_summary: summary, avg_hook_score: avgCtr * 1000, total_analyses: curr.length,
    ai_recommendations: { actions: aiActions, winners: winners.slice(0,3).map((p: any) => p.insight_text), insight: aiInsight, updated: today },
    last_updated: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return {
    ok: true, account: account.name || account.id,
    spend: totalSpend.toFixed(2), ctr: (avgCtr*100).toFixed(3),
    ads: curr.length, scalable: scalable.length, pause: toPause.length, fatigued: fatigued.length,
    insight: aiInsight.slice(0, 80),
  };
}
// redeploy 202603261700
