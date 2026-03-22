// meta-oauth v2 — persona_id scoped pull_insights
// meta-oauth edge function — v2 — redirect_uri uses adbrief.pro (no www)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta OAuth config
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
// Always use non-www URL — www.adbrief.pro has SSL cipher mismatch with Facebook OAuth
const APP_URL = "https://adbrief.pro";
const REDIRECT_URI = `${APP_URL}/dashboard/loop/connect/meta/callback`;

// Scopes needed: read ad accounts and insights
const SCOPES = [
  "ads_read",
  "ads_management", 
  "business_management",
].join(",");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action, code, user_id, state, persona_id } = await req.json();

    // ── Action: get_auth_url ──────────────────────────────────────────────────
    if (action === "get_auth_url") {
      // state encodes user_id and optional persona_id
      const stateParam = btoa(JSON.stringify({ user_id, persona_id: persona_id || null, ts: Date.now() }));
      
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

    // ── Action: exchange_code ─────────────────────────────────────────────────
    if (action === "exchange_code") {
      // Exchange code for short-lived token
      const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", META_APP_ID);
      tokenUrl.searchParams.set("client_secret", META_APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      tokenUrl.searchParams.set("code", code);

      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = await tokenRes.json();

      if (tokenData.error) throw new Error(tokenData.error.message);

      // Exchange for long-lived token (~60 days)
      const longUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      longUrl.searchParams.set("grant_type", "fb_exchange_token");
      longUrl.searchParams.set("client_id", META_APP_ID);
      longUrl.searchParams.set("client_secret", META_APP_SECRET);
      longUrl.searchParams.set("fb_exchange_token", tokenData.access_token);

      const longRes = await fetch(longUrl.toString());
      const longData = await longRes.json();
      if (longData.error) throw new Error(longData.error.message);

      const accessToken = longData.access_token;
      const expiresIn = longData.expires_in || 5184000; // 60 days default

      // Get user's ad accounts
      const accountsRes = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${accessToken}`
      );
      const accountsData = await accountsRes.json();
      const adAccounts = accountsData.data || [];

      // Store connection in Supabase — scoped per user + platform + persona_id
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      
      // Decode persona_id from state if present
      let storedPersonaId: string | null = null;
      try {
        if (state) {
          const decoded = JSON.parse(atob(state));
          storedPersonaId = decoded.persona_id || null;
        }
      } catch {}

      const upsertPayload: Record<string, any> = {
        user_id,
        platform: "meta",
        persona_id: storedPersonaId, // always include — null means "global user connection"
        access_token: accessToken,
        expires_at: expiresAt,
        ad_accounts: adAccounts,
        status: "active",
        connected_at: new Date().toISOString(),
      };
      
      // Try upsert with persona_id isolation first
      // onConflict: user_id,platform,persona_id — each account gets its own row
      let { error: upsertError } = await supabase
        .from("platform_connections" as any)
        .upsert(upsertPayload, { onConflict: "user_id,platform,persona_id" });

      // Fallback to old constraint if new one doesn't exist yet
      if (upsertError?.code === "23505" || upsertError?.message?.includes("unique")) {
        const fallback = await supabase
          .from("platform_connections" as any)
          .upsert(upsertPayload, { onConflict: "user_id,platform" });
        upsertError = fallback.error;
      }

      if (upsertError) throw upsertError;

      // ── Initial learning — fire-and-forget after connecting ───────────────
      // Pull last 90 days of ad performance to seed learned_patterns immediately
      // This runs async — doesn't block the OAuth response
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

          // Identify winners and losers
          const withCtr = ads.filter((a: any) => parseFloat(a.ctr || 0) > 0);
          if (!withCtr.length) return;

          const avgCtr = withCtr.reduce((s: number, a: any) => s + parseFloat(a.ctr), 0) / withCtr.length;
          const winners = withCtr.filter((a: any) => parseFloat(a.ctr) > avgCtr * 1.5).slice(0, 10);
          const losers  = withCtr.filter((a: any) => parseFloat(a.ctr) < avgCtr * 0.5 && parseFloat(a.spend || 0) > 20).slice(0, 5);

          // Build pattern summary
          const topSpend = ads.slice(0, 5).map((a: any) =>
            `${a.ad_name?.slice(0, 40)}: CTR ${parseFloat(a.ctr).toFixed(2)}% spend $${parseFloat(a.spend||0).toFixed(0)}`
          );

          // Save as a single onboarding pattern
          const key = "onboarding_meta_historical";
          await supabase.from("learned_patterns" as any).upsert({
            user_id,
            pattern_key: key,
            is_winner: winners.length > 0,
            confidence: 0.7,
            avg_ctr: avgCtr,
            sample_size: ads.length,
            insight_text: `Histórico 90d: ${ads.length} anúncios analisados. CTR médio ${(avgCtr).toFixed(2)}%. ${winners.length} vencedores, ${losers.length} perdedores identificados.`,
            variables: {
              account_name: firstActive.name || firstActive.id,
              period: { since: since90, until: today },
              total_ads: ads.length,
              avg_ctr: avgCtr,
              top_ads: topSpend,
              winner_names: winners.map((a: any) => a.ad_name?.slice(0, 50)),
              loser_names: losers.map((a: any) => a.ad_name?.slice(0, 50)),
              winner_avg_ctr: winners.length ? winners.reduce((s: number, a: any) => s + parseFloat(a.ctr), 0) / winners.length : null,
            },
            last_updated: new Date().toISOString(),
          }, { onConflict: "user_id,pattern_key" }).catch(() => {});

          // Also seed creative_memory with top winners
          if (winners.length) {
            const memRows = winners.slice(0, 5).map((a: any) => ({
              user_id,
              hook_type: "meta_historical_winner",
              hook_score: Math.min(10, parseFloat(a.ctr) * 200), // CTR 5% = score 10
              platform: "Meta Feed",
              notes: JSON.stringify({
                ad_name: a.ad_name?.slice(0, 80),
                ctr: a.ctr,
                spend: a.spend,
                campaign: a.campaign_name?.slice(0, 60),
                source: "meta_onboarding_90d",
              }),
              created_at: new Date().toISOString(),
            }));
            await supabase.from("creative_memory" as any).insert(memRows).catch(() => {});
          }
        } catch (_e) { /* silent — never block OAuth */ }
      })();

      return new Response(JSON.stringify({
        success: true,
        ad_accounts: adAccounts,
        expires_at: expiresAt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: get_connections ───────────────────────────────────────────────
    if (action === "get_connections") {
      const { data, error } = await supabase
        .from("platform_connections" as any)
        .select("platform, status, connected_at, expires_at, ad_accounts")
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ connections: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: disconnect ────────────────────────────────────────────────────
    if (action === "disconnect") {
      const { platform } = await req.json();
      await supabase
        .from("platform_connections" as any)
        .delete()
        .eq("user_id", user_id)
        .eq("platform", platform);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: pull_insights ─────────────────────────────────────────────────
    if (action === "pull_insights") {
      // Get stored token — scoped to persona_id if provided, fall back to global
      let conn: any = null;
      if (persona_id) {
        const { data: specific } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("platform", "meta").eq("persona_id", persona_id)
          .maybeSingle();
        conn = specific;
      }
      if (!conn) {
        const { data: global } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("platform", "meta").is("persona_id", null)
          .maybeSingle();
        conn = global;
      }

      if (!conn) throw new Error("Meta not connected");

      const token = conn.access_token;
      const accounts = (conn.ad_accounts as any[]) || [];

      // Use selected_account_id if set, otherwise first active account
      const selectedId = conn.selected_account_id;
      const activeAccount = (selectedId && accounts.find((a: any) => a.id === selectedId))
        || accounts.find((a: any) => a.account_status === 1)
        || accounts[0];
      if (!activeAccount) throw new Error("No active ad account found");

      const accountId = activeAccount.id;
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
      const until = new Date().toISOString().split("T")[0];

      const fields = [
        "ad_name", "spend", "impressions", "clicks", "ctr",
        "cpc", "cpm", "actions", "cost_per_action_type",
        "video_play_actions", "video_avg_time_watched_actions",
      ].join(",");

      const insightsUrl = `https://graph.facebook.com/v19.0/${accountId}/insights?` +
        `level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}` +
        `&sort=spend_descending&limit=50&access_token=${token}`;

      const insightsRes = await fetch(insightsUrl);
      const insightsData = await insightsRes.json();

      if (insightsData.error) throw new Error(insightsData.error.message);

      return new Response(JSON.stringify({
        success: true,
        insights: insightsData.data || [],
        account: activeAccount,
        period: { since, until },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Action: list_campaigns / list_ads / get_campaigns ─────────────────────
    if (action === "list_campaigns" || action === "get_campaigns" || action === "list_ads" || action === "get_ads") {
      let conn: any = null;
      if (persona_id) {
        const { data: specific } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("platform", "meta").eq("persona_id", persona_id)
          .maybeSingle();
        conn = specific;
      }
      if (!conn) {
        const { data: global } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id")
          .eq("user_id", user_id).eq("platform", "meta").is("persona_id", null)
          .maybeSingle();
        conn = global;
      }
      if (!conn) throw new Error("Meta not connected");

      const token = conn.access_token;
      const accounts = (conn.ad_accounts as any[]) || [];
      const selectedId = conn.selected_account_id;
      const activeAccount = (selectedId && accounts.find((a: any) => a.id === selectedId))
        || accounts.find((a: any) => a.account_status === 1)
        || accounts[0];
      if (!activeAccount) throw new Error("No active ad account");

      const accountId = activeAccount.id;

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
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
        const until = new Date().toISOString().split("T")[0];
        const url = `https://graph.facebook.com/v19.0/${accountId}/insights?level=ad&fields=ad_name,campaign_name,adset_name,spend,impressions,clicks,ctr,cpm,cpc,actions,frequency,reach&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=20&access_token=${token}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return new Response(JSON.stringify({ success: true, ads: data.data || [], account: activeAccount.name || accountId, period: { since, until } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
