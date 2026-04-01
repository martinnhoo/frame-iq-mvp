// google-oauth v3.0 — verificação pós-save + logs detalhados
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const APP_URL       = Deno.env.get("APP_URL") || "https://www.adbrief.pro";
const REDIRECT_URI  = `${APP_URL}/dashboard/loop/connect/google/callback`;
const SCOPES        = "https://www.googleapis.com/auth/adwords";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const json = await req.json().catch(() => ({}));
    const { action, code, user_id, persona_id } = json;

    // ── get_auth_url ──────────────────────────────────────────────────────────
    if (action === "get_auth_url") {
      if (!user_id || !persona_id) {
        return new Response(
          JSON.stringify({ error: "user_id and persona_id required" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      const state = btoa(JSON.stringify({ user_id, persona_id, ts: Date.now() }));
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("state", state);
      console.log("[google-oauth] get_auth_url: redirect_uri =", REDIRECT_URI);
      return new Response(
        JSON.stringify({ url: url.toString() }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── exchange_code ─────────────────────────────────────────────────────────
    if (action === "exchange_code") {
      // Decode state
      let storedUserId = user_id;
      let storedPersonaId = persona_id;
      if (json.state) {
        try {
          const decoded = JSON.parse(atob(json.state));
          storedUserId   = decoded.user_id    || storedUserId;
          storedPersonaId = decoded.persona_id || storedPersonaId;
        } catch (e) {
          console.error("[google-oauth] state decode error:", e);
        }
      }

      console.log("[google-oauth] exchange_code: user_id =", storedUserId, "persona_id =", storedPersonaId);
      console.log("[google-oauth] exchange_code: client_id present =", !!CLIENT_ID, "| secret present =", !!CLIENT_SECRET);
      console.log("[google-oauth] exchange_code: redirect_uri =", REDIRECT_URI);

      if (!storedUserId)    throw new Error("user_id missing — não foi possível identificar o usuário");
      if (!storedPersonaId) throw new Error("persona_id missing — selecione uma conta antes de conectar");

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri:  REDIRECT_URI,
          grant_type:    "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json();
      console.log("[google-oauth] token response status:", tokenRes.status, "| error:", tokenData.error || "none");

      if (tokenData.error) {
        throw new Error(`${tokenData.error}: ${tokenData.error_description || tokenData.error}`);
      }

      const { access_token, refresh_token, expires_in } = tokenData;
      if (!access_token) throw new Error("Nenhum access_token recebido do Google");

      const payload = {
        user_id:      storedUserId,
        platform:     "google",
        persona_id:   storedPersonaId,
        access_token,
        refresh_token: refresh_token || null,
        expires_at:   new Date(Date.now() + (expires_in || 3600) * 1000).toISOString(),
        ad_accounts:  [],
        status:       "active",
        connected_at: new Date().toISOString(),
      };

      // Try upsert first
      const { error: upsertErr } = await sb
        .from("platform_connections" as any)
        .upsert(payload, { onConflict: "user_id,platform,persona_id" });

      if (upsertErr) {
        console.error("[google-oauth] upsert error:", JSON.stringify(upsertErr));
        // Fallback: delete old + insert fresh
        await sb.from("platform_connections" as any)
          .delete()
          .eq("user_id", storedUserId)
          .eq("platform", "google")
          .eq("persona_id", storedPersonaId);

        const { error: insertErr } = await sb
          .from("platform_connections" as any)
          .insert(payload);

        if (insertErr) {
          console.error("[google-oauth] insert error:", JSON.stringify(insertErr));
          throw new Error("Falha ao salvar conexão: " + insertErr.message);
        }
      }

      // ── VERIFICAÇÃO: confirma que a linha foi gravada ──────────────────────
      const { data: saved, error: readErr } = await sb
        .from("platform_connections" as any)
        .select("id, user_id, platform, persona_id, status")
        .eq("user_id", storedUserId)
        .eq("platform", "google")
        .eq("persona_id", storedPersonaId)
        .maybeSingle();

      console.log("[google-oauth] verification read:", JSON.stringify(saved), "| error:", readErr?.message || "none");

      if (!saved) {
        throw new Error("Conexão não encontrada após salvar — possível problema de RLS ou schema");
      }

      return new Response(
        JSON.stringify({ success: true, ad_accounts: [], saved_id: saved.id }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── refresh_token ─────────────────────────────────────────────────────────
    if (action === "refresh_token") {
      const { data: conn } = await sb
        .from("platform_connections" as any)
        .select("refresh_token")
        .eq("user_id", user_id)
        .eq("platform", "google")
        .eq("persona_id", persona_id)
        .maybeSingle();
      if (!conn?.refresh_token) throw new Error("No refresh token");

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: conn.refresh_token,
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type:    "refresh_token",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await sb.from("platform_connections" as any).update({
        access_token: data.access_token,
        expires_at:   new Date(Date.now() + data.expires_in * 1000).toISOString(),
      }).eq("user_id", user_id).eq("platform", "google").eq("persona_id", persona_id);

      return new Response(
        JSON.stringify({ success: true, access_token: data.access_token }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── disconnect ────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await sb.from("platform_connections" as any)
        .delete()
        .eq("user_id", user_id)
        .eq("platform", "google")
        .eq("persona_id", persona_id);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (e: any) {
    console.error("[google-oauth] error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
