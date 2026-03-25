// live-panel v1 — fetches real-time Meta + Google Ads data for dashboard panel
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { user_id, persona_id, platforms } = body;

    if (!user_id || !persona_id) {
      return new Response(JSON.stringify({ error: "Missing user_id or persona_id" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const result: Record<string, any> = {};
    const today = new Date().toISOString().split("T")[0];
    const since = new Date(Date.now() - 14 * 24 * 3600000).toISOString().split("T")[0];

    // ── META ADS ──────────────────────────────────────────────────────────────
    if (platforms?.includes("meta")) {
      const { data: metaConn } = await supabase
        .from("platform_connections" as any)
        .select("access_token, ad_accounts, selected_account_id")
        .eq("user_id", user_id)
        .eq("persona_id", persona_id)
        .eq("platform", "meta")
        .eq("status", "active")
        .maybeSingle();

      if (metaConn?.access_token) {
        const token = metaConn.access_token;
        const adAccounts = metaConn.ad_accounts || [];
        const selectedId = metaConn.selected_account_id;
        const account = adAccounts.find((a: any) => a.id === selectedId) || adAccounts[0];

        if (account) {
          const accId = account.id;
          const fields = "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";

          const [adsRes, campsRes, timeRes] = await Promise.allSettled([
            fetch(`https://graph.facebook.com/v19.0/${accId}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=30&access_token=${token}`),
            fetch(`https://graph.facebook.com/v19.0/${accId}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=20&access_token=${token}`),
            fetch(`https://graph.facebook.com/v19.0/${accId}/insights?fields=spend,impressions,clicks,ctr,cpm&time_range={"since":"${since}","until":"${today}"}&time_increment=1&limit=14&access_token=${token}`),
          ]);

          const ads    = adsRes.status   === "fulfilled" ? await adsRes.value.json()   : null;
          const camps  = campsRes.status === "fulfilled" ? await campsRes.value.json() : null;
          const series = timeRes.status  === "fulfilled" ? await timeRes.value.json()  : null;

          // Handle token expiry
          if (ads?.error?.code === 190 || camps?.error?.code === 190) {
            result.meta = { error: "token_expired", account_name: account.name || accId };
          } else {
            // Compute KPIs
            const adsData: any[] = ads?.data || [];
            const totalSpend = adsData.reduce((s: number, a: any) => s + parseFloat(a.spend || 0), 0);
            const totalImpr  = adsData.reduce((s: number, a: any) => s + parseInt(a.impressions || 0), 0);
            const totalClicks = adsData.reduce((s: number, a: any) => s + parseInt(a.clicks || 0), 0);
            const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr * 100) : 0;
            const avgCPM = totalImpr > 0 ? (totalSpend / totalImpr * 1000) : 0;
            const avgFreq = adsData.length > 0
              ? adsData.reduce((s: number, a: any) => s + parseFloat(a.frequency || 0), 0) / adsData.length
              : 0;
            const totalConversions = adsData.reduce((s: number, a: any) => {
              const purch = a.actions?.find((x: any) => x.action_type === "purchase")?.value || 0;
              const lead  = a.actions?.find((x: any) => x.action_type === "lead")?.value || 0;
              return s + parseFloat(purch) + parseFloat(lead);
            }, 0);

            // Winners — top 5 by ROAS or by CTR
            const adsWithMetrics = adsData.map((a: any) => {
              const spend = parseFloat(a.spend || 0);
              const conv  = parseFloat(a.actions?.find((x: any) => x.action_type === "purchase")?.value || a.actions?.find((x: any) => x.action_type === "lead")?.value || 0);
              const ctr   = parseFloat(a.ctr || 0);
              const freq  = parseFloat(a.frequency || 0);
              const hookRate = (() => {
                const plays = a.video_play_actions?.find((x: any) => x.action_type === "video_play")?.value;
                const impr  = parseInt(a.impressions || 0);
                return plays && impr ? parseFloat(plays) / impr * 100 : null;
              })();
              const roas = spend > 0 && conv > 0 ? (conv * 50) / spend : 0; // estimate if no revenue
              const isRisk = freq > 3.5 || (ctr < 0.5 && spend > 20);
              const isWinner = ctr > 1.5 && freq < 3 && spend > 5;
              return { name: a.ad_name, campaign: a.campaign_name, spend, ctr, cpm: parseFloat(a.cpm || 0), freq, hookRate, conv, roas, isRisk, isWinner };
            }).sort((a: any, b: any) => b.spend - a.spend);

            // Time series
            const timeSeries = (series?.data || [])
              .filter((d: any) => parseFloat(d.spend || 0) > 0)
              .map((d: any) => ({
                date: d.date_start,
                spend: parseFloat(d.spend || 0),
                ctr: parseFloat(d.ctr || 0) * 100,
                cpm: parseFloat(d.cpm || 0),
                clicks: parseInt(d.clicks || 0),
              }));

            // Campaigns
            const campaigns = (camps?.data || []).slice(0, 10).map((c: any) => ({
              name: c.name,
              status: c.effective_status || c.status,
              budget: c.daily_budget
                ? `R$${(parseInt(c.daily_budget) / 100).toFixed(0)}/dia`
                : c.lifetime_budget
                ? `R$${(parseInt(c.lifetime_budget) / 100).toFixed(0)} total`
                : "—",
              objective: c.objective,
            }));

            result.meta = {
              account_name: account.name || accId,
              period: `${since} → ${today}`,
              kpis: {
                spend: totalSpend.toFixed(2),
                ctr: avgCTR.toFixed(2),
                cpm: avgCPM.toFixed(2),
                frequency: avgFreq.toFixed(1),
                conversions: totalConversions.toFixed(0),
                active_ads: adsData.length,
              },
              winners: adsWithMetrics.filter((a: any) => a.isWinner).slice(0, 5),
              at_risk: adsWithMetrics.filter((a: any) => a.isRisk).slice(0, 5),
              top_ads: adsWithMetrics.slice(0, 10),
              campaigns,
              time_series: timeSeries,
            };
          }
        } else {
          result.meta = { error: "no_account_selected" };
        }
      } else {
        result.meta = { error: "not_connected" };
      }
    }

    // ── GOOGLE ADS ────────────────────────────────────────────────────────────
    if (platforms?.includes("google")) {
      const { data: gConn } = await supabase
        .from("platform_connections" as any)
        .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
        .eq("user_id", user_id)
        .eq("persona_id", persona_id)
        .eq("platform", "google")
        .eq("status", "active")
        .maybeSingle();

      if (gConn?.access_token) {
        let token = gConn.access_token;

        // Refresh token if expired
        if (gConn.expires_at && new Date(gConn.expires_at) < new Date()) {
          const rr = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
              client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
              refresh_token: gConn.refresh_token ?? "",
              grant_type: "refresh_token",
            }),
          });
          const rd = await rr.json();
          if (rd.access_token) {
            token = rd.access_token;
            await supabase.from("platform_connections" as any).update({
              access_token: token,
              expires_at: new Date(Date.now() + (rd.expires_in || 3600) * 1000).toISOString(),
            }).eq("user_id", user_id).eq("persona_id", persona_id).eq("platform", "google");
          }
        }

        const adAccounts = gConn.ad_accounts || [];
        const selectedId = gConn.selected_account_id;
        const account = adAccounts.find((a: any) => a.id === selectedId) || adAccounts[0];

        if (account) {
          const custId = account.id.replace(/-/g, "");
          const gHeaders = {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "developer-token": Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "",
            "login-customer-id": custId,
          };

          const gQuery = (query: string) =>
            fetch(`https://googleads.googleapis.com/v17/customers/${custId}/googleAds:search`, {
              method: "POST", headers: gHeaders, body: JSON.stringify({ query }),
            }).then(r => r.json());

          const [campsRes, adsRes, timeRes] = await Promise.allSettled([
            gQuery(`SELECT campaign.name, campaign.status, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${today}' AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`),
            gQuery(`SELECT ad_group_ad.ad.name, ad_group_ad.ad.type, campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`),
            gQuery(`SELECT segments.date, metrics.impressions, metrics.clicks, metrics.ctr, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}' ORDER BY segments.date ASC LIMIT 14`),
          ]);

          const parse = (r: any) => r.status === "fulfilled" ? (r.value?.results || []) : [];
          const camps = parse(campsRes);
          const gAds  = parse(adsRes);
          const gTime = parse(timeRes);

          const totalSpend = camps.reduce((s: number, r: any) => s + ((r.metrics?.costMicros || 0) / 1e6), 0);
          const totalConv  = camps.reduce((s: number, r: any) => s + (r.metrics?.conversions || 0), 0);
          const totalClicks = camps.reduce((s: number, r: any) => s + (r.metrics?.clicks || 0), 0);
          const totalImpr   = camps.reduce((s: number, r: any) => s + (r.metrics?.impressions || 0), 0);
          const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr * 100) : 0;
          const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks) : 0;

          result.google = {
            account_name: account.name || custId,
            period: `${since} → ${today}`,
            kpis: {
              spend: totalSpend.toFixed(2),
              ctr: avgCTR.toFixed(2),
              cpc: avgCPC.toFixed(2),
              conversions: totalConv.toFixed(0),
              impressions: totalImpr.toLocaleString(),
              active_campaigns: camps.length,
            },
            campaigns: camps.slice(0, 10).map((r: any) => ({
              name: r.campaign?.name || "—",
              status: r.campaign?.status || "—",
              type: r.campaign?.advertisingChannelType || "—",
              spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
              ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
              cpc: ((r.metrics?.averageCpc || 0) / 1e6).toFixed(2),
              conversions: (r.metrics?.conversions || 0).toFixed(1),
            })),
            top_ads: gAds.slice(0, 10).map((r: any) => ({
              name: r.adGroupAd?.ad?.name || "Ad",
              type: r.adGroupAd?.ad?.type || "—",
              campaign: r.campaign?.name || "—",
              spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
              ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
              conversions: (r.metrics?.conversions || 0).toFixed(1),
            })),
            time_series: gTime.map((r: any) => ({
              date: r.segments?.date,
              spend: ((r.metrics?.costMicros || 0) / 1e6),
              ctr: (r.metrics?.ctr || 0) * 100,
              conversions: r.metrics?.conversions || 0,
            })).filter((d: any) => d.spend > 0),
          };
        } else {
          result.google = { error: "no_account_selected" };
        }
      } else {
        result.google = { error: "not_connected" };
      }
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("live-panel error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
