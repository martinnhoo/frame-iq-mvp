// sync-ad-diary — pulls all ads from Meta + Google and upserts into ad_diary
import { createClient } from "npm:@supabase/supabase-js@2";
import { isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verdict(ad: any): { verdict: string; reason: string } {
  const ctr = ad.ctr || 0;
  const spend = ad.spend || 0;
  const roas = ad.roas;
  const freq = ad.frequency || 0;
  const status = ad.status;

  if (status === "PAUSED" || status === "paused") {
    if (freq > 3.5) return { verdict: "loser", reason: `Frequência ${freq.toFixed(1)}× — fadiga criativa` };
    if (ctr < 0.008 && spend > 20) return { verdict: "loser", reason: `CTR ${(ctr*100).toFixed(2)}% abaixo do mínimo` };
    return { verdict: "loser", reason: "Pausado manualmente" };
  }
  if (roas && roas >= 3) return { verdict: "winner", reason: `ROAS ${roas.toFixed(1)}× — retorno sólido` };
  if (ctr >= 0.025) return { verdict: "winner", reason: `CTR ${(ctr*100).toFixed(2)}% — criativo forte` };
  if (ctr >= 0.015 && spend > 50) return { verdict: "scaled", reason: `CTR ${(ctr*100).toFixed(2)}% com volume` };
  if (spend < 20) return { verdict: "testing", reason: "Em fase de aprendizado" };
  if (ctr < 0.008) return { verdict: "loser", reason: `CTR ${(ctr*100).toFixed(2)}% — baixa performance` };
  return { verdict: "testing", reason: "Dados insuficientes para classificar" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const ok = (d: object) => new Response(JSON.stringify(d), { headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { user_id, persona_id } = await req.json();

    if (!await isUserAuthorized(req, sbAuth, user_id)) return unauthorizedResponse(cors);

    const { data: conns } = await sb.from("platform_connections" as any)
      .select("platform, access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
      .eq("user_id", user_id).eq("persona_id", persona_id).eq("status", "active");

    if (!conns?.length) return ok({ synced: 0 });

    const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    let totalSynced = 0;

    for (const conn of conns) {
      // ── META ───────────────────────────────────────────────────────────────
      if (conn.platform === "meta" && conn.access_token) {
        const token = conn.access_token;
        const accs = (conn.ad_accounts || []) as any[];
        const acc = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
        if (!acc?.id) continue;

        const insFields = "ad_id,ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpc,actions,action_values,frequency";
        const adsRes = await fetch(
          `https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${insFields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=200&access_token=${token}`
        );
        if (!adsRes.ok) continue;
        const adsData = await adsRes.json();
        const ads = (adsData.data || []).map((ins: any) => ({
          id: ins.ad_id, name: ins.ad_name,
          campaign: { name: ins.campaign_name },
          adset: { name: ins.adset_name },
          status: "paused",
          created_time: null, updated_time: null,
          insights: { data: [ins] }
        }));

        const rows = ads.map((ad: any) => {
          const ins = ad.insights?.data?.[0] || {};
          const spend = parseFloat(ins.spend || "0");
          const ctr = parseFloat(ins.ctr || "0") / 100;
          const cpc = parseFloat(ins.cpc || "0");
          const impressions = parseInt(ins.impressions || "0");
          const clicks = parseInt(ins.clicks || "0");
          const freq = parseFloat(ins.frequency || "0");
          const conv = (ins.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0;
          const convVal = (ins.action_values || []).find((a: any) => a.action_type === "purchase")?.value || 0;
          const roas = spend > 0 && parseFloat(convVal) > 0 ? parseFloat(convVal) / spend : null;
          const status = ad.status?.toLowerCase() || "unknown";
          const launched = ad.created_time?.split("T")[0] || null;
          const paused = (status === "paused" || status === "archived") ? ad.updated_time?.split("T")[0] : null;
          const days = launched ? Math.round((Date.now() - new Date(launched).getTime()) / 86400000) : 0;
          const verd = verdict({ ctr, spend, roas, frequency: freq, status: ad.status });

          return {
            user_id, persona_id, platform: "meta",
            ad_id: ad.id, ad_name: ad.name,
            campaign_name: ad.campaign?.name || null,
            adset_name: ad.adset?.name || null,
            status, launched_at: launched, paused_at: paused,
            days_running: days, spend, impressions, clicks, ctr, cpc,
            conversions: parseFloat(String(conv)), conv_value: parseFloat(String(convVal)),
            roas, frequency: freq,
            verdict: verd.verdict, verdict_reason: verd.reason,
            peak_ctr: ctr, synced_at: new Date().toISOString(),
          };
        });

        if (rows.length) {
          await sb.from("ad_diary" as any).upsert(rows, { onConflict: "user_id,persona_id,platform,ad_id" });
          totalSynced += rows.length;
        }
      }

      // ── GOOGLE ─────────────────────────────────────────────────────────────
      if (conn.platform === "google" && conn.access_token) {
        const DEV_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
        const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
        const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
        if (!DEV_TOKEN) continue;

        let token = conn.access_token;
        if (conn.refresh_token && conn.expires_at && new Date(conn.expires_at) < new Date(Date.now() + 60000)) {
          const rr = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
          });
          if (rr.ok) { const rd = await rr.json(); if (rd.access_token) token = rd.access_token; }
        }

        const accs = (conn.ad_accounts || []) as any[];
        const acc = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
        if (!acc?.id) continue;
        const custId = acc.id.replace(/-/g, "");

        const gQuery = async (query: string) => {
          const hdr: Record<string, string> = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "developer-token": DEV_TOKEN };
          const r = await fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, { method: "POST", headers: hdr, body: JSON.stringify({ query }) });
          const text = await r.text();
          if (text.trim().startsWith("<")) {
            hdr["login-customer-id"] = custId;
            const r2 = await fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, { method: "POST", headers: hdr, body: JSON.stringify({ query }) });
            const t2 = await r2.text();
            return t2.trim().startsWith("<") ? { results: [] } : JSON.parse(t2);
          }
          return JSON.parse(text);
        };

        const data = await gQuery(
          `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
            ad_group.name, campaign.name,
            metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
            metrics.average_cpc, metrics.conversions, metrics.conversions_value
          FROM ad_group_ad
          WHERE segments.date BETWEEN '${since}' AND '${today}'
          AND ad_group_ad.status != 'REMOVED'
          ORDER BY metrics.cost_micros DESC LIMIT 200`
        );

        const gRows = (data.results || []).map((r: any) => {
          const ad = r.adGroupAd?.ad || {};
          const m = r.metrics || {};
          const spend = (parseFloat(m.costMicros || "0")) / 1e6;
          const ctr = parseFloat(m.ctr || "0");
          const cpc = (parseFloat(m.averageCpc || "0")) / 1e6;
          const conv = parseFloat(m.conversions || "0");
          const convVal = parseFloat(m.conversionsValue || "0");
          const roas = spend > 0 && convVal > 0 ? convVal / spend : null;
          const status = (r.adGroupAd?.status || "UNKNOWN").toLowerCase();
          const verd = verdict({ ctr, spend, roas, frequency: 0, status: r.adGroupAd?.status });

          return {
            user_id, persona_id, platform: "google",
            ad_id: ad.id || `g_${Math.random()}`,
            ad_name: ad.name || ad.type || "Google Ad",
            campaign_name: r.campaign?.name || null,
            adset_name: r.adGroup?.name || null,
            status, launched_at: null, paused_at: null,
            days_running: 0, spend,
            impressions: parseInt(m.impressions || "0"),
            clicks: parseInt(m.clicks || "0"),
            ctr, cpc, conversions: conv, conv_value: convVal, roas,
            frequency: null,
            verdict: verd.verdict, verdict_reason: verd.reason,
            peak_ctr: ctr, synced_at: new Date().toISOString(),
          };
        });

        if (gRows.length) {
          await sb.from("ad_diary" as any).upsert(gRows, { onConflict: "user_id,persona_id,platform,ad_id" });
          totalSynced += gRows.length;
        }
      }
    }

    return ok({ ok: true, synced: totalSynced });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

// force-redeploy 2026-04-03T20:00:00Z
