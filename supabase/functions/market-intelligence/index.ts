// market-intelligence v1 — contexto real do mercado
// Fontes: Google Trends (demanda) + Meta Ads Library (concorrência)
// Roda: diariamente junto com daily-intelligence
// Output: market_* learned_patterns + market_context no richContext do chat

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";
import { getActiveUserIds, logGate } from "../_shared/activity-gate.ts";

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

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id } = body;

    const targets: { user_id: string; persona_id: string | null }[] = [];
    if (user_id) {
      targets.push({ user_id, persona_id: persona_id || null });
    } else {
      // Cron: run for all users with personas
      const { data: personas } = await sb.from('personas' as any)
        .select('user_id, id').limit(50);
      (personas || []).forEach((p: any) => targets.push({ user_id: p.user_id, persona_id: p.id }));
    }

    // Activity gate — só processa users ativos nos últimos 7 dias.
    // User-triggered passa direto. Cron-mode filtra dormentes.
    const activeIds = !user_id ? await getActiveUserIds(sb, 7) : null;
    const filteredTargets = activeIds && activeIds.size > 0
      ? targets.filter(t => activeIds.has(t.user_id))
      : targets;
    if (activeIds && activeIds.size > 0) {
      logGate('market-intelligence', targets.length, filteredTargets.length);
    }
    if (!user_id && filteredTargets.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no_active_users_in_window' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const target of filteredTargets.slice(0, 20)) {
      try {
        const r = await runMarketIntelligence(sb, target.user_id, target.persona_id);
        results.push({ ...target, ...r });
      } catch(e) { results.push({ ...target, error: String(e) }); }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });
  } catch(e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
});

async function runMarketIntelligence(
  sb: any,
  user_id: string,
  persona_id: string | null
): Promise<any> {

  // ── STEP 1: Extract account context — keywords, niche, market, geo ──────
  const [personaRes, profileRes, patternsRes, metaConnRes] = await Promise.allSettled([
    persona_id
      ? sb.from('personas' as any).select('name, headline, result, updated_at').eq('id', persona_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('user_ai_profile' as any).select('industry, ai_summary, pain_point').eq('user_id', user_id).maybeSingle(),
    sb.from('learned_patterns' as any)
      .select('pattern_key, insight_text, hook_type, avg_ctr, is_winner')
      .eq('user_id', user_id).eq('is_winner', true)
      .order('avg_ctr', { ascending: false }).limit(10),
    sb.from('platform_connections' as any)
      .select('access_token, ad_accounts, selected_account_id')
      .eq('user_id', user_id).eq('platform', 'meta').eq('persona_id', persona_id || null).maybeSingle(),
  ]);

  const persona = personaRes.status === 'fulfilled' ? personaRes.value.data : null;
  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const patterns = patternsRes.status === 'fulfilled' ? patternsRes.value.data || [] : [];
  const metaConn = metaConnRes.status === 'fulfilled' ? metaConnRes.value.data : null;

  // Extract keywords from persona + patterns + profile
  const personaResult = persona?.result as any;
  const product = personaResult?.bio?.slice(0, 50) || '';
  const market = personaResult?.preferred_market || 'BR';
  const geo = market === 'BR' ? 'BR' : market === 'MX' ? 'MX' : market === 'IN' ? 'IN' : 'US';
  const industry = profile?.industry || personaResult?.headline || '';

  // Extract keywords from winning patterns — what's actually working
  const winningKeywords = patterns
    .filter((p: any) => p.insight_text)
    .map((p: any) => {
      const text = p.insight_text;
      // Extract meaningful phrases (skip generic words)
      const words = text.split(/[\s|:,]+/).filter((w: string) => w.length > 4);
      return words.slice(0, 3).join(' ');
    })
    .filter(Boolean)
    .slice(0, 5);

  // Also extract keywords from persona pains/desires
  const personaKeywords: string[] = [];
  if (personaResult?.pains) {
    personaResult.pains.slice(0, 2).forEach((pain: string) => {
      const words = pain.split(' ').filter((w: string) => w.length > 4).slice(0, 2);
      if (words.length) personaKeywords.push(words.join(' '));
    });
  }

  const allKeywords = [...new Set([...winningKeywords, ...personaKeywords])].slice(0, 5);

  if (!allKeywords.length && !industry) {
    return { skipped: 'no keywords to research' };
  }

  // Primary search term — most important keyword for this account
  const primaryKeyword = allKeywords[0] || industry;

  const marketSignals: any[] = [];

  // ── STEP 2: Google Trends — demand timing ────────────────────────────────
  try {
    const trendsData = await fetchGoogleTrends(primaryKeyword, geo, allKeywords);
    if (trendsData) {
      marketSignals.push({
        source: 'google_trends',
        keyword: primaryKeyword,
        geo,
        data: trendsData,
      });
    }
  } catch(e) {
    console.error('Google Trends error:', String(e));
  }

  // ── STEP 3: Meta Ads Library — competitor intelligence ───────────────────
  if (metaConn?.access_token) {
    try {
      const competitors = await fetchMetaAdsLibrary(
        metaConn.access_token,
        primaryKeyword,
        geo,
        allKeywords
      );
      if (competitors.length > 0) {
        marketSignals.push({
          source: 'meta_ads_library',
          query: primaryKeyword,
          competitors,
        });
      }
    } catch(e) {
      console.error('Meta Ads Library error:', String(e));
    }
  }

  if (!marketSignals.length) {
    return { skipped: 'no market signals fetched', keywords: allKeywords };
  }

  // ── STEP 4: Synthesize into actionable market context ────────────────────
  const today = new Date().toISOString().split('T')[0];
  const synthesized = synthesizeMarketSignals(marketSignals, primaryKeyword, geo, today);

  // ── STEP 5: Save as learned_patterns with market_* prefix ────────────────
  const patternKey = `market_intel_${geo.toLowerCase()}_${today}`;

  const { data: existing } = await sb.from('learned_patterns' as any)
    .select('id').eq('user_id', user_id).eq('pattern_key', patternKey).maybeSingle();

  const patternData = {
    user_id,
    persona_id: persona_id || null,
    pattern_key: patternKey,
    insight_text: synthesized.summary.slice(0, 200),
    hook_type: 'market_intelligence',
    confidence: 0.7,
    is_winner: null,
    sample_size: 1,
    avg_ctr: synthesized.trend_score > 0 ? synthesized.trend_score / 100 : null,
    variables: {
      keywords: allKeywords,
      geo,
      trend_score: synthesized.trend_score,
      trend_direction: synthesized.trend_direction,
      competitor_count: synthesized.competitor_count,
      top_competitor_formats: synthesized.top_formats,
      top_competitor_hooks: synthesized.top_hooks,
      seasonal_peak: synthesized.seasonal_peak,
      action: synthesized.action,
      raw_signals: marketSignals.map(s => ({ source: s.source, keyword: s.keyword || s.query })),
      fetched_at: new Date().toISOString(),
    },
    last_updated: new Date().toISOString(),
  };

  if (existing) {
    await sb.from('learned_patterns' as any).update(patternData).eq('id', existing.id);
  } else {
    await sb.from('learned_patterns' as any).insert(patternData);
  }

  // Also save individual competitor patterns if found
  const competitorSignal = marketSignals.find(s => s.source === 'meta_ads_library');
  if (competitorSignal?.competitors?.length) {
    for (const comp of competitorSignal.competitors.slice(0, 5)) {
      if (!comp.page_name || !comp.running_days) continue;
      const compKey = `market_competitor_${comp.page_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30)}_${today}`;
      await sb.from('learned_patterns' as any).upsert({
        user_id,
        persona_id: persona_id || null,
        pattern_key: compKey,
        insight_text: `Concorrente "${comp.page_name}" rodando ${comp.format || 'ad'} há ${comp.running_days} dias — ${comp.hook_preview?.slice(0, 60) || 'sem preview'}`,
        hook_type: 'competitor_signal',
        confidence: 0.6,
        is_winner: null,
        sample_size: 1,
        variables: { ...comp, source: 'meta_ads_library', fetched_at: new Date().toISOString() },
        last_updated: new Date().toISOString(),
      }, { onConflict: 'user_id,pattern_key' }).catch(() => {});
    }
  }

  return {
    ok: true,
    keyword: primaryKeyword,
    geo,
    signals: marketSignals.length,
    trend_direction: synthesized.trend_direction,
    competitor_count: synthesized.competitor_count,
    action: synthesized.action,
    summary: synthesized.summary,
  };
}

// ── Google Trends fetcher ────────────────────────────────────────────────────
async function fetchGoogleTrends(
  primaryKeyword: string,
  geo: string,
  relatedKeywords: string[]
): Promise<any> {

  // Google Trends unofficial API — used by trends.google.com itself
  // No API key needed, reasonable rate limits for daily usage
  const keywords = [primaryKeyword, ...relatedKeywords.slice(0, 4)].slice(0, 5);
  
  const comparisonItem = keywords.map(kw => ({
    keyword: kw,
    geo,
    time: 'today 3-m', // Last 3 months
  }));

  const reqParam = encodeURIComponent(JSON.stringify({
    comparisonItem,
    category: 0,
    property: '',
  }));

  const url = `https://trends.google.com/trends/api/explore?hl=pt-BR&tz=-180&req=${reqParam}&token=null&hl=pt-BR`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MarketIntelligence/1.0)',
      'Accept': 'application/json',
      'Referer': 'https://trends.google.com/',
    },
  });

  if (!res.ok) throw new Error(`Trends API: ${res.status}`);

  // Google Trends prepends ")]}',\n" to prevent JSON injection
  const rawText = await res.text();
  const jsonText = rawText.replace(/^\)\]\}',\n/, '').trim();
  const data = JSON.parse(jsonText);

  // Extract the timeline widget for trend data
  const widgets = data.widgets || [];
  const timelineWidget = widgets.find((w: any) => w.id === 'TIMESERIES');
  const relatedWidget = widgets.find((w: any) => w.id === 'RELATED_QUERIES');

  if (!timelineWidget) return null;

  // Fetch actual time series data
  const timelineToken = timelineWidget.token;
  const timelineReq = encodeURIComponent(JSON.stringify(timelineWidget.request));
  const timelineUrl = `https://trends.google.com/trends/api/widgetdata/multiline?hl=pt-BR&tz=-180&req=${timelineReq}&token=${timelineToken}&hl=pt-BR`;

  const timelineRes = await fetch(timelineUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MarketIntelligence/1.0)',
      'Referer': 'https://trends.google.com/',
    },
  });

  if (!timelineRes.ok) return { widgets_found: widgets.length };

  const timelineText = await timelineRes.text();
  const timelineJson = JSON.parse(timelineText.replace(/^\)\]\}',\n/, '').trim());

  const timelineData = timelineJson.default?.timelineData || [];
  
  // Calculate trend metrics
  const values = timelineData.map((d: any) => d.value?.[0] || 0);
  const recentValues = values.slice(-4); // Last 4 weeks
  const olderValues = values.slice(-12, -4); // Prior 8 weeks
  
  const recentAvg = recentValues.reduce((a: number, b: number) => a + b, 0) / Math.max(recentValues.length, 1);
  const olderAvg = olderValues.reduce((a: number, b: number) => a + b, 0) / Math.max(olderValues.length, 1);
  
  const trendChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  const currentScore = recentValues[recentValues.length - 1] || 0;
  
  // Detect seasonality — compare same period to last year if data available
  const latestDate = timelineData[timelineData.length - 1];

  return {
    primary_keyword: primaryKeyword,
    geo,
    current_score: currentScore, // 0-100 relative interest
    trend_change_pct: Math.round(trendChange),
    direction: trendChange > 10 ? 'rising' : trendChange < -10 ? 'falling' : 'stable',
    peak_week: timelineData.reduce((max: any, d: any) => 
      (d.value?.[0] || 0) > (max?.value?.[0] || 0) ? d : max, null)?.formattedAxisTime,
    latest_week: latestDate?.formattedAxisTime,
    raw_trend: values.slice(-8), // Last 8 data points
  };
}

// ── Meta Ads Library fetcher ─────────────────────────────────────────────────
async function fetchMetaAdsLibrary(
  accessToken: string,
  primaryKeyword: string,
  geo: string,
  relatedKeywords: string[]
): Promise<any[]> {

  const countryCode = geo === 'BR' ? 'BR' : geo === 'MX' ? 'MX' : geo === 'IN' ? 'IN' : 'US';
  
  // Search with primary keyword — what competitors are running NOW
  const url = new URL('https://graph.facebook.com/v18.0/ads_archive');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('search_terms', primaryKeyword);
  url.searchParams.set('ad_type', 'ALL');
  url.searchParams.set('ad_reached_countries', JSON.stringify([countryCode]));
  url.searchParams.set('ad_active_status', 'ACTIVE'); // Only currently running ads
  url.searchParams.set('fields', [
    'id',
    'page_name',
    'ad_creative_bodies',
    'ad_creative_link_titles',
    'ad_creative_link_captions',
    'ad_delivery_start_time',
    'ad_delivery_stop_time',
    'ad_snapshot_url',
    'publisher_platforms',
    'languages',
  ].join(','));
  url.searchParams.set('limit', '25');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meta Ads Library: ${res.status} — ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  const ads = data.data || [];

  if (!ads.length) return [];

  // Process each ad into actionable signals
  const today = new Date();
  const processed = ads.map((ad: any) => {
    const startDate = ad.ad_delivery_start_time ? new Date(ad.ad_delivery_start_time) : null;
    const runningDays = startDate ? Math.floor((today.getTime() - startDate.getTime()) / 86400000) : null;
    
    const bodies = ad.ad_creative_bodies || [];
    const titles = ad.ad_creative_link_titles || [];
    const fullText = [...titles, ...bodies].join(' ').slice(0, 300);
    
    // Detect format from publisher platforms
    const platforms = ad.publisher_platforms || [];
    const format = platforms.includes('instagram') && platforms.includes('facebook') ? 'multi-platform' :
      platforms.includes('instagram') ? 'Instagram' : platforms.includes('facebook') ? 'Facebook' : 'unknown';

    // Extract hook preview (first 80 chars of copy)
    const hookPreview = bodies[0]?.slice(0, 80) || titles[0]?.slice(0, 80) || '';

    return {
      page_name: ad.page_name,
      running_days: runningDays,
      format,
      hook_preview: hookPreview,
      full_text_preview: fullText,
      platforms,
      snapshot_url: ad.ad_snapshot_url,
      // Signal: ads running 14+ days are likely working
      likely_converting: (runningDays || 0) >= 14,
      // Signal: ads running 45+ days are proven winners
      proven_winner: (runningDays || 0) >= 45,
    };
  });

  // Sort by running_days descending — longest running = most proven
  return processed.sort((a: any, b: any) => (b.running_days || 0) - (a.running_days || 0));
}

// ── Synthesize signals into actionable context ───────────────────────────────
function synthesizeMarketSignals(
  signals: any[],
  keyword: string,
  geo: string,
  today: string
): any {
  const trendsSignal = signals.find(s => s.source === 'google_trends');
  const competitorSignal = signals.find(s => s.source === 'meta_ads_library');

  const trendScore = trendsSignal?.data?.current_score || 0;
  const trendDirection = trendsSignal?.data?.direction || 'unknown';
  const trendChange = trendsSignal?.data?.trend_change_pct || 0;

  const competitors = competitorSignal?.competitors || [];
  const competitorCount = competitors.length;
  const provenWinners = competitors.filter((c: any) => c.proven_winner);
  const likelyConverting = competitors.filter((c: any) => c.likely_converting);

  // Extract most common formats from competitors
  const formatCounts: Record<string, number> = {};
  competitors.forEach((c: any) => {
    const f = c.format || 'unknown';
    formatCounts[f] = (formatCounts[f] || 0) + 1;
  });
  const topFormats = Object.entries(formatCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  // Extract competitor hooks — proven winners first
  const topHooks = provenWinners.slice(0, 3).map((c: any) => c.hook_preview).filter(Boolean);

  // Generate action recommendation
  let action = '';
  let summary = '';

  if (trendDirection === 'rising' && trendChange > 20) {
    action = `OPORTUNIDADE: busca por "${keyword}" subiu ${trendChange}% em ${geo} — aumenta budget agora enquanto CPM ainda é favorável`;
  } else if (trendDirection === 'falling' && trendChange < -20) {
    action = `ATENÇÃO: demanda por "${keyword}" caiu ${Math.abs(trendChange)}% — considera diversificar ângulos ou aguardar próximo ciclo`;
  } else if (provenWinners.length > 3) {
    action = `MERCADO COMPETITIVO: ${provenWinners.length} concorrentes com ads rodando 45+ dias — diferenciação de ângulo é crítica`;
  } else if (competitorCount < 5 && trendScore > 50) {
    action = `JANELA ABERTA: alta demanda (score ${trendScore}/100) com baixa concorrência no Meta — momento de escalar`;
  } else {
    action = `Mercado estável. ${competitorCount} concorrentes ativos, demanda em ${trendDirection}`;
  }

  summary = [
    trendsSignal ? `Tendência "${keyword}" (${geo}): score ${trendScore}/100, ${trendDirection} ${trendChange > 0 ? '+' : ''}${trendChange}% vs últimas semanas` : '',
    competitorCount > 0 ? `${competitorCount} concorrentes ativos no Meta, ${likelyConverting.length} convertendo (14+ dias), ${provenWinners.length} provados (45+ dias)` : '',
    topFormats.length ? `Formato dominante entre concorrentes: ${topFormats.join(', ')}` : '',
  ].filter(Boolean).join('. ');

  return {
    summary,
    action,
    trend_score: trendScore,
    trend_direction: trendDirection,
    trend_change_pct: trendChange,
    competitor_count: competitorCount,
    proven_winners: provenWinners.length,
    top_formats: topFormats,
    top_hooks: topHooks,
    seasonal_peak: trendsSignal?.data?.peak_week || null,
  };
}
// v1 — market intelligence: google trends + meta ads library
