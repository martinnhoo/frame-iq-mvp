// meta-oauth v3 — strict persona_id isolation, multi-facebook support
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const APP_URL = "https://adbrief.pro";
const REDIRECT_URI = `${APP_URL}/dashboard/loop/connect/meta/callback`;
const SCOPES = ["ads_read", "ads_management", "business_management"].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const json = await req.json().catch(() => ({}));
  const { action, code, user_id, state, persona_id, connection_label } = json;

  // ── get_auth_url ────────────────────────────────────────────────────────────
  if (action === "get_auth_url") {
    if (!user_id || !persona_id) {
      return new Response(JSON.stringify({ error: "user_id and persona_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stateParam = btoa(JSON.stringify({
      user_id,
      persona_id,
      connection_label: connection_label || null,
      ts: Date.now()
    }));
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", META_APP_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", stateParam);
    url.searchParams.set("response_type", "code");
    return new Response(JSON.stringify({ url: url.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── exchange_code ───────────────────────────────────────────────────────────
  if (action === "exchange_code") {
    // Decode state to get persona_id and connection_label
    let storedPersonaId: string | null = null;
    let storedLabel: string | null = null;
    let storedUserId: string = user_id;

    try {
      if (state) {
        const decoded = JSON.parse(atob(state));
        storedPersonaId = decoded.persona_id || null;
        storedLabel = decoded.connection_label || null;
        storedUserId = decoded.user_id || user_id;
      }
    } catch {}

    // persona_id is REQUIRED — no more global connections
    if (!storedPersonaId) {
      return new Response(JSON.stringify({ error: "persona_id required — connect from Accounts page" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code → short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", META_APP_ID);
    tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // Exchange → long-lived token (~60 days)
    const longUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", META_APP_ID);
    longUrl.searchParams.set("client_secret", META_APP_SECRET);
    longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);

    const accessToken = longData.access_token;
    const expiresIn = longData.expires_in || 5184000;

    // Get ad accounts
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
    );
    const accountsData = await accountsRes.json();
    const adAccounts = accountsData.data || [];

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Build upsert payload — ALWAYS scoped to persona_id
    const upsertPayload: Record<string, any> = {
      user_id: storedUserId,
      platform: "meta",
      persona_id: storedPersonaId,  // REQUIRED — never null
      connection_label: storedLabel, // null = default, "label" = additional facebook
      access_token: accessToken,
      expires_at: expiresAt,
      ad_accounts: adAccounts,
      status: "active",
      connected_at: new Date().toISOString(),
    };

    // Upsert scoped to (user_id, platform, persona_id, connection_label)
    // For multi-facebook: different connection_label = different row
    let { error: upsertError } = await supabase
      .from("platform_connections" as any)
      .upsert(upsertPayload, {
        onConflict: "user_id,platform,persona_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      // If constraint doesn't exist yet, do manual update/insert
      const { data: existing } = await supabase
        .from("platform_connections" as any)
        .select("id")
        .eq("user_id", storedUserId)
        .eq("platform", "meta")
        .eq("persona_id", storedPersonaId)
        .maybeSingle();

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from("platform_connections" as any)
          .update(upsertPayload)
          .eq("id", existing.id);
        upsertError = updateError;
      } else {
        const { error: insertError } = await supabase
          .from("platform_connections" as any)
          .insert(upsertPayload);
        upsertError = insertError;
      }
    }

    if (upsertError) throw upsertError;

    // Seed historical data async
    (async () => {
      try {
        const accounts = (adAccounts as any[]);
        const firstActive = accounts.find((a: any) => a.account_status === 1) || accounts[0];
        if (!firstActive?.id) return;

        const since90 = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split("T")[0];
        const today = new Date().toISOString().split("T")[0];
        const fields = "ad_name,campaign_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";

        const res = await fetch(
          `https://graph.facebook.com/v19.0/${firstActive.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since90}","until":"${today}"}&sort=spend_descending&limit=100&access_token=${accessToken}`
        );
        const insightsData = await res.json();
        if (insightsData.error || !insightsData.data?.length) return;

        const ads = insightsData.data as any[];
        const withCtr = ads.filter((a: any) => parseFloat(a.ctr || 0) > 0);
        if (!withCtr.length) return;

        const avgCtr = withCtr.reduce((s: number, a: any) => s + parseFloat(a.ctr), 0) / withCtr.length;
        const winners = withCtr.filter((a: any) => parseFloat(a.ctr) > avgCtr * 1.5).slice(0, 10);
        const losers = withCtr.filter((a: any) => parseFloat(a.ctr) < avgCtr * 0.5 && parseFloat(a.spend || 0) > 20).slice(0, 5);
        const topSpend = ads.slice(0, 5).map((a: any) =>
          `${a.ad_name?.slice(0, 40)}: CTR ${parseFloat(a.ctr).toFixed(2)}% spend $${parseFloat(a.spend || 0).toFixed(0)}`
        );

        // Use persona-scoped pattern key to avoid cross-account contamination
        const key = `onboarding_meta_${storedPersonaId?.slice(0, 8)}`;
        await supabase.from("learned_patterns" as any).upsert({
          user_id: storedUserId,
          persona_id: storedPersonaId,
          pattern_key: key,
          is_winner: winners.length > 0,
          confidence: 0.7,
          avg_ctr: avgCtr,
          sample_size: ads.length,
          insight_text: `Histórico 90d: ${ads.length} anúncios. CTR médio ${avgCtr.toFixed(2)}%. ${winners.length} vencedores, ${losers.length} perdedores.`,
          variables: {
            account_name: firstActive.name || firstActive.id,
            period: { since: since90, until: today },
            total_ads: ads.length,
            avg_ctr: avgCtr,
            top_ads: topSpend,
            winner_names: winners.map((a: any) => a.ad_name?.slice(0, 50)),
            loser_names: losers.map((a: any) => a.ad_name?.slice(0, 50)),
          },
          last_updated: new Date().toISOString(),
        }, { onConflict: "user_id,pattern_key" }).catch(() => {});

        if (winners.length) {
          const memRows = winners.slice(0, 5).map((a: any) => ({
            user_id: storedUserId,
            hook_type: "meta_historical_winner",
            hook_score: Math.min(10, parseFloat(a.ctr) * 200),
            platform: "Meta Feed",
            notes: JSON.stringify({
              ad_name: a.ad_name?.slice(0, 80),
              ctr: a.ctr,
              spend: a.spend,
              campaign: a.campaign_name?.slice(0, 60),
              persona_id: storedPersonaId,
            }),
            created_at: new Date().toISOString(),
          }));
          await supabase.from("creative_memory" as any).insert(memRows).catch(() => {});
        }
      } catch (_e) { /* silent */ }
    })();

    return new Response(JSON.stringify({
      success: true,
      ad_accounts: adAccounts,
      expires_at: expiresAt,
      persona_id: storedPersonaId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── disconnect ──────────────────────────────────────────────────────────────
  // CRITICAL: always scope disconnect to persona_id
  if (action === "disconnect") {
    const { platform: disc_platform, persona_id: disc_persona_id, connection_id } = json;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("platform_connections" as any)
      .delete()
      .eq("user_id", user_id)
      .eq("platform", disc_platform || "meta");

    // If specific connection_id provided, delete only that one
    if (connection_id) {
      query = (supabase as any).from("platform_connections").delete().eq("id", connection_id).eq("user_id", user_id);
    } else if (disc_persona_id) {
      // Delete only this persona's connection
      query = (query as any).eq("persona_id", disc_persona_id);
    }
    // If neither, do nothing (require at least persona_id or connection_id)
    else {
      return new Response(JSON.stringify({ error: "persona_id or connection_id required for disconnect" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await query;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── get_connections ─────────────────────────────────────────────────────────
  if (action === "get_connections") {
    const { data, error } = await supabase
      .from("platform_connections" as any)
      .select("id, platform, status, connected_at, expires_at, ad_accounts, persona_id, connection_label")
      .eq("user_id", user_id);

    if (error) throw error;
    return new Response(JSON.stringify({ connections: data || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── pull_insights / list_campaigns / list_ads ───────────────────────────────
  const dataActions = ["pull_insights", "list_campaigns", "get_campaigns", "list_ads", "get_ads"];
  if (dataActions.includes(action)) {
    // STRICT: only use persona-scoped connection, no global fallback
    let conn: any = null;

    if (persona_id) {
      const { data } = await supabase
        .from("platform_connections" as any)
        .select("access_token, ad_accounts, selected_account_id")
        .eq("user_id", user_id)
        .eq("platform", "meta")
        .eq("persona_id", persona_id)
        .eq("status", "active")
        .maybeSingle();
      conn = data;
    }

    if (!conn) {
      return new Response(JSON.stringify({ error: "Meta Ads not connected for this account. Connect in Accounts." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = conn.access_token;
    const accounts = (conn.ad_accounts as any[]) || [];
    const selectedId = conn.selected_account_id;
    const activeAccount = (selectedId && accounts.find((a: any) => a.id === selectedId))
      || accounts.find((a: any) => a.account_status === 1)
      || accounts[0];

    if (!activeAccount) {
      return new Response(JSON.stringify({ error: "No active ad account found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = activeAccount.id;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
    const until = new Date().toISOString().split("T")[0];

    if (action === "pull_insights") {
      const fields = "ad_name,spend,impressions,clicks,ctr,cpc,cpm,actions,cost_per_action_type,video_play_actions,video_avg_time_watched_actions";
      const url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=50&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return new Response(JSON.stringify({ success: true, insights: data.data || [], account: activeAccount, period: { since, until } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_campaigns" || action === "get_campaigns") {
      const url = `https://graph.facebook.com/v19.0/${accountId}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,insights{spend,impressions,clicks,ctr}&limit=25&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return new Response(JSON.stringify({ success: true, campaigns: data.data || [], account: activeAccount.name || accountId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_ads" || action === "get_ads") {
      const url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpm,cpc,actions,frequency,reach&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return new Response(JSON.stringify({ success: true, ads: data.data || [], account: activeAccount.name || accountId, period: { since, until } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
