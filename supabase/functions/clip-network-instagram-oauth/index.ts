/* eslint-disable @typescript-eslint/no-explicit-any -- Meta Graph responses are runtime payloads. */
import { clipCors, json, requireClipUser, signClipState, verifyClipState } from "../_shared/clip-network.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://adbrief.pro";
const APP_ID = Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v25.0";
const REDIRECT_URI = `${APP_URL}/dashboard/clips/connect/instagram/callback`;
const SCOPES = ["pages_show_list", "instagram_basic", "instagram_content_publish", "pages_read_engagement"].join(",");

async function currentUser(req: Request) {
  return await requireClipUser(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    if (!APP_ID || !APP_SECRET) return json({ error: "Meta app credentials missing" }, 500);
    const body = await req.json().catch(() => ({}));
    const { action, clip_account_id, code, state, page_id } = body;

    if (action === "get_auth_url") {
      const { supabase, user } = await currentUser(req);
      if (!clip_account_id) return json({ error: "clip_account_id required" }, 400);
      const { data: ownedAccount } = await supabase.from("clip_accounts")
        .select("id")
        .eq("id", clip_account_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownedAccount) return json({ error: "clip account not found" }, 404);
      const stateParam = await signClipState({ user_id: user.id, clip_account_id });
      const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
      url.searchParams.set("client_id", APP_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", stateParam);
      return json({ url: url.toString() });
    }

    if (action === "exchange_code") {
      const { supabase, user } = await currentUser(req);
      const decoded: any = await verifyClipState(state || "");
      const userId = decoded.user_id;
      const clipAccountId = decoded.clip_account_id || clip_account_id;
      if (!userId || !clipAccountId || !code) return json({ error: "invalid OAuth callback state" }, 400);
      if (userId !== user.id) return json({ error: "OAuth state does not belong to the current user" }, 403);
      const { data: ownedAccount } = await supabase.from("clip_accounts")
        .select("id")
        .eq("id", clipAccountId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownedAccount) return json({ error: "clip account not found" }, 404);

      const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", APP_ID);
      tokenUrl.searchParams.set("client_secret", APP_SECRET);
      tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      tokenUrl.searchParams.set("code", code);
      const tokenRes = await fetch(tokenUrl);
      const token = await tokenRes.json();
      if (!tokenRes.ok || token.error) throw new Error(token?.error?.message || "Meta token exchange failed");

      // Extend user token when supported; if extension fails, retain the short-lived token.
      let userAccessToken = token.access_token;
      let expiresIn = token.expires_in || 3600;
      try {
        const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
        longUrl.searchParams.set("grant_type", "fb_exchange_token");
        longUrl.searchParams.set("client_id", APP_ID);
        longUrl.searchParams.set("client_secret", APP_SECRET);
        longUrl.searchParams.set("fb_exchange_token", token.access_token);
        const longRes = await fetch(longUrl);
        const longBody = await longRes.json();
        if (longRes.ok && longBody.access_token) {
          userAccessToken = longBody.access_token;
          expiresIn = longBody.expires_in || expiresIn;
        }
      } catch {
        // Keep the short-lived token when Meta does not allow extension.
      }

      const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
      pagesUrl.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}");
      pagesUrl.searchParams.set("access_token", userAccessToken);
      const pagesRes = await fetch(pagesUrl);
      const pagesBody = await pagesRes.json();
      if (!pagesRes.ok || pagesBody.error) throw new Error(pagesBody?.error?.message || "Could not list Instagram accounts");

      const candidates = (pagesBody.data || []).filter((p: any) => p.instagram_business_account?.id);
      if (!candidates.length) {
        return json({ error: "No Instagram Professional account linked to a Facebook Page was found." }, 400);
      }
      const selected = candidates.find((p: any) => p.id === page_id) || candidates[0];
      const ig = selected.instagram_business_account;
      const { data: social, error: socialError } = await supabase.from("clip_social_accounts").upsert({
        user_id: userId,
        clip_account_id: clipAccountId,
        platform: "instagram",
        external_user_id: ig.id,
        username: ig.username || null,
        display_name: ig.name || selected.name || ig.username || "Instagram",
        status: "active",
        capabilities: { reels_publish: true, auth_mode: "facebook_login" },
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,clip_account_id,platform" }).select("id").single();
      if (socialError) throw socialError;

      // Page token is the correct token for IG publishing under Facebook Login.
      const pageToken = selected.access_token;
      const { error: tokenError } = await supabase.from("clip_social_tokens").upsert({
        social_account_id: social.id,
        access_token: pageToken,
        token_type: "Bearer",
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scopes: SCOPES,
        provider_payload: { facebook_page_id: selected.id, auth_mode: "facebook_login" },
        updated_at: new Date().toISOString(),
      });
      if (tokenError) throw tokenError;

      return json({
        success: true,
        connected: { social_account_id: social.id, username: ig.username, display_name: ig.name || selected.name, external_user_id: ig.id },
        candidates: candidates.map((p: any) => ({ page_id: p.id, page_name: p.name, instagram: p.instagram_business_account })),
      });
    }

    if (action === "disconnect") {
      const { supabase, user } = await currentUser(req);
      const { social_account_id } = body;
      if (!social_account_id) return json({ error: "social_account_id required" }, 400);
      await supabase.from("clip_social_accounts").delete().eq("id", social_account_id).eq("user_id", user.id);
      return json({ success: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, String(e).includes("unauthorized") ? 401 : 400);
  }
});
