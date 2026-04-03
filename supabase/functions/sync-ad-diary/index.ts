// sync-ad-diary v2 — Meta + Google, sem isUserAuthorized (service_role)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function calcVerdict(ad: { ctr: number; spend: number; roas: number | null; frequency: number; status: string }): { verdict: string; reason: string } {
  const { ctr, spend, roas, frequency, status } = ad;
  const st = status?.toLowerCase() || "";
  if (st === "paused" || st === "archived" || st === "deleted") {
    if (roas && roas >= 2.5) return { verdict: "loser", reason: `Pausado com ROAS ${roas.toFixed(1)}×` };
    if (frequency > 3.5) return { verdict: "loser", reason: `Fadiga — frequência ${frequency.toFixed(1)}×` };
    if (ctr < 0.008 && spend > 30) return { verdict: "loser", reason: `CTR ${(ctr*100).toFixed(2)}% abaixo do mínimo` };
    return { verdict: "loser", reason: "Pausado manualmente" };
  }
  if (roas && roas >= 4)  return { verdict: "winner", reason: `ROAS ${roas.toFixed(2)}× — escalar imediatamente` };
  if (roas && roas >= 2.5 && spend > 200) return { verdict: "scaled", reason: `ROAS ${roas.toFixed(2)}× com volume` };
  if (ctr >= 0.025 && spend > 50) return { verdict: "winner", reason: `CTR ${(ctr*100).toFixed(2)}% — criativo forte` };
  if (ctr >= 0.015 && spend > 100) return { verdict: "scaled", reason: `CTR ${(ctr*100).toFixed(2)}% consistente` };
  if (spend < 30) return { verdict: "testing", reason: `$${spend.toFixed(0)} gasto — em aprendizado` };
  if (roas && roas < 1) return { verdict: "loser", reason: `ROAS ${roas.toFixed(2)}× — pausar e revisar` };
  if (ctr < 0.007 && spend > 50) return { verdict: "loser", reason: `CTR ${(ctr*100).toFixed(2)}% — criativo fraco` };
  return { verdict: "testing", reason: "Aguardando mais dados para classificar" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const ok = (d: object, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { user_id, persona_id } = await req.json().catch(() => ({}));

    if (!user_id || !persona_id) return ok({ error: "user_id e persona_id obrigatórios" }, 400);

    console.log("[sync-ad-diary] user:", user_id, "persona:", persona_id);

    const { data: conns, error: connErr } = await sb
      .from("platform_connections" as any)
      .select("platform, access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
      .eq("user_id", user_id).eq("persona_id", persona_id).eq("status", "active");

    if (connErr) return ok({ error: connErr.message }, 500);
    if (!conns?.length) return ok({ synced: 0, message: "Nenhuma plataforma conectada" });

    console.log("[sync-ad-diary] connections:", conns.map((c: any) => c.platform).join(", "));

    const since = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    let totalSynced = 0;
    const errors: string[] = [];

    for (const conn of conns as any[]) {

      // ── META ───────────────────────────────────────────────────────────────
      if (conn.platform === "meta" && conn.access_token) {
        try {
          const accs = (conn.ad_accounts || []) as any[];
          const acc = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
          if (!acc?.id) { errors.push("Meta: conta de anúncios não configurada"); continue; }

          console.log("[sync-ad-diary] Meta account:", acc.id);
          const fields = "id,name,status,adset{name},campaign{name},created_time,updated_time,insights.date_preset(last_90_days){spend,impressions,clicks,ctr,cpc,actions,action_values,frequency}";
          // effective_status: Meta only returns ACTIVE by default — must explicitly include PAUSED/ARCHIVED
          const res = await fetch(`https://graph.facebook.com/v21.0/${acc.id}/ads?fields=${encodeURIComponent(fields)}&effective_status=[%22ACTIVE%22,%22PAUSED%22,%22ARCHIVED%22]&limit=200&access_token=${conn.access_token}`);
          if (!res.ok) { errors.push(`Meta HTTP ${res.status}`); continue; }

          const j = await res.json();
          console.log("[sync-ad-diary] Meta raw ads:", j.data?.length ?? 0, j.error?.message || "ok");
          if (j.error) { errors.push(`Meta API: ${j.error.message} (code ${j.error.code})`); continue; }
          if (!j.data?.length) { errors.push(`Meta: API retornou 0 ads (conta: ${acc.id})`); continue; }

          const rows = (j.data || []).map((ad: any) => {
            const ins = ad.insights?.data?.[0] || {};
            const spend = parseFloat(ins.spend || "0");
            const rawCtr = parseFloat(ins.ctr || "0");
            const ctr = rawCtr > 1 ? rawCtr / 100 : rawCtr; // Meta returns % sometimes
            const cpc = parseFloat(ins.cpc || "0");
            const freq = parseFloat(ins.frequency || "0");
            const conv = parseFloat((ins.actions || []).find((a: any) => a.action_type === "purchase")?.value || "0");
            const convVal = parseFloat((ins.action_values || []).find((a: any) => a.action_type === "purchase")?.value || "0");
            const roas = spend > 0 && convVal > 0 ? convVal / spend : null;
            const status = ad.status?.toLowerCase() || "unknown";
            const launched = ad.created_time?.split("T")[0] || null;
            const paused = (status === "paused" || status === "archived") ? ad.updated_time?.split("T")[0] : null;
            const days = launched ? Math.round((Date.now() - new Date(launched).getTime()) / 86400000) : 0;
            const verd = calcVerdict({ ctr, spend, roas, frequency: freq, status: ad.status });
            return { user_id, persona_id, platform: "meta", ad_id: ad.id, ad_name: ad.name || "Sem nome",
              campaign_name: ad.campaign?.name || null, adset_name: ad.adset?.name || null,
              status, launched_at: launched, paused_at: paused, days_running: days,
              spend, impressions: parseInt(ins.impressions || "0"), clicks: parseInt(ins.clicks || "0"),
              ctr, cpc, conversions: conv, conv_value: convVal, roas, frequency: freq,
              verdict: verd.verdict, verdict_reason: verd.reason,
              peak_ctr: ctr, synced_at: new Date().toISOString() };
          });

          if (rows.length) {
            const { error: e } = await sb.from("ad_diary" as any).upsert(rows, { onConflict: "user_id,persona_id,platform,ad_id" });
            if (e) errors.push("Meta save: " + e.message);
            else { totalSynced += rows.length; console.log("[sync-ad-diary] Meta saved:", rows.length); }
          }
        } catch (e) { errors.push("Meta: " + String(e).slice(0, 100)); }
      }

      // ── GOOGLE ─────────────────────────────────────────────────────────────
      if (conn.platform === "google" && conn.access_token) {
        try {
          const DEV_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "";
          const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
          const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
          if (!DEV_TOKEN) { errors.push("Google: DEVELOPER_TOKEN não configurado"); continue; }

          let token = conn.access_token;
          if (conn.refresh_token && conn.expires_at && new Date(conn.expires_at) < new Date(Date.now() + 120000)) {
            const rr = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: "refresh_token" }),
            });
            if (rr.ok) { const rd = await rr.json(); if (rd.access_token) token = rd.access_token; }
          }

          const accs = (conn.ad_accounts || []) as any[];
          const acc = (conn.selected_account_id && accs.find((a: any) => a.id === conn.selected_account_id)) || accs[0];
          if (!acc?.id) { errors.push("Google: Customer ID não configurado — adicione em Contas"); continue; }

          const custId = acc.id.replace(/-/g, "");
          console.log("[sync-ad-diary] Google customer:", custId);

          const gSearch = async (query: string) => {
            const h: Record<string, string> = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "developer-token": DEV_TOKEN };
            const r = await fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, { method: "POST", headers: h, body: JSON.stringify({ query }) });
            const txt = await r.text();
            if (txt.trim().startsWith("<")) { h["login-customer-id"] = custId; const r2 = await fetch(`https://googleads.googleapis.com/v19/customers/${custId}/googleAds:search`, { method: "POST", headers: h, body: JSON.stringify({ query }) }); const t2 = await r2.text(); return t2.trim().startsWith("<") ? { results: [] } : JSON.parse(t2); }
            return JSON.parse(txt);
          };

          const data = await gSearch(`SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status, ad_group.name, campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status != 'REMOVED' AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 200`);

          if (data.error) { errors.push(`Google: ${data.error?.message || JSON.stringify(data.error).slice(0,100)}`); continue; }

          const gRows = (data.results || []).map((r: any) => {
            const ad = r.adGroupAd?.ad || {};
            const m = r.metrics || {};
            const spend = parseFloat(m.costMicros || "0") / 1e6;
            const ctr = parseFloat(m.ctr || "0");
            const cpc = parseFloat(m.averageCpc || "0") / 1e6;
            const conv = parseFloat(m.conversions || "0");
            const convVal = parseFloat(m.conversionsValue || "0");
            const roas = spend > 0 && convVal > 0 ? convVal / spend : null;
            const status = (r.adGroupAd?.status || "UNKNOWN").toLowerCase().replace("enabled", "active");
            const verd = calcVerdict({ ctr, spend, roas, frequency: 0, status: r.adGroupAd?.status });
            return { user_id, persona_id, platform: "google", ad_id: String(ad.id || `g${Math.random()}`),
              ad_name: ad.name || ad.type || "Google Ad", campaign_name: r.campaign?.name || null,
              adset_name: r.adGroup?.name || null, status, launched_at: null, paused_at: null,
              days_running: 0, spend, impressions: parseInt(m.impressions || "0"),
              clicks: parseInt(m.clicks || "0"), ctr, cpc, conversions: conv, conv_value: convVal,
              roas, frequency: null, verdict: verd.verdict, verdict_reason: verd.reason,
              peak_ctr: ctr, synced_at: new Date().toISOString() };
          });

          if (gRows.length) {
            const { error: e } = await sb.from("ad_diary" as any).upsert(gRows, { onConflict: "user_id,persona_id,platform,ad_id" });
            if (e) errors.push("Google save: " + e.message);
            else { totalSynced += gRows.length; console.log("[sync-ad-diary] Google saved:", gRows.length); }
          }
        } catch (e) { errors.push("Google: " + String(e).slice(0, 100)); }
      }
    }

    console.log("[sync-ad-diary] total:", totalSynced, "errors:", errors);
    return ok({ ok: true, synced: totalSynced, errors: errors.length ? errors : undefined, debug: `Meta ads fetched, saved: ${totalSynced}`,
      message: totalSynced > 0 ? `${totalSynced} anúncios sincronizados` : errors.length ? "Erros: " + errors[0] : "Nenhum anúncio encontrado" });

  } catch (e: any) {
    console.error("[sync-ad-diary] fatal:", e.message);
    return ok({ error: e.message }, 500);
  }
});
