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
    const { user_id, persona_id, period = "7d", date_from, date_to } = body;

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
    const googleConn = (allConns || []).find((c: any) => c.platform === "google");

    const results: any = {
      meta: null,
      google: null,
      combined: null,
    };

    // ── META ADS ──────────────────────────────────────────────────────────────
    if (metaConn?.access_token) {
      try {
        const accs = (metaConn.ad_accounts || []) as any[];
        const acc  = (metaConn.selected_account_id && accs.find((a: any) => a.id === metaConn.selected_account_id)) || accs[0];

        if (acc?.id) {
          const token = metaConn.access_token;
          const fields = "spend,impressions,clicks,ctr,cpc,cpm,reach,actions,action_values,website_purchase_roas,date_start";

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

          // Extract conversions from actions
          const getConversions = (d: any) => {
            const actions = d.actions || [];
            const purchases = actions.find((a: any) => a.action_type === "purchase");
            return purchases ? parseN(purchases.value) : 0;
          };
          const getConvValue = (d: any) => {
            const vals = d.action_values || [];
            const purchases = vals.find((a: any) => a.action_type === "purchase");
            return purchases ? parseN(purchases.value) : 0;
          };

          const metaSpend = parseN(c.spend);
          const prevSpend = parseN(p.spend);
          const metaCtr   = parseN(c.ctr) / 100; // Meta returns ctr as percentage string
          const prevCtr   = parseN(p.ctr) / 100;
          const metaClicks = parseN(c.clicks);
          const prevClicks = parseN(p.clicks);
          const metaImpr  = parseN(c.impressions);
          const metaConv  = getConversions(c);
          const metaConvVal = getConvValue(c);
          const metaRoas  = metaSpend > 0 && metaConvVal > 0 ? metaConvVal / metaSpend : null;

          // Top ads — separate request
          const adsFields = "ad_id,ad_name,adset_name,campaign_name,spend,ctr,cpc,impressions,actions,action_values,website_purchase_roas";
          const adsRes = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${adsFields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=10&access_token=${token}`);
          const adsData = await adsRes.json();
          const topAds = (adsData.data || []).map((ad: any) => ({
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
          }));

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
            conversions: metaConv,
            conv_value: metaConvVal,
            roas: metaRoas,
            cpa: metaConv > 0 ? metaSpend / metaConv : null,
            delta_spend: deltaRatio(metaSpend, prevSpend),
            delta_ctr: deltaRatio(metaCtr, prevCtr),
            delta_clicks: deltaRatio(metaClicks, prevClicks),
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

    // ── GOOGLE ADS ────────────────────────────────────────────────────────────
    if (googleConn?.access_token) {
      try {
        const DEV_TOKEN     = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
        const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

        let token = googleConn.access_token;
        // Refresh if expired
        if (googleConn.refresh_token && googleConn.expires_at && new Date(googleConn.expires_at) < new Date()) {
          const rr = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: googleConn.refresh_token, grant_type: "refresh_token" }),
          });
          if (rr.ok) { const rd = await rr.json(); if (rd.access_token) token = rd.access_token; }
        }

        const accs = (googleConn.ad_accounts || []) as any[];
        const acc  = (googleConn.selected_account_id && accs.find((a: any) => a.id === googleConn.selected_account_id)) || accs[0];

        if (acc?.id && DEV_TOKEN) {
          const custId = acc.id.replace(/-/g, "");

          // Build headers — try without login-customer-id first (direct accounts)
          // If API returns HTML (auth error), it means this is an MCC-managed account
          const makeHdr = (withLoginId: boolean) => ({
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "developer-token": DEV_TOKEN,
            ...(withLoginId ? { "login-customer-id": custId } : {}),
          });

          const gQuery = async (query: string): Promise<any> => {
            const url = `https://googleads.googleapis.com/v23/customers/${custId}/googleAds:search`;
            const body = JSON.stringify({ query });
            // First try without login-customer-id
            const r1 = await fetch(url, { method: "POST", headers: makeHdr(false), body });
            const text1 = await r1.text();
            if (!text1.trim().startsWith("<")) return JSON.parse(text1);
            // HTML response = auth/routing issue, retry with login-customer-id
            const r2 = await fetch(url, { method: "POST", headers: makeHdr(true), body });
            const text2 = await r2.text();
            if (!text2.trim().startsWith("<")) return JSON.parse(text2);
            return { results: [], error: "auth_error" };
          };

          const gSince = since.replace(/-/g, "");
          const gToday = today.replace(/-/g, "");
          const gPrevSince = prevSince.replace(/-/g, "");

          const [curr, prev, adsData, dailyData] = await Promise.all([
            gQuery(`SELECT metrics.cost_micros, metrics.clicks, metrics.ctr, metrics.impressions, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}'`),
            gQuery(`SELECT metrics.cost_micros, metrics.clicks, metrics.ctr, metrics.impressions, metrics.conversions FROM customer WHERE segments.date BETWEEN '${prevSince}' AND '${since}'`),
            gQuery(`SELECT ad_group_ad.ad.name, ad_group.name, campaign.name, metrics.cost_micros, metrics.clicks, metrics.ctr, metrics.impressions, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 10`),
            gQuery(`SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.ctr, metrics.impressions FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}' ORDER BY segments.date ASC`),
          ]);

          const sumMetrics = (rows: any[]) => rows.reduce((acc, r) => {
            const m = r.metrics || {};
            return {
              cost: acc.cost + (parseN(m.costMicros) / 1e6),
              clicks: acc.clicks + parseN(m.clicks),
              impressions: acc.impressions + parseN(m.impressions),
              conversions: acc.conversions + parseN(m.conversions),
              conv_value: acc.conv_value + parseN(m.conversionsValue),
            };
          }, { cost: 0, clicks: 0, impressions: 0, conversions: 0, conv_value: 0 });

          const c = sumMetrics(curr.results || []);
          const p = sumMetrics(prev.results || []);

          // Real CTR = clicks / impressions (not average of daily CTR%)
          const avgCtr = c.impressions > 0 ? c.clicks / c.impressions : 0;
          const prevAvgCtr = p.impressions > 0 ? p.clicks / p.impressions : 0;
          const gRoas = c.cost > 0 && c.conv_value > 0 ? c.conv_value / c.cost : null;

          // Debug: capture what API returned
          const debugInfo = {
            customer_id: custId,
            date_range: `${since} to ${today}`,
            curr_rows: curr.results?.length ?? 0,
            curr_error: curr.error,
            cost_raw: c.cost,
            clicks_raw: c.clicks,
          };

          const deltaRatio = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;

          const topAds = (adsData.results || []).map((r: any) => {
            const adSpend = parseN(r.metrics?.costMicros) / 1e6;
            const adConvVal = parseN(r.metrics?.conversionsValue);
            return {
              id: r.adGroupAd?.ad?.id || Math.random().toString(),
              name: r.adGroupAd?.ad?.name || "—",
              campaign: r.campaign?.name || "",
              adset: r.adGroup?.name || "",
              spend: adSpend,
              ctr: parseN(r.metrics?.ctr),
              clicks: parseN(r.metrics?.clicks),
              impressions: parseN(r.metrics?.impressions),
              conversions: parseN(r.metrics?.conversions),
              roas: adSpend > 0 && adConvVal > 0 ? adConvVal / adSpend : null,
              platform: "google",
            };
          });

          // Group daily data by date
          const dailyMap: Record<string, any> = {};
          for (const r of (dailyData.results || [])) {
            const date = r.segments?.date || "";
            if (!dailyMap[date]) dailyMap[date] = { date, spend: 0, clicks: 0, ctr: 0, impressions: 0, count: 0 };
            dailyMap[date].spend += parseN(r.metrics?.costMicros) / 1e6;
            dailyMap[date].clicks += parseN(r.metrics?.clicks);
            dailyMap[date].ctr += parseN(r.metrics?.ctr);
            dailyMap[date].impressions += parseN(r.metrics?.impressions);
            dailyMap[date].count++;
          }
          const daily = Object.values(dailyMap).map((d: any) => ({
            date: d.date,
            spend: d.spend,
            ctr: d.count > 0 ? d.ctr / d.count : 0,
            clicks: d.clicks,
            impressions: d.impressions,
          })).sort((a: any, b: any) => a.date.localeCompare(b.date));

          results.google = {
            spend: c.cost,
            prev_spend: p.cost,
            ctr: avgCtr,
            prev_ctr: prevAvgCtr,
            clicks: c.clicks,
            prev_clicks: p.clicks,
            impressions: c.impressions,
            conversions: c.conversions,
            conv_value: c.conv_value,
            roas: gRoas,
            cpa: c.conversions > 0 ? c.cost / c.conversions : null,
            delta_spend: deltaRatio(c.cost, p.cost),
            delta_ctr: deltaRatio(avgCtr, prevAvgCtr),
            delta_clicks: deltaRatio(c.clicks, p.clicks),
            top_ads: topAds,
            daily,
            account_name: acc.name || "Google Ads",
            account_id: acc.id,
            _debug: debugInfo,
          };
        }
      } catch (e) {
        results.google = { error: String(e) };
      }
    }

    // ── Combined totals ───────────────────────────────────────────────────────
    const validPlatforms = [results.meta, results.google].filter(p => p && !p.error);
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

      const deltaRatio = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : null;

      results.combined = {
        spend: totalSpend,
        ctr: avgCtr,
        clicks: totalClicks,
        conversions: sum("conversions"),
        conv_value: sum("conv_value"),
        roas: totalSpend > 0 && sum("conv_value") > 0 ? sum("conv_value") / totalSpend : null,
        delta_spend: deltaRatio(totalSpend, prevTotalSpend),
        delta_ctr: deltaRatio(avgCtr, prevAvgCtr),
        delta_clicks: deltaRatio(totalClicks, prevTotalClicks),
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
