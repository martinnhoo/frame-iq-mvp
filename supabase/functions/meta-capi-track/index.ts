// meta-capi-track — Server-side Meta Conversions API event sender.
//
// Why this exists:
//   The browser-side Meta Pixel (fbq('track', ...)) loses 30–50% of
//   events to ad blockers, iOS 14+ ATT, browser tracking prevention,
//   and corporate firewalls. The result is a chronic underreport of
//   conversions to Meta — which then can't optimize the ad delivery
//   correctly, and the user sees "0 conversões" while the database
//   actually shows real signups.
//
//   Conversions API (CAPI) closes that gap: same event sent server-
//   to-server, bypasses the browser entirely. Meta dedupes pixel +
//   CAPI events by matching `event_id` + `event_name` within 48h, so
//   we send BOTH and let Meta pick the best signal.
//
// Required Supabase secrets:
//   META_PIXEL_ID       — defaults to 478948487618567 if missing.
//   META_CAPI_ACCESS_TOKEN — System User access token from Business
//     Manager with `ads_management` scope. Generate at:
//     https://business.facebook.com/settings/system-users
//     One-time setup, never expires.
//
// Optional:
//   META_CAPI_TEST_CODE — when set, events are tagged with this
//     test_event_code so they appear in Events Manager → Test Events
//     (helpful during initial verification).
//
// Endpoint (Graph API v21.0):
//   POST https://graph.facebook.com/v21.0/{pixel_id}/events
//
// PII hashing — Meta REQUIRES email/phone/name to be SHA-256 hashed
// (lowercase, trimmed) before sending. IP and user agent go in clear.
// fbp/fbc cookies go in clear. We follow Meta's Customer Information
// Parameters spec exactly. Sending raw PII would be rejected.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── PII hashing ─────────────────────────────────────────────────────────
// Meta spec: SHA-256 hash of normalized value. Email: lowercased, trimmed.
// Returns hex string.
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const normEmail = (e: string) => e.trim().toLowerCase();
// Names: lowercase, trim whitespace, strip non-letters except hyphens.
const normName = (n: string) =>
  n.trim().toLowerCase().replace(/[^\p{L}\-]/gu, "");

interface CapiUserData {
  email?: string;        // raw — will be hashed
  firstName?: string;    // raw — will be hashed
  lastName?: string;     // raw — will be hashed
  external_id?: string;  // raw or already-hashed user id (Supabase auth uid)
  fbp?: string | null;   // _fbp cookie value, sent in clear
  fbc?: string | null;   // _fbc cookie value, sent in clear
}

interface CapiEventInput {
  event_name: string;       // "Lead", "CompleteRegistration", etc.
  event_id?: string;        // dedupe key — must match pixel's eventID
  event_source_url?: string; // page URL where the event happened
  action_source?: "website" | "app" | "email" | "system_generated";
  user_data: CapiUserData;
  custom_data?: Record<string, unknown>; // content_name, plan, etc.
  user_id?: string;         // optional Supabase user id (for our logging)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "478948487618567";
    const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    const TEST_CODE = Deno.env.get("META_CAPI_TEST_CODE"); // optional

    if (!ACCESS_TOKEN) {
      // Soft-fail: function deployed but token not configured yet.
      // Returning 200 with a marker keeps the client side from
      // throwing — pixel still fires, CAPI just hasn't caught up.
      return new Response(
        JSON.stringify({
          ok: false,
          skipped: true,
          reason: "META_CAPI_ACCESS_TOKEN not configured",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json()) as CapiEventInput;
    if (!body.event_name) {
      return new Response(JSON.stringify({ ok: false, error: "missing event_name" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pull IP + user agent from the request itself (the most reliable
    // values we can attach to this event). Cloudflare/Vercel/etc all
    // forward the original client IP via standard headers.
    const ipAddress =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    const userAgent = req.headers.get("user-agent") || "";

    // Build Meta-spec user_data block. Hashed fields where required.
    const u = body.user_data || {};
    const userData: Record<string, unknown> = {};
    if (u.email)     userData.em = await sha256(normEmail(u.email));
    if (u.firstName) userData.fn = await sha256(normName(u.firstName));
    if (u.lastName)  userData.ln = await sha256(normName(u.lastName));
    if (u.external_id) userData.external_id = await sha256(u.external_id.toLowerCase());
    if (u.fbp) userData.fbp = u.fbp;
    if (u.fbc) userData.fbc = u.fbc;
    if (ipAddress) userData.client_ip_address = ipAddress;
    if (userAgent) userData.client_user_agent = userAgent;

    // Event payload — Meta Graph API spec.
    const event = {
      event_name: body.event_name,
      event_time: Math.floor(Date.now() / 1000), // unix seconds
      event_id: body.event_id, // for pixel dedup
      event_source_url: body.event_source_url,
      action_source: body.action_source || "website",
      user_data: userData,
      ...(body.custom_data ? { custom_data: body.custom_data } : {}),
    };

    const payload: Record<string, unknown> = {
      data: [event],
      ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
    };

    // POST to Graph API with one transient-failure retry. Meta returns
    // 5xx occasionally during their internal deploys; one quick retry
    // covers ~99% of these. Anything 4xx (auth, invalid payload) we
    // surface immediately — retrying won't help.
    const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
    const postOnce = () => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let fbRes = await postOnce();
    if (fbRes.status >= 500) {
      await new Promise((r) => setTimeout(r, 800));
      fbRes = await postOnce();
    }
    const fbBody = await fbRes.text();
    let fbJson: unknown = null;
    try { fbJson = JSON.parse(fbBody); } catch { /* keep raw body */ }

    // Audit log — best-effort row in capture-learning style. Failure
    // here NEVER blocks the CAPI response — we always tell the client
    // whether Meta accepted, regardless of our own logging hiccups.
    if (body.user_id) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        await (sb as any).from("learned_patterns").insert({
          user_id: body.user_id,
          pattern_key: `capi_${body.event_name}`,
          sample_size: 1,
          confidence: 0.05,
          insight_text: `CAPI ${body.event_name} ${fbRes.ok ? "accepted" : "rejected"} (${fbRes.status})`,
          variables: { event_id: body.event_id, status: fbRes.status, response: fbJson },
        });
      } catch { /* silent — logging is optional */ }
    }

    if (!fbRes.ok) {
      return new Response(JSON.stringify({
        ok: false, status: fbRes.status, response: fbJson || fbBody,
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      events_received: (fbJson as any)?.events_received,
      fbtrace_id: (fbJson as any)?.fbtrace_id,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
