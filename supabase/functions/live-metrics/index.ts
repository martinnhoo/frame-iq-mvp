// live-metrics v1 — fetches real-time data from Meta + Google Ads APIs
// Called by PerformanceDashboard on load and on manual refresh
// Returns: spend, ctr, clicks, impressions, conversions, roas, top_ads, daily_breakdown
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const parseN = (v: any) => parseFloat(String(v || "0")) || 0;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const ok = (d: object) => new Response(JSON.stringify(d), { headers: { ...cors, "Content-Type": "application/json" } });
  const err = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Use a separate client with anon key for user token validation
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const body = await req.json();
    const { user_id, persona_id, period = "7d", date_from, date_to, account_id: accountIdOverride } = body;

    if (!await isUserAuthorized(req, sbAuth, user_id)) return unauthorizedResponse(cors);

    const days = period === "90d" ? 90 : period === "60d" ? 60 : period === "30d" ? 30 : period === "14d" ? 14 : 7;
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    // Use explicit date range if provided, otherwise calculate from period
    const today = date_to || fmt(now);
    const since = date_from || fmt(new Date(now.getTime() - days * 86400000));
    const prevSince = fmt(new Date(new Date(since).getTime() - (new Date(today).getTime() - new Date(since).getTime())));

    // ── Get both Meta and Google connections ──────────────────────────────────
    const { data: allConns } = await sb.from("platform_connections" as any)
      .select("platform, access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
      .eq("user_id", user_id)
      .eq("persona_id", persona_id)
      .eq("status", "active");

    const metaConn  = (allConns || []).find((c: any) => c.platform === "meta");
    // const googleConn = (allConns || []).find... — disabled

    const results: any = {
      meta: null,
      google: null,
      combined: null,
    };

    // ── META ADS ──────────────────────────────────────────────────────────────
    if (metaConn?.access_token) {
      try {
        const accs = (metaConn.ad_accounts || []) as any[];
        // Use override if passed (from localStorage selection), else DB value, else first account
        const effectiveAccId = accountIdOverride || metaConn.selected_account_id;
        const acc  = (effectiveAccId && accs.find((a: any) => a.id === effectiveAccId)) || accs[0];

        if (acc?.id) {
          const token = metaConn.access_token;
          const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,website_purchase_roas,date_start";

          // Load user's goal conversion event (if configured)
          let goalEvent: string | null = null;
          try {
            const { data: accRow } = await sb.from("ad_accounts" as any)
              .select("goal_conversion_event")
              .eq("user_id", user_id).eq("meta_account_id", acc.id.replace("act_", ""))
              .maybeSingle();
            goalEvent = (accRow as any)?.goal_conversion_event || null;
          } catch { /* ignore — fallback to purchase */ }

          const [currRes, prevRes, breakdownRes] = await Promise.all([
            // Current period — account level
            fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=account&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&access_token=${token}`),
            // Previous period — for delta
            fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=account&fields=${fields}&time_range={"since":"${prevSince}","until":"${since}"}&access_token=${token}`),
            // Daily breakdown for chart
            fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=account&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&time_increment=1&access_token=${token}`),
          ]);

          const [curr, prev, breakdown] = await Promise.all([currRes.json(), prevRes.json(), breakdownRes.json()]);

          const c = curr.data?.[0] || {};
          const p = prev.data?.[0] || {};

          // Extract conversions from actions — use goal event if configured, else purchase
          const convEvent = goalEvent || "purchase";
          const getConversions = (d: any) => {
            const actions = d.actions || [];
            const match = actions.find((a: any) => a.action_type === convEvent);
            return match ? parseN(match.value) : 0;
          };
          const getConvValue = (d: any) => {
            const vals = d.action_values || [];
            const match = vals.find((a: any) => a.action_type === convEvent);
            return match ? parseN(match.value) : 0;
          };

          const metaSpend = parseN(c.spend);
          const prevSpend = parseN(p.spend);
          const metaCtr   = parseN(c.ctr) / 100; // Meta returns ctr as percentage string
          const prevCtr   = parseN(p.ctr) / 100;
          const metaClicks = parseN(c.clicks);
          const prevClicks = parseN(p.clicks);
          const metaImpr  = parseN(c.impressions);
          const metaReach  = parseN(c.reach);
          const metaFreq   = parseN(c.frequency);
          const metaCpm    = metaImpr > 0 ? (metaSpend / metaImpr) * 1000 : 0;
          const metaCpc    = metaClicks > 0 ? metaSpend / metaClicks : 0;
          const metaConv  = getConversions(c);
          const metaConvVal = getConvValue(c);
          const metaRoas  = metaSpend > 0 && metaConvVal > 0 ? metaConvVal / metaSpend : null;
          const metaCpa   = metaConv > 0 ? metaSpend / metaConv : null;
          // Prior-period conversion metrics for delta computation
          const prevConv    = getConversions(p);
          const prevConvVal = getConvValue(p);
          const prevRoas    = prevSpend > 0 && prevConvVal > 0 ? prevConvVal / prevSpend : null;
          const prevCpa     = prevConv > 0 ? prevSpend / prevConv : null;

          // Top ads — separate request
          const adsFields = "ad_id,ad_name,adset_name,campaign_name,spend,ctr,cpc,impressions,actions,action_values,website_purchase_roas";
          const adsRes = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${adsFields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=10&access_token=${token}`);
          const adsData = await adsRes.json();
          const topAdsRaw = (adsData.data || []).map((ad: any) => ({
            id: ad.ad_id,
            name: ad.ad_name,
            campaign: ad.campaign_name,
            adset: ad.adset_name,
            spend: parseN(ad.spend),
            ctr: parseN(ad.ctr) / 100,
            cpc: parseN(ad.cpc),
            impressions: parseN(ad.impressions),
            conversions: getConversions(ad),
            roas: (() => {
              const convVal = getConvValue(ad);
              const spendAd = parseN(ad.spend);
              return spendAd > 0 && convVal > 0 ? convVal / spendAd : null;
            })(),
            platform: "meta",
            thumbnail_url: null as string | null,
          }));

          // Fetch creative thumbnails — use ads endpoint with field expansion
          // The insights endpoint doesn't return creative data, so we fetch ads separately
          const adIds = topAdsRaw.map((a: any) => a.id).filter(Boolean);
          if (adIds.length > 0) {
            try {
              // Fetch ads with creative thumbnail using filtering
              const filterParam = encodeURIComponent(JSON.stringify([{ field: "id", operator: "IN", value: adIds }]));
              const thumbUrl = `https://graph.facebook.com/v21.0/${acc.id}/ads?filtering=${filterParam}&fields=id,creative{thumbnail_url}&limit=25&access_token=${token}`;
              const thumbRes = await fetch(thumbUrl);
              const thumbData = await thumbRes.json();
              if (thumbData.data) {
                const thumbMap: Record<string, string> = {};
                for (const ad of thumbData.data) {
                  if (ad.creative?.thumbnail_url) thumbMap[ad.id] = ad.creative.thumbnail_url;
                }
                for (const ad of topAdsRaw) {
                  if (thumbMap[ad.id]) ad.thumbnail_url = thumbMap[ad.id];
                }
              }
            } catch { /* thumbnail fetch is optional — don't block on failure */ }
          }
          const topAds = topAdsRaw;

          // Daily breakdown for chart
          const daily = (breakdown.data || []).map((d: any) => ({
            date: d.date_start,
            spend: parseN(d.spend),
            ctr: parseN(d.ctr) / 100,
            clicks: parseN(d.clicks),
            impressions: parseN(d.impressions),
          }));

          const deltaRatio = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;

          results.meta = {
            spend: metaSpend,
            prev_spend: prevSpend,
            ctr: metaCtr,
            prev_ctr: prevCtr,
            clicks: metaClicks,
            prev_clicks: prevClicks,
            impressions: metaImpr,
            reach: metaReach,
            frequency: metaFreq,
            cpm: metaCpm,
            cpc: metaCpc,
            conversions: metaConv,
            conv_value: metaConvVal,
            roas: metaRoas,
            cpa: metaCpa,
            prev_conversions: prevConv,
            prev_conv_value: prevConvVal,
            prev_roas: prevRoas,
            prev_cpa: prevCpa,
            delta_spend: deltaRatio(metaSpend, prevSpend),
            delta_ctr: deltaRatio(metaCtr, prevCtr),
            delta_clicks: deltaRatio(metaClicks, prevClicks),
            delta_conversions: deltaRatio(metaConv, prevConv),
            delta_roas: metaRoas !== null && prevRoas !== null ? deltaRatio(metaRoas, prevRoas) : null,
            // Lower CPA is better, so the delta is the inverse (drop in CPA = positive)
            delta_cpa: metaCpa !== null && prevCpa !== null ? deltaRatio(metaCpa, prevCpa) : null,
            top_ads: topAds,
            daily,
            account_name: acc.name || "Meta Ads",
            account_id: acc.id,
          };
        }
      } catch (e) {
        results.meta = { error: String(e) };
      }
    }

    // Google Ads disabled — see GOOGLE_ADS_BACKUP.md
    // results.google stays null

    // ── Combined totals ───────────────────────────────────────────────────────
    const validPlatforms = [results.meta].filter(p => p && !p.error);
    if (validPlatforms.length > 0) {
      const sum = (k: string) => validPlatforms.reduce((s, p) => s + (p[k] || 0), 0);
      const allAds = validPlatforms.flatMap(p => p.top_ads || [])
        .sort((a, b) => b.spend - a.spend).slice(0, 15);

      // Merge daily breakdowns
      const dailyMap: Record<string, any> = {};
      for (const p of validPlatforms) {
        for (const d of (p.daily || [])) {
          if (!dailyMap[d.date]) dailyMap[d.date] = { date: d.date, spend: 0, clicks: 0, ctr_sum: 0, ctr_count: 0 };
          dailyMap[d.date].spend += d.spend;
          dailyMap[d.date].clicks += d.clicks;
          dailyMap[d.date].ctr_sum += d.ctr;
          dailyMap[d.date].ctr_count++;
        }
      }
      const combinedDaily = Object.values(dailyMap)
        .map((d: any) => ({ date: d.date, spend: d.spend, ctr: d.ctr_count > 0 ? d.ctr_sum / d.ctr_count : 0, clicks: d.clicks }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const totalSpend = sum("spend");
      const prevTotalSpend = sum("prev_spend");
      const totalClicks = sum("clicks");
      const prevTotalClicks = sum("prev_clicks");
      const avgCtr = validPlatforms.reduce((s, p) => s + (p.ctr || 0), 0) / validPlatforms.length;
      const prevAvgCtr = validPlatforms.reduce((s, p) => s + (p.prev_ctr || 0), 0) / validPlatforms.length;
      const totalConv = sum("conversions");
      const totalConvVal = sum("conv_value");
      const prevTotalConv = sum("prev_conversions");
      const prevTotalConvVal = sum("prev_conv_value");
      const combinedRoas = totalSpend > 0 && totalConvVal > 0 ? totalConvVal / totalSpend : null;
      const combinedCpa  = totalConv > 0 ? totalSpend / totalConv : null;
      const prevCombinedRoas = prevTotalSpend > 0 && prevTotalConvVal > 0 ? prevTotalConvVal / prevTotalSpend : null;
      const prevCombinedCpa  = prevTotalConv > 0 ? prevTotalSpend / prevTotalConv : null;

      const deltaRatio = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;

      results.combined = {
        spend: totalSpend,
        ctr: avgCtr,
        clicks: totalClicks,
        conversions: totalConv,
        conv_value: totalConvVal,
        roas: combinedRoas,
        cpa: combinedCpa,
        prev_spend: prevTotalSpend,
        prev_ctr: prevAvgCtr,
        prev_clicks: prevTotalClicks,
        prev_conversions: prevTotalConv,
        prev_conv_value: prevTotalConvVal,
        prev_roas: prevCombinedRoas,
        prev_cpa: prevCombinedCpa,
        delta_spend: deltaRatio(totalSpend, prevTotalSpend),
        delta_ctr: deltaRatio(avgCtr, prevAvgCtr),
        delta_clicks: deltaRatio(totalClicks, prevTotalClicks),
        delta_conversions: deltaRatio(totalConv, prevTotalConv),
        delta_roas: combinedRoas !== null && prevCombinedRoas !== null ? deltaRatio(combinedRoas, prevCombinedRoas) : null,
        delta_cpa: combinedCpa !== null && prevCombinedCpa !== null ? deltaRatio(combinedCpa, prevCombinedCpa) : null,
        top_ads: allAds,
        daily: combinedDaily,
        platforms: validPlatforms.map(p => p.account_name || "").filter(Boolean),
      };
    }

    return ok({ ok: true, period, since, until: today, ...results });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
