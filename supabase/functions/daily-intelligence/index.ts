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
      // Process ALL personas per user (each = one ad account in AdBrief)
      (conns || []).forEach((c: any) => {
        targets.push({ user_id: c.user_id, persona_id: c.persona_id });
      });
    }

    const results = [];
    for (const target of targets) {
      try {
        const r = await analyzeAccount(sb, ANTHROPIC, target.user_id, target.persona_id);
        results.push({ ...target, result: r });
      } catch (e) { results.push({ ...target, error: String(e) }); }
    }

    // Send ONE consolidated email per user with ALL their accounts
    const byUser: Record<string, typeof results> = {};
    results.forEach((r: any) => {
      if (!r.error) {
        if (!byUser[r.user_id]) byUser[r.user_id] = [];
        byUser[r.user_id].push(r);
      }
    });
    for (const [uid, accountResults] of Object.entries(byUser)) {
      try {
        await sb.functions.invoke('send-daily-intelligence-email', {
          body: { user_id: uid, all_results: accountResults }
        });
      } catch (e) { console.error('email error for', uid, e); }

      // Send proactive Telegram briefing with top 3 actions
      try {
        const { data: tg } = await sb.from('telegram_connections' as any)
          .select('chat_id, bot_token')
          .eq('user_id', uid).eq('active', true).maybeSingle();

        if (tg?.chat_id) {
          // Collect all actions across accounts, pick top 3 by urgency
          const allActions: any[] = [];
          for (const res of accountResults as any[]) {
            if (!res?.aiActions?.length) continue;
            for (const a of res.aiActions) {
              allActions.push({ ...a, account: res.account_name || '' });
            }
          }
          const urgencyOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
          allActions.sort((a, b) => (urgencyOrder[a.urgencia] ?? 3) - (urgencyOrder[b.urgencia] ?? 3));
          const top3 = allActions.slice(0, 3);

          if (top3.length > 0) {
            const lines = top3.map((a, i) => {
              const emoji = a.urgencia === 'alta' ? '🔴' : a.urgencia === 'media' ? '🟡' : '🟢';
              const tipoMap: Record<string, string> = { escalar: '⬆️ Escalar', pausar: '⏸ Pausar', criar: '✏️ Criar', revisar: '🔍 Revisar' };
              return `${emoji} <b>${tipoMap[a.tipo] || a.tipo}</b>: ${a.anuncio?.slice(0, 35) || '—'}
   ${a.motivo?.slice(0, 80) || ''}`;
            }).join('\n\n');

            const insight = (accountResults as any[])[0]?.aiInsight || '';
            const msg = `<b>📊 Briefing de hoje</b>\n\n${insight ? `💡 ${insight.slice(0, 120)}\n\n` : ''}<b>3 ações prioritárias:</b>\n\n${lines}`;

            const botToken = tg.bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
            if (botToken) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: tg.chat_id, text: msg, parse_mode: 'HTML' })
              });
            }
          }
        }
      } catch (e) { console.error('telegram briefing error:', e); }
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
    'actions', 'action_values', 'cost_per_action_type',
    'video_play_actions', 'video_avg_time_watched_actions', 'video_p25_watched_actions',
    'video_p75_watched_actions', 'video_thruplay_watched_actions',
    'website_purchase_roas', 'canvas_avg_view_percent',
    'date_start', 'date_stop'
  ].join(',');

  const [wk1Res, wk2Res, ydRes, campsRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d7}","until":"${today}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${d14}","until":"${d7}"}&sort=spend_descending&limit=50&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${account.id}/insights?level=ad&fields=${fields}&time_range={"since":"${yesterday}","until":"${today}"}&sort=spend_descending&limit=20&access_token=${token}`),
    fetch(`https://graph.facebook.com/v19.0/${account.id}/campaigns?fields=id,name,objective,optimization_goal&limit=50&access_token=${token}`),
  ]);

  const [wk1, wk2, yd, campsData] = await Promise.all([wk1Res.json(), wk2Res.json(), ydRes.json(), campsRes.json()]);

  // Build campaign → objective map
  const campObjectiveMap: Record<string, string> = {};
  ((campsData?.data || []) as any[]).forEach((c: any) => {
    if (c.name) campObjectiveMap[c.name] = c.objective || 'OUTCOME_TRAFFIC';
  });

  // KPI definition per campaign objective
  // Each objective has a PRIMARY KPI and SECONDARY KPIs
  const getKpiConfig = (objective: string): {
    primary: string; primaryLabel: string;
    secondary: string[]; winnerThreshold: Record<string, number>;
  } => {
    const o = (objective || '').toUpperCase();
    if (o.includes('PURCHASE') || o.includes('CONVERSIONS') || o.includes('OUTCOME_SALES')) return {
      primary: 'roas', primaryLabel: 'ROAS',
      secondary: ['cpa', 'ctr', 'cpc'],
      winnerThreshold: { roas: 2.0, cpa: 50, ctr: 0.01 },
    };
    if (o.includes('LEAD') || o.includes('OUTCOME_LEADS')) return {
      primary: 'cpl', primaryLabel: 'CPL',
      secondary: ['ctr', 'conv_rate', 'cpc'],
      winnerThreshold: { cpl: 20, ctr: 0.012, conv_rate: 0.05 },
    };
    if (o.includes('APP') || o.includes('MOBILE_APP')) return {
      primary: 'cpi', primaryLabel: 'CPI',
      secondary: ['ctr', 'cpc', 'cpm'],
      winnerThreshold: { cpi: 8, ctr: 0.01 },
    };
    if (o.includes('VIDEO') || o.includes('VIDEO_VIEWS')) return {
      primary: 'thruplay_rate', primaryLabel: 'ThruPlay%',
      secondary: ['hook_rate', 'hold_rate', 'cpm'],
      winnerThreshold: { thruplay_rate: 0.15, hook_rate: 0.25 },
    };
    if (o.includes('REACH') || o.includes('BRAND') || o.includes('AWARENESS')) return {
      primary: 'cpm', primaryLabel: 'CPM',
      secondary: ['frequency', 'reach', 'impressions'],
      winnerThreshold: { cpm: 15 },
    };
    if (o.includes('ENGAGEMENT') || o.includes('POST_ENGAGEMENT')) return {
      primary: 'engagement_rate', primaryLabel: 'Eng%',
      secondary: ['ctr', 'cpc', 'cpm'],
      winnerThreshold: { engagement_rate: 0.03, ctr: 0.015 },
    };
    // Default: traffic / link clicks
    return {
      primary: 'ctr', primaryLabel: 'CTR',
      secondary: ['cpc', 'cpm', 'frequency'],
      winnerThreshold: { ctr: 0.018, cpc: 2.0 },
    };
  };
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
    const conversions = getConversions(ad);
    const video = getVideoRetention(ad);

    // REAL ROAS from Meta (not estimate)
    const purchaseRoasArr = (ad.website_purchase_roas || []) as any[];
    const realRoas = purchaseRoasArr.length ? parseN(purchaseRoasArr[0]?.value) : null;
    // Fallback: estimate from action_values if purchase ROAS not available
    const actionValues = (ad.action_values || []) as any[];
    const purchaseValue = actionValues.find((a: any) => a.action_type === 'purchase')?.value;
    const roas = realRoas || (purchaseValue && spend > 0 ? parseN(purchaseValue) / spend : null);

    // CPA / CPL
    const cpa = conversions > 0 && spend > 0 ? spend / conversions : null;

    // Video KPIs
    const videoPlays = parseN((ad.video_play_actions || [])[0]?.value);
    const thruPlays = parseN((ad.video_thruplay_watched_actions || [])[0]?.value);
    const hookRate = impressions > 0 ? videoPlays / impressions : null;          // % that hit play
    const thruPlayRate = videoPlays > 0 ? thruPlays / videoPlays : null;         // % that watched full
    const avgWatch = parseN((ad.video_avg_time_watched_actions || [])[0]?.value);

    // Engagement
    const engagements = (ad.actions || []).find((a: any) => a.action_type === 'post_engagement');
    const engagementRate = impressions > 0 && engagements ? parseN(engagements.value) / impressions : null;

    // Campaign objective → pick the right KPI
    const objective = campObjectiveMap[ad.campaign_name] || 'OUTCOME_TRAFFIC';
    const kpiCfg = getKpiConfig(objective);

    // KPI-aware winner/loser detection (no longer CTR-only)
    const kpiValue = (() => {
      switch (kpiCfg.primary) {
        case 'roas':       return roas;
        case 'cpl':        return cpa;   // CPL = CPA for leads
        case 'cpi':        return cpa;   // CPI = CPA for app installs
        case 'thruplay_rate': return thruPlayRate;
        case 'hook_rate':  return hookRate;
        case 'cpm':        return parseN(ad.cpm);
        case 'engagement_rate': return engagementRate;
        default:           return ctr;
      }
    })();

    const threshold = kpiCfg.winnerThreshold[kpiCfg.primary] ?? 0;

    // For cost KPIs (lower = better): cpa, cpl, cpi, cpm, cpc
    const costKpis = ['cpa', 'cpl', 'cpi', 'cpm', 'cpc'];
    const isPrimaryGood = kpiValue !== null
      ? (costKpis.includes(kpiCfg.primary)
          ? kpiValue <= threshold
          : kpiValue >= threshold)
      : false;

    const prevKpi = p ? (() => {
      if (kpiCfg.primary === 'roas') {
        const pRoas = (p.website_purchase_roas || [])[0]?.value;
        return pRoas ? parseN(pRoas) : null;
      }
      return p.ctr ? parseN(p.ctr) : null;
    })() : null;

    const isFatigued = frequency > 3.5 || (prevCtr !== null && prevCtr > 0 && ctr / prevCtr < 0.7);
    const isScalable = isPrimaryGood && spend > 10 && (prevKpi === null || kpiValue! >= prevKpi * 0.85);
    const needsPause = (!isPrimaryGood && spend > 20 && conversions === 0 && ctr < 0.005)
      || (roas !== null && roas < 0.5 && spend > 50)
      || (cpa !== null && cpa > 200 && spend > 40);
    const deltaCtr = prevCtr !== null ? ((ctr - prevCtr) / Math.max(prevCtr, 0.001) * 100) : null;

    // ── Trajectory prediction — predict days until critical threshold ──────
    // Uses learned_patterns history to calculate REAL frequency velocity
    const predictDaysToFatigue = (() => {
      if (frequency <= 1.5) return null;
      // Try to get real velocity from learned_patterns history
      const adKey = `meta_ad_${ad.ad_name?.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35) || ''}`;
      // We'll compute velocity from enriched history after patterns are loaded
      // For now use spend-weighted estimate: higher spend = faster frequency growth
      const spendFactor = spend > 100 ? 0.5 : spend > 50 ? 0.35 : 0.2;
      const freqVelocity = spendFactor;
      const daysLeft = Math.ceil((3.5 - frequency) / Math.max(freqVelocity, 0.05));
      return frequency >= 2.0 && daysLeft > 0 && daysLeft <= 7 ? daysLeft : null;
    })();
    const ctrVelocity = deltaCtr !== null ? deltaCtr : 0;
    const predictCritical = predictDaysToFatigue !== null
      ? `fadiga em ~${predictDaysToFatigue}d (freq ${frequency.toFixed(1)}x)`
      : (ctrVelocity < -20 ? `CTR caindo rápido (${ctrVelocity.toFixed(0)}%)` : null);

    return {
      id: ad.ad_id, name: ad.ad_name || 'Sem nome',
      adset: ad.adset_name, campaign: ad.campaign_name,
      objective, kpiPrimary: kpiCfg.primary, kpiLabel: kpiCfg.primaryLabel, kpiValue,
      spend, ctr, cpc, cpm: parseN(ad.cpm), impressions, frequency,
      conversions, roas, cpa,
      hookRate, thruPlayRate, avgWatch, engagementRate,
      prevCtr, deltaCtr,
      isFatigued, isScalable, needsPause, predictCritical,
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

  // ── Patterns: learn from full funnel — CTR + conversions + ROAS ─────────
  // Pixel data (actions, cost_per_action, roas) already in enriched[] from Meta API
  for (const ad of scalable.slice(0, 10)) {
    if (ad.ctr < 0.01) continue;
    const key = `meta_ad_${ad.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 35)}`;
    const { data: ex } = await sb.from('learned_patterns').select('id, sample_size, avg_ctr, avg_roas, variables')
      .eq('user_id', user_id).eq('pattern_key', key).maybeSingle();
    const vars: any = (ex?.variables as any) || {};
    const history = vars.history || [];
    history.unshift({ date: today, ctr: ad.ctr, spend: ad.spend, conversions: ad.conversions, roas: ad.roas||null, cpa: ad.cpa||null, kpi_value: ad.kpiValue, trend: ad.trend, frequency: ad.frequency, predictCritical: ad.predictCritical || null, isFatigued: ad.isFatigued });
    if (ex) {
      const n = ex.sample_size || 0;
      const vars: any = (ex.variables as any) || {};
      // Prediction confirmation: if we predicted fatigue and it happened, boost signal weight
      const prevHistory = vars.history || [];
      const lastPred = prevHistory.find((h: any) => h.predictCritical);
      const predictionConfirmed = lastPred && ad.isFatigued && !prevHistory[0]?.isFatigued;
      const confidenceBoost = predictionConfirmed ? 0.15 : 0; // confirmed prediction = stronger signal
      await sb.from('learned_patterns').update({
        sample_size: n + 1,
        avg_ctr: ((ex.avg_ctr || 0) * n + ad.ctr) / (n + 1),
        avg_roas: ad.roas || ex.avg_roas,
        is_winner: ad.isScalable,
        confidence: Math.min(1, (n + 1) / 14 + confidenceBoost),
        insight_text: `"${ad.name.slice(0, 45)}": ${ad.kpiLabel} ${ad.kpiValue !== null ? ad.kpiValue.toFixed(2) : '—'} (${ad.trend}) | CTR ${(ad.ctr*100).toFixed(2)}% | R$${ad.spend.toFixed(0)}${ad.conversions > 0 ? ` | ${ad.conversions} conv` : ''}${ad.roas ? ` | ROAS ${ad.roas.toFixed(2)}x` : ''}${ad.cpa ? ` | CPA R$${ad.cpa.toFixed(0)}` : ''}`,
        last_updated: new Date().toISOString(),
        variables: { ...vars, history: history.slice(0, 30), campaign: ad.campaign, adset: ad.adset, frequency: ad.frequency }
      }).eq('id', ex.id);
    } else {
      await sb.from('learned_patterns').insert({
        user_id, pattern_key: key, is_winner: ad.isScalable, sample_size: 1,
        avg_ctr: ad.ctr, avg_roas: ad.roas || null, confidence: 0.07,
        insight_text: `"${ad.name.slice(0, 45)}": ${ad.kpiLabel} ${ad.kpiValue !== null ? ad.kpiValue.toFixed(2) : '—'} | CTR ${(ad.ctr*100).toFixed(2)}% | R$${ad.spend.toFixed(0)}`,
        variables: { history: history.slice(0, 30), campaign: ad.campaign, adset: ad.adset }
      });
    }
  }

  // ── AI Insight — focused on what to DO today ─────────────────────────────
  let aiInsight = '';
  let aiActions: any[] = [];
  if (anthropicKey && curr.length > 0) {
    try {
      // Load previous snapshots for delta analysis (causality)
      const { data: prevSnaps } = await sb.from('daily_snapshots' as any)
        .select('date, avg_ctr, total_spend, active_ads, ai_insight')
        .eq('user_id', user_id).eq('persona_id', persona_id || null)
        .lt('date', today).order('date', { ascending: false }).limit(7);

      // Load market intelligence patterns for correlation
      const { data: marketPatterns } = await sb.from('learned_patterns' as any)
        .select('insight_text, variables, last_updated')
        .eq('user_id', user_id)
        .like('pattern_key', 'market_intel_%')
        .order('last_updated', { ascending: false }).limit(1);

      const prevSnap = (prevSnaps || [])[0];
      const ctrDelta = prevSnap && prevSnap.avg_ctr > 0
        ? ((avgCtr - prevSnap.avg_ctr) / prevSnap.avg_ctr * 100)
        : null;
      const spendDelta = prevSnap && prevSnap.total_spend > 0
        ? ((totalSpend - prevSnap.total_spend) / prevSnap.total_spend * 100)
        : null;
      const marketIntel = marketPatterns?.[0];
      const marketVars = marketIntel?.variables as any;

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
        // Delta vs last week — for causal diagnosis
        ctr_vs_last_week: ctrDelta !== null ? `${ctrDelta > 0 ? '+' : ''}${ctrDelta.toFixed(1)}%` : 'first_week',
        spend_vs_last_week: spendDelta !== null ? `${spendDelta > 0 ? '+' : ''}${spendDelta.toFixed(1)}%` : 'first_week',
        previous_insight: prevSnap?.ai_insight?.slice(0, 100) || null,
        // Market context for correlation
        market_trend: marketVars?.trend_direction || null,
        market_competitor_count: marketVars?.competitor_count || null,
        market_action: marketVars?.action?.slice(0, 80) || null,
        top3: enriched.slice(0, 3).map((a: any) => ({
          name: a.name.slice(0, 40),
          objective: a.objective,
          primary_kpi: `${a.kpiLabel}: ${a.kpiValue !== null ? a.kpiValue.toFixed(2) : '—'}`,
          ctr_pct: (a.ctr * 100).toFixed(2),
          cpa: a.cpa ? `R$${a.cpa.toFixed(0)}` : null,
          roas: a.roas ? a.roas.toFixed(2) : null,
          hook_rate: a.hookRate ? `${(a.hookRate * 100).toFixed(1)}%` : null,
          thruplay_rate: a.thruPlayRate ? `${(a.thruPlayRate * 100).toFixed(1)}%` : null,
          spend: a.spend.toFixed(0),
          conversions: a.conversions,
          trend: a.trend,
          frequency: a.frequency.toFixed(1),
        })),
        scale_now: scalable.slice(0, 3).map((a: any) => a.name.slice(0, 40)),
        fatigued: fatigued.slice(0, 3).map((a: any) => ({ name: a.name.slice(0, 40), freq: a.frequency.toFixed(1), ctr_drop: a.deltaCtr?.toFixed(1), predict: a.predictCritical })),
        approaching_fatigue: enriched.filter((a: any) => a.predictCritical && !a.isFatigued).slice(0, 3).map((a: any) => ({ name: a.name.slice(0, 40), predict: a.predictCritical, freq: a.frequency.toFixed(1) })),
        pause_now: toPause.slice(0, 3).map((a: any) => a.name.slice(0, 40)),
      };

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `Você é um analista sênior de mídia paga com 10 anos de experiência. Responda SEMPRE em Português Brasileiro.
Sua função é DIAGNOSTICAR, não apenas descrever. A diferença:
- Fraco: "CTR caiu 18% esta semana"
- Forte: "CTR caiu 18% — provável fadiga criativa: frequência 4.2, mesmo criativo há 21 dias, sem novos ads"
- Forte: "CTR caiu 18% — contexto: mercado com 8 concorrentes novos, demanda estável. Causa mais provável: competição de leilão"

Analise os dados e identifique CAUSAS, não sintomas.

Hipóteses causais por ordem de probabilidade:
1. Fadiga criativa → frequência alta + sem ads novos + CTR caindo
2. Competição de leilão → CPM subindo + mercado competitivo + CTR caindo
3. Sazonalidade → padrão histórico + queda sem fadiga
4. Problema de landing → CTR estável mas conversões caindo
5. Público esgotado → frequência muito alta + ROAS caindo

Retorne JSON:
{
  "resumo": "<1 frase: situação real>",
  "insight_principal": "<2 frases: insight com CAUSA provável — seja específico>",
  "causa_provavel": "<hipótese causal mais provável baseada nos dados disponíveis>",
  "confianca_causa": "alta|media|baixa",
  "acoes": [
    {"tipo": "escalar|pausar|criar|revisar", "anuncio": "<nome>", "motivo": "<dado específico que justifica>", "urgencia": "alta|media|baixa"}
  ],
  "alerta": "<urgente em 1 frase ou null>"
}`,
          messages: [{ role: 'user', content: JSON.stringify(ctx, null, 2) }],
        }),
      });
      const aiData = await aiRes.json();
      const rawText = aiData.content?.[0]?.text || '{}';
      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      aiInsight = parsed.insight_principal || parsed.resumo || '';
      // Append causal diagnosis to insight when confidence is high/medium
      if (parsed.causa_provavel && parsed.confianca_causa !== 'baixa') {
        aiInsight = `${aiInsight} | Causa provável: ${parsed.causa_provavel}`;
      }
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

  // ── GAP 3 FIX: Feed real CTR/ROAS per ad back into capture-learning ──────
  // This closes the creative loop: hook generated → goes live → performance captured → feeds next generation
  const capturePromises = [];
  for (const ad of [...scalable, ...toPause].slice(0, 15)) {
    if (!ad.ctr && !ad.roas) continue;
    // Infer hook_type from ad name — simple heuristic
    const name = (ad.name || '').toLowerCase();
    const hookType = name.includes('ugc') ? 'ugc' : name.includes('question') || name.includes('?') ? 'question' :
      name.includes('before') || name.includes('depois') ? 'before_after' :
      name.includes('tip') || name.includes('dica') ? 'educational' :
      name.includes('depo') || name.includes('review') ? 'social_proof' : 'direct';
    
    capturePromises.push(
      sb.functions.invoke('capture-learning', {
        body: {
          user_id,
          event_type: 'performance_reported',
          data: {
            hook_type: hookType,
            hook_text: ad.name?.slice(0, 100),
            ctr: ad.ctr,
            roas: ad.roas || null,
            platform: 'meta',
            market: 'BR',
          }
        }
      }).catch(() => {})
    );
  }
  await Promise.allSettled(capturePromises);

  // ── GAP 4 FIX: Proactive delta alerts — detect degradation automatically ──
  // Get previous snapshot to calculate delta
  const { data: prevSnap } = await sb.from('daily_snapshots' as any)
    .select('date, avg_ctr, total_spend, active_ads, ai_insight')
    .eq('user_id', user_id)
    .eq('persona_id', persona_id || null)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prevSnap) {
    const ctrDelta = prevSnap.avg_ctr > 0 ? ((avgCtr - prevSnap.avg_ctr) / prevSnap.avg_ctr) * 100 : 0;
    const spendDelta = prevSnap.total_spend > 0 ? ((totalSpend - prevSnap.total_spend) / prevSnap.total_spend) * 100 : 0;
    const alerts = [];

    // CTR drop >20% → critical alert
    if (ctrDelta < -20 && avgCtr > 0) {
      alerts.push({
        user_id, persona_id: persona_id || null,
        type: 'critical',
        urgency: 'high',
        detail: `CTR caiu ${Math.abs(ctrDelta).toFixed(1)}% em relação a ontem (${(prevSnap.avg_ctr*100).toFixed(2)}% → ${(avgCtr*100).toFixed(2)}%). Verifique fadiga criativa.`,
        ad_name: account.name || null,
        campaign_name: null,
        created_at: new Date().toISOString(),
      });
    }

    // Spend jumped >50% without conversion improvement → warning
    if (spendDelta > 50 && totalSpend > 100) {
      alerts.push({
        user_id, persona_id: persona_id || null,
        type: 'warning',
        urgency: 'high',
        detail: `Spend subiu ${spendDelta.toFixed(0)}% (R$${prevSnap.total_spend.toFixed(0)} → R$${totalSpend.toFixed(0)}) sem melhoria proporcional de conversão.`,
        ad_name: account.name || null,
        campaign_name: null,
        created_at: new Date().toISOString(),
      });
    }

    // Ads with frequency >4 + CTR dropping = burn warning
    for (const ad of fatigued.slice(0, 3)) {
      if (ad.frequency > 4 && (ad.deltaCtr || 0) < -15) {
        alerts.push({
          user_id, persona_id: persona_id || null,
          type: 'critical',
          urgency: 'high',
          detail: `"${ad.name.slice(0,50)}" com frequência ${ad.frequency.toFixed(1)} e CTR caindo ${Math.abs(ad.deltaCtr||0).toFixed(0)}% — pausar agora antes de queimar mais verba.`,
          ad_name: ad.name,
          campaign_name: ad.campaign,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (alerts.length > 0) {
      await sb.from('account_alerts' as any).insert(alerts).catch(() => {});
    }
  }

  // ── GAP 2 FIX: Auto-actions for users with auto_pilot enabled ─────────────
  // Check if user has auto_pilot preference
  const { data: userPrefs } = await sb.from('user_ai_profile' as any)
    .select('ai_recommendations')
    .eq('user_id', user_id)
    .maybeSingle();
  
  const autoPilot = (userPrefs?.ai_recommendations as any)?.auto_pilot === true;
  const autoActionsLog: string[] = [];

  if (autoPilot && toPause.length > 0) {
    // Auto-pause ads that clearly need it (high spend, zero conversions, failing CTR)
    const obviousPauses = toPause.filter((a: any) => 
      a.spend > 50 && a.conversions === 0 && a.ctr < 0.003
    );
    
    for (const ad of obviousPauses.slice(0, 3)) {
      try {
        const { data: conn } = await sb.from('platform_connections' as any)
          .select('access_token').eq('user_id', user_id).eq('platform', 'meta')
          .eq(persona_id ? 'persona_id' : 'persona_id', persona_id || null)
          .maybeSingle();
        
        if (conn?.access_token) {
          // Execute pause via Meta API
          const pauseRes = await fetch(`https://graph.facebook.com/v18.0/${ad.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PAUSED', access_token: conn.access_token }),
          });
          
          if (pauseRes.ok) {
            autoActionsLog.push(`Pausado: "${ad.name.slice(0,40)}" (R$${ad.spend.toFixed(0)} gasto, 0 conversões)`);
            
            // Log the action
            await sb.from('account_alerts' as any).insert({
              user_id, persona_id: persona_id || null,
              type: 'action',
              urgency: 'low',
              detail: `[Auto-Pilot] Pausei "${ad.name.slice(0,50)}" automaticamente: R$${ad.spend.toFixed(0)} gasto sem conversões, CTR ${(ad.ctr*100).toFixed(2)}%.`,
              ad_name: ad.name,
              campaign_name: ad.campaign,
              created_at: new Date().toISOString(),
            }).catch(() => {});

            // Capture this decision as a learning signal
            await sb.functions.invoke('capture-learning', {
              body: {
                user_id,
                event_type: 'meta_action_executed',
                data: { action: 'pause', target_name: ad.name, target_type: 'ad', target_id: ad.id, value: null, executed_at: new Date().toISOString() }
              }
            }).catch(() => {});
          }
        }
      } catch(e) { /* non-fatal */ }
    }
  }

  // ── MARKET INTELLIGENCE — runs async, doesn't block ────────────────────────
  // Fire and forget — grabs Google Trends + Meta Ads Library for this account's keywords
  sb.functions.invoke('market-intelligence', {
    body: { user_id, persona_id: persona_id || null }
  }).catch(() => {}); // Non-fatal — never block daily-intelligence for market data

  // Email is sent once per user after all accounts processed (handled by caller)

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

  // Load existing ai_recommendations to preserve business_goal
  const { data: existingProfile } = await sb.from('user_ai_profile' as any)
    .select('ai_recommendations').eq('user_id', user_id).maybeSingle();
  const existingRecs = (existingProfile?.ai_recommendations as any) || {};
  const existingGoal = existingRecs.business_goal;

  // Update business_goal progress if set
  let updatedGoal = existingGoal;
  if (existingGoal?.target_conversions && totalConversions > 0) {
    const progressPct = ((totalConversions / existingGoal.target_conversions) * 100).toFixed(0);
    const onTrack = totalConversions >= (existingGoal.target_conversions * 0.7); // 70% through week
    updatedGoal = {
      ...existingGoal,
      progress: `${totalConversions}/${existingGoal.target_conversions} conversões (${progressPct}%) — ${onTrack ? '✅ no ritmo' : '⚠️ abaixo do ritmo'}`,
      last_checked: today,
      actual_cpa: totalConversions > 0 ? `R$${(totalSpend / totalConversions).toFixed(0)}` : null,
    };
  }

  await sb.from('user_ai_profile' as any).upsert({
    user_id, ai_summary: summary, avg_hook_score: avgCtr * 1000, total_analyses: curr.length,
    ai_recommendations: {
      ...existingRecs,
      actions: aiActions,
      winners: winners.slice(0,3).map((p: any) => p.insight_text),
      insight: aiInsight,
      updated: today,
      auto_pilot: autoPilot,
      business_goal: updatedGoal,
    },
    last_updated: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return {
    ok: true, account: account.name || account.id,
    spend: totalSpend.toFixed(2), ctr: (avgCtr*100).toFixed(3),
    ads: curr.length, scalable: scalable.length, pause: toPause.length, fatigued: fatigued.length,
    insight: aiInsight.slice(0, 80),
    auto_actions: autoActionsLog,
  };
}
// redeploy 202603270200
