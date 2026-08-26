/* eslint-disable @typescript-eslint/no-explicit-any -- Meta Graph responses are runtime payloads. */
import { clipCors, json, requireClipUser, signClipState, verifyClipState } from "../_shared/clip-network.ts";

const APP_URL = (Deno.env.get("APP_URL") || "https://adbrief.pro").replace(/\/+$/, "");
const APP_ID = Deno.env.get("INSTAGRAM_APP_ID") || Deno.env.get("META_APP_ID") || "";
const APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET") || Deno.env.get("META_APP_SECRET") || "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v25.0";
const REDIRECT_URI = `${APP_URL}/dashboard/clips/connect/instagram/callback`;
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"].join(",");

async function currentUser(req: Request) {
  return await requireClipUser(req);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: clipCors });
  try {
    if (!APP_ID || !APP_SECRET) return json({ error: "Instagram app credentials missing" }, 500);
    const body = await req.json().catch(() => ({}));
    const { action, clip_account_id, code, state } = body;

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
      const url = new URL("https://www.instagram.com/oauth/authorize");
      url.searchParams.set("client_id", APP_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", stateParam);
      url.searchParams.set("enable_fb_login", "0");
      url.searchParams.set("force_authentication", "1");
      url.searchParams.set("force_reauth", "true");
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

      const tokenForm = new URLSearchParams();
      tokenForm.set("client_id", APP_ID);
      tokenForm.set("client_secret", APP_SECRET);
      tokenForm.set("grant_type", "authorization_code");
      tokenForm.set("redirect_uri", REDIRECT_URI);
      tokenForm.set("code", code);
      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenForm,
      });
      const token = await tokenRes.json();
      if (!tokenRes.ok || token.error || !token.access_token || !token.user_id) {
        throw new Error(token?.error_message || token?.error?.message || "Instagram token exchange failed");
      }

      const longUrl = new URL("https://graph.instagram.com/access_token");
      longUrl.searchParams.set("grant_type", "ig_exchange_token");
      longUrl.searchParams.set("client_secret", APP_SECRET);
      longUrl.searchParams.set("access_token", token.access_token);
      const longRes = await fetch(longUrl);
      const longBody = await longRes.json();
      if (!longRes.ok || longBody.error || !longBody.access_token) {
        throw new Error(longBody?.error?.message || "Instagram long-lived token exchange failed");
      }
      const userAccessToken = longBody.access_token;
      const expiresIn = longBody.expires_in || 5184000;

      const profileUrl = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me`);
      profileUrl.searchParams.set("fields", "id,user_id,username,name,profile_picture_url,account_type");
      profileUrl.searchParams.set("access_token", userAccessToken);
      const profileRes = await fetch(profileUrl);
      const ig = await profileRes.json();
      if (!profileRes.ok || ig.error) {
        throw new Error(ig?.error?.message || "Could not load Instagram Professional account");
      }
      const instagramUserId = String(ig.user_id || ig.id || token.user_id);
      const { data: social, error: socialError } = await supabase.from("clip_social_accounts").upsert({
        user_id: userId,
        clip_account_id: clipAccountId,
        platform: "instagram",
        external_user_id: instagramUserId,
        username: ig.username || null,
        display_name: ig.name || ig.username || "Instagram",
        status: "active",
        capabilities: { reels_publish: true, auth_mode: "instagram_login", graph_host: "graph.instagram.com" },
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,clip_account_id,platform" }).select("id").single();
      if (socialError) throw socialError;

      const { error: tokenError } = await supabase.from("clip_social_tokens").upsert({
        social_account_id: social.id,
        access_token: userAccessToken,
        token_type: "Bearer",
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scopes: SCOPES,
        provider_payload: { instagram_user_id: instagramUserId, auth_mode: "instagram_login" },
        updated_at: new Date().toISOString(),
      });
      if (tokenError) throw tokenError;

      return json({
        success: true,
        connected: { social_account_id: social.id, username: ig.username, display_name: ig.name, external_user_id: instagramUserId },
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
