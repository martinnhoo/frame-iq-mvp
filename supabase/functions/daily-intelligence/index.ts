// daily-intelligence v1 — cron diário que aprende com Meta Ads e atualiza a inteligência da conta
// Chamado via Supabase cron às 12h UTC todos os dias
// Também pode ser chamado manualmente via POST { user_id, persona_id? }

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id } = body;

    // If no user_id → run for ALL users with active Meta connections (cron mode)
    const targets: { user_id: string; persona_id: string | null }[] = [];

    if (user_id) {
      targets.push({ user_id, persona_id: persona_id || null });
    } else {
      // Cron mode: find all active Meta connections
      const { data: conns } = await sb
        .from('platform_connections' as any)
        .select('user_id, persona_id')
        .eq('platform', 'meta')
        .eq('status', 'active');
      (conns || []).forEach((c: any) => targets.push({ user_id: c.user_id, persona_id: c.persona_id }));
    }

    const results: any[] = [];
    for (const target of targets) {
      try {
        const result = await runForUser(sb, ANTHROPIC_KEY, target.user_id, target.persona_id);
        results.push({ ...target, result });
      } catch (e) {
        results.push({ ...target, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: targets.length, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('daily-intelligence error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});

async function runForUser(sb: any, anthropicKey: string | undefined, user_id: string, persona_id: string | null) {
  console.log(`Running daily intelligence for user ${user_id}, persona ${persona_id}`);

  // ── 1. Get Meta connection ────────────────────────────────────────────────
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
  const activeAccount = (selectedId && accounts.find((a: any) => a.id === selectedId)) || accounts[0];
  if (!activeAccount?.id) return { skipped: 'No active ad account' };

  const accountId = activeAccount.id;

  // ── 2. Pull insights — today's window vs yesterday's window ──────────────
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  // Current period: last 7 days
  const since7 = fmt(new Date(today.getTime() - 7 * 86400000));
  const until7 = fmt(today);

  // Previous period: 7-14 days ago
  const since14 = fmt(new Date(today.getTime() - 14 * 86400000));
  const until14 = fmt(new Date(today.getTime() - 7 * 86400000));

  // Yesterday specifically
  const yesterday = fmt(new Date(today.getTime() - 86400000));

  const fields = 'ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type';

  const [currentRes, prevRes, yesterdayRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${fields}&time_range={"since":"${since7}","until":"${until7}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${fields}&time_range={"since":"${since14}","until":"${until14}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${fields}&time_range={"since":"${yesterday}","until":"${until7}"}&sort=spend_descending&limit=20&access_token=${token}`),
  ]);

  const [currentData, prevData, yesterdayData] = await Promise.all([
    currentRes.json(), prevRes.json(), yesterdayRes.json()
  ]);

  if (currentData.error) throw new Error(`Meta API: ${currentData.error.message}`);

  const current: any[] = currentData.data || [];
  const previous: any[] = prevData.data || [];
  const yesterdayAds: any[] = yesterdayData.data || [];

  // ── 3. Compute deltas and identify winners/losers ────────────────────────
  const prevMap: Record<string, any> = {};
  previous.forEach((ad: any) => { prevMap[ad.ad_name] = ad; });

  const enriched = current.map((ad: any) => {
    const prev = prevMap[ad.name] || prevMap[ad.ad_name];
    const ctr = parseFloat(ad.ctr || '0');
    const spend = parseFloat(ad.spend || '0');
    const clicks = parseInt(ad.clicks || '0');
    const prevCtr = prev ? parseFloat(prev.ctr || '0') : null;
    const deltaCtR = prevCtr !== null ? ctr - prevCtr : null;
    const conversions = ((ad.actions || []) as any[]).find((a: any) => a.action_type === 'purchase')?.value || 0;
    const roas = conversions && spend > 0 ? (parseFloat(conversions) * 50) / spend : null; // estimate
    return {
      name: ad.ad_name || ad.name,
      campaign: ad.campaign_name,
      spend, ctr, clicks,
      cpc: parseFloat(ad.cpc || '0'),
      cpm: parseFloat(ad.cpm || '0'),
      reach: parseInt(ad.reach || '0'),
      conversions: parseInt(String(conversions) || '0'),
      roas,
      prevCtr,
      deltaCtr: deltaCtR,
      trend: deltaCtR === null ? 'new' : deltaCtR > 0.002 ? 'up' : deltaCtR < -0.002 ? 'down' : 'stable',
    };
  });

  // Sort: winners first (high CTR + spend)
  enriched.sort((a, b) => (b.ctr * Math.log(b.spend + 1)) - (a.ctr * Math.log(a.spend + 1)));

  const winners = enriched.filter(a => a.ctr > 0.015 && a.spend > 5);
  const losers = enriched.filter(a => a.ctr < 0.008 && a.spend > 10);
  const trending_up = enriched.filter(a => a.trend === 'up');
  const trending_down = enriched.filter(a => a.trend === 'down');

  // ── 4. Account-level summary ─────────────────────────────────────────────
  const totalSpend = enriched.reduce((s, a) => s + a.spend, 0);
  const totalClicks = enriched.reduce((s, a) => s + a.clicks, 0);
  const avgCtr = totalSpend > 0 ? enriched.reduce((s, a) => s + a.ctr * a.spend, 0) / totalSpend : 0;
  const yesterdaySpend = yesterdayAds.reduce((s: number, a: any) => s + parseFloat(a.spend || '0'), 0);
  const yesterdayCtr = yesterdayAds.length
    ? yesterdayAds.reduce((s: number, a: any) => s + parseFloat(a.ctr || '0'), 0) / yesterdayAds.length
    : 0;

  // ── 5. Update learned_patterns with real performance data ────────────────
  for (const ad of winners) {
    if (!ad.ctr) continue;
    const patKey = `meta_winner_${ad.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
    const { data: ex } = await sb.from('learned_patterns').select('id,sample_size,avg_ctr,variables')
      .eq('user_id', user_id).eq('pattern_key', patKey).maybeSingle();

    if (ex) {
      const n = ex.sample_size || 0;
      const newCtr = ((ex.avg_ctr || 0) * n + ad.ctr) / (n + 1);
      await sb.from('learned_patterns').update({
        sample_size: n + 1, avg_ctr: newCtr, avg_roas: ad.roas,
        is_winner: true, confidence: Math.min(1, (n + 1) / 7),
        insight_text: `"${ad.name.slice(0, 50)}": CTR ${ad.ctr.toFixed(3)}, spend R$${ad.spend.toFixed(0)}, trend ${ad.trend}`,
        last_updated: new Date().toISOString(),
        variables: { ...(ex.variables as any || {}), campaign: ad.campaign, last_ctr: ad.ctr, last_spend: ad.spend }
      }).eq('id', ex.id);
    } else {
      await sb.from('learned_patterns').insert({
        user_id, pattern_key: patKey, is_winner: true, sample_size: 1,
        avg_ctr: ad.ctr, avg_roas: ad.roas, confidence: 0.15,
        insight_text: `"${ad.name.slice(0, 50)}": CTR ${ad.ctr.toFixed(3)}, spend R$${ad.spend.toFixed(0)}`,
        variables: { campaign: ad.campaign, last_ctr: ad.ctr, last_spend: ad.spend, trend: ad.trend }
      });
    }
  }

  // ── 6. AI-generated insight using real data ───────────────────────────────
  let aiInsight = '';
  if (anthropicKey && current.length > 0) {
    try {
      const dataStr = JSON.stringify({
        period: `${since7} to ${until7}`,
        yesterday: { spend: yesterdaySpend.toFixed(2), avg_ctr: yesterdayCtr.toFixed(4) },
        week: { total_spend: totalSpend.toFixed(2), avg_ctr: avgCtr.toFixed(4), active_ads: current.length },
        top3: enriched.slice(0, 3).map(a => ({ name: a.name.slice(0, 40), ctr: a.ctr, spend: a.spend, trend: a.trend })),
        winners: winners.slice(0, 3).map(a => a.name.slice(0, 40)),
        losers: losers.slice(0, 3).map(a => a.name.slice(0, 40)),
        trending_up: trending_up.slice(0, 2).map(a => a.name.slice(0, 40)),
        trending_down: trending_down.slice(0, 2).map(a => a.name.slice(0, 40)),
      }, null, 2);

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: 'Você é um analista de performance de mídia paga. Responda em PT-BR. Seja direto, específico, acionável. Máximo 3 frases. Foco em o que fazer hoje.',
          messages: [{ role: 'user', content: `Analise esses dados de Meta Ads e dê 1 insight acionável para hoje:\n${dataStr}` }],
        }),
      });
      const aiData = await aiRes.json();
      aiInsight = aiData.content?.[0]?.text || '';
    } catch (e) {
      console.error('AI insight failed:', e);
    }
  }

  // ── 7. Save daily snapshot ───────────────────────────────────────────────
  await sb.from('daily_snapshots' as any).insert({
    user_id,
    persona_id: persona_id || null,
    date: fmt(today),
    account_id: accountId,
    account_name: activeAccount.name || accountId,
    total_spend: totalSpend,
    avg_ctr: avgCtr,
    total_clicks: totalClicks,
    active_ads: current.length,
    winners_count: winners.length,
    losers_count: losers.length,
    yesterday_spend: yesterdaySpend,
    yesterday_ctr: yesterdayCtr,
    top_ads: enriched.slice(0, 10),
    ai_insight: aiInsight,
    raw_period: { since: since7, until: until7 },
  }).onConflict('user_id,persona_id,date').merge();

  // ── 8. Rebuild user_ai_profile with enriched data ────────────────────────
  const { data: allPatterns } = await sb.from('learned_patterns')
    .select('is_winner, avg_ctr, avg_roas, insight_text, confidence, pattern_key')
    .eq('user_id', user_id).order('confidence', { ascending: false }).limit(20);

  const realWinners = (allPatterns || []).filter((p: any) => p.is_winner && p.confidence > 0.2);
  const bestCtr = winners[0]?.ctr || avgCtr;

  const summary = [
    `Semana: R$${totalSpend.toFixed(0)} spend, CTR médio ${(avgCtr * 100).toFixed(2)}%, ${current.length} anúncios ativos.`,
    winners.length ? `Vencedores: ${winners.slice(0, 2).map(a => `"${a.name.slice(0, 30)}" (CTR ${(a.ctr * 100).toFixed(2)}%)`).join(', ')}.` : '',
    losers.length ? `Pausar: ${losers.slice(0, 2).map(a => `"${a.name.slice(0, 30)}"`).join(', ')}.` : '',
    aiInsight || '',
  ].filter(Boolean).join(' ');

  await sb.from('user_ai_profile' as any).upsert({
    user_id,
    avg_hook_score: bestCtr * 1000, // normalize to hook score scale
    ai_summary: summary,
    ai_recommendations: {
      winners: winners.slice(0, 3).map(a => ({ name: a.name.slice(0, 40), ctr: a.ctr, trend: a.trend })),
      losers: losers.slice(0, 3).map(a => ({ name: a.name.slice(0, 40), ctr: a.ctr })),
      insight: aiInsight,
      updated: new Date().toISOString(),
    },
    total_analyses: current.length,
    last_updated: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return {
    ok: true,
    spend: totalSpend.toFixed(2),
    avg_ctr: avgCtr.toFixed(4),
    active_ads: current.length,
    winners: winners.length,
    losers: losers.length,
    ai_insight: aiInsight.slice(0, 100),
  };
}
