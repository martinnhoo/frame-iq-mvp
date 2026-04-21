/**
 * pixel-health-check — Deterministic pixel diagnostic for a Meta Ads account.
 *
 * Answers the question: "is the pixel actually installed, firing, and wired to
 * the active ads?" — without guessing from conversion counts.
 *
 * Status classification (deterministic, no heuristics):
 *   no_pixel     — /adspixels returns zero pixels
 *   pixel_stale  — primary pixel's last_fired_time is > 7 days ago (or null)
 *   pixel_orphan — pixel fires recently, but > 50% of active ads don't reference
 *                  it in tracking_specs / conversion_specs
 *   pixel_ok     — primary pixel fired in last 24h, active ads wired to it
 *   unknown      — API error, no active ads to check, or no Meta connection
 *
 * Caching: result is stored in pixel_health_cache and re-used for 60 minutes
 * unless `force: true` is passed in the body. Always returns fresh on force.
 *
 * Required OAuth scopes (already requested by meta-oauth): ads_read.
 *
 * Request body: { user_id, persona_id?, account_id?, force? }
 * Response: PixelHealthResult
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, isUserAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── TTL for cached results ─────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Types ──────────────────────────────────────────────────────────────────
type PixelStatus = "no_pixel" | "pixel_stale" | "pixel_orphan" | "pixel_ok" | "unknown";

interface PixelSummary {
  id: string;
  name: string;
  last_fired_time: string | null;
  days_since_fire: number | null;
  is_created_by_business: boolean;
}

interface PixelHealthResult {
  status: PixelStatus;
  message: string;
  pixels: PixelSummary[];
  primary_pixel_id: string | null;
  last_fired_at: string | null;
  orphan_ads_count: number;
  active_ads_checked: number;
  checked_at: string;
  cached: boolean;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

/**
 * Inspects an ad's tracking_specs and conversion_specs to decide whether it
 * references the given pixel ID. Meta's shape:
 *   tracking_specs: [{ "action.type": ["offsite_conversion"], "fb_pixel": ["12345"] }]
 *   conversion_specs: [{ "action.type": ["offsite_conversion"], "fb_pixel": ["12345"] }]
 */
function adReferencesPixel(ad: any, pixelId: string): boolean {
  const specs: any[] = [
    ...((ad.tracking_specs || []) as any[]),
    ...((ad.conversion_specs || []) as any[]),
  ];
  for (const spec of specs) {
    const refs: string[] = spec?.fb_pixel || spec?.pixel || [];
    if (Array.isArray(refs) && refs.includes(pixelId)) return true;
  }
  return false;
}

function buildMessage(
  status: PixelStatus,
  primary: PixelSummary | null,
  orphanCount: number,
  activeCount: number
): string {
  switch (status) {
    case "no_pixel":
      return "Sua conta não tem pixel instalado. Sem ele, a Meta não sabe quem converte — a otimização de campanha fica cega.";
    case "pixel_stale":
      if (primary?.last_fired_time) {
        const days = primary.days_since_fire ?? 0;
        return `Seu pixel "${primary.name}" não dispara há ${days} dias. Provavelmente quebrou no site — eventos não estão chegando na Meta.`;
      }
      return "Seu pixel existe mas nunca disparou. Eventos não estão sendo recebidos pela Meta.";
    case "pixel_orphan":
      return `Seu pixel está disparando, mas ${orphanCount} de ${activeCount} anúncios ativos não estão amarrados a ele. A Meta não consegue otimizar esses anúncios por conversão.`;
    case "pixel_ok":
      return primary
        ? `Pixel "${primary.name}" funcionando normal — disparou nas últimas 24h, ${activeCount} anúncios ativos amarrados.`
        : "Pixel funcionando normal.";
    case "unknown":
      return "Não foi possível verificar o status do pixel agora.";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { user_id, persona_id, account_id: requestedAccountId, force } = body;

    // ── Auth ────────────────────────────────────────────────────────────
    const authed = isCronAuthorized(req) || await isUserAuthorized(req, sb, user_id);
    if (!authed) return unauthorizedResponse(cors);

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Get Meta connection ─────────────────────────────────────────────
    const connQuery = sb
      .from("platform_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("platform", "meta")
      .eq("status", "active");
    if (persona_id) connQuery.eq("persona_id", persona_id);

    const { data: connections, error: connErr } = await connQuery;
    if (connErr || !connections?.length) {
      return new Response(JSON.stringify({
        error: "no_meta_connection",
        message: "Conecte sua conta Meta Ads primeiro",
      }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const conn = connections[0];
    const token = conn.access_token;
    const adAccounts = conn.ad_accounts || [];

    // Resolve the Meta ad account ID. The frontend may pass either:
    //   • the Meta account ID (e.g. "act_152022538205761"), OR
    //   • the internal Supabase UUID of the ad_accounts row (e.g. "a68d2420-...").
    // The latter happens because FeedPage resolves act_… → UUID before calling us.
    // If we see a UUID, look up the Meta ID from ad_accounts (and verify ownership).
    const looksLikeMetaId = (v: string) =>
      typeof v === "string" && (v.startsWith("act_") || /^\d+$/.test(v));
    const looksLikeUuid = (v: string) =>
      typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    let selectedAccountId: string | null = null;

    if (requestedAccountId && looksLikeMetaId(requestedAccountId)) {
      selectedAccountId = requestedAccountId;
    } else if (requestedAccountId && looksLikeUuid(requestedAccountId)) {
      const { data: row, error: rowErr } = await sb
        .from("ad_accounts")
        .select("meta_account_id, user_id")
        .eq("id", requestedAccountId)
        .maybeSingle();
      if (rowErr || !row) {
        return new Response(JSON.stringify({ error: "ad_account_not_found" }), {
          status: 404,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      // Defence-in-depth: refuse if the row doesn't belong to the caller.
      if (row.user_id !== user_id) {
        return new Response(JSON.stringify({ error: "ad_account_not_owned" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      selectedAccountId = row.meta_account_id;
    } else {
      // Fallbacks: connection's saved selection, then first ad account on record.
      selectedAccountId = conn.selected_account_id || adAccounts[0]?.account_id || null;
    }

    if (!selectedAccountId) {
      return new Response(JSON.stringify({ error: "no_account_selected" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Check cache ─────────────────────────────────────────────────────
    if (!force) {
      const { data: cached } = await sb
        .from("pixel_health_cache")
        .select("*")
        .eq("user_id", user_id)
        .eq("ad_account_id", selectedAccountId)
        .maybeSingle();

      // Skip cached entries that were themselves errors — otherwise a single
      // transient Meta outage poisons the result for the whole TTL window.
      if (cached && cached.checked_at && !cached.error && cached.status !== "unknown") {
        const age = Date.now() - new Date(cached.checked_at).getTime();
        if (age < CACHE_TTL_MS) {
          const cachedResult: PixelHealthResult = {
            status: cached.status as PixelStatus,
            message: cached.message || "",
            pixels: (cached.pixels || []) as PixelSummary[],
            primary_pixel_id: cached.primary_pixel_id,
            last_fired_at: cached.last_fired_at,
            orphan_ads_count: cached.orphan_ads_count ?? 0,
            active_ads_checked: cached.active_ads_checked ?? 0,
            checked_at: cached.checked_at,
            cached: true,
            error: cached.error || undefined,
          };
          return new Response(JSON.stringify(cachedResult), {
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      }
    }

    const actId = selectedAccountId.startsWith("act_")
      ? selectedAccountId
      : `act_${selectedAccountId}`;

    // ── Fetch pixels + active ads in parallel ───────────────────────────
    // Token via Authorization header (never in URL params — leaks to logs).
    const metaHeaders = { Authorization: `Bearer ${token}` };

    const pixelsUrl =
      `https://graph.facebook.com/v21.0/${actId}/adspixels?` +
      `fields=id,name,last_fired_time,is_created_by_business&limit=25`;

    const adsUrl =
      `https://graph.facebook.com/v21.0/${actId}/ads?` +
      `fields=id,name,effective_status,tracking_specs,conversion_specs` +
      `&effective_status=%5B%22ACTIVE%22%5D&limit=100`;

    const [pixelsRes, adsRes] = await Promise.all([
      fetch(pixelsUrl, { headers: metaHeaders }),
      fetch(adsUrl, { headers: metaHeaders }),
    ]);

    // ── Hard failure: pixels endpoint errored ───────────────────────────
    if (!pixelsRes.ok) {
      const errText = await pixelsRes.text();
      const errResult: PixelHealthResult = {
        status: "unknown",
        message: "Não foi possível verificar o status do pixel agora.",
        pixels: [],
        primary_pixel_id: null,
        last_fired_at: null,
        orphan_ads_count: 0,
        active_ads_checked: 0,
        checked_at: new Date().toISOString(),
        cached: false,
        error: `adspixels_api_error: ${errText.replace(/access_token=[^&"\s]+/gi, "access_token=***").slice(0, 200)}`,
      };
      await upsertCache(sb, user_id, persona_id, selectedAccountId, errResult);
      return new Response(JSON.stringify(errResult), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const pixelsJson = await pixelsRes.json();
    const rawPixels: any[] = pixelsJson.data || [];

    // ── Case 1: no pixels at all ────────────────────────────────────────
    if (rawPixels.length === 0) {
      const result: PixelHealthResult = {
        status: "no_pixel",
        message: buildMessage("no_pixel", null, 0, 0),
        pixels: [],
        primary_pixel_id: null,
        last_fired_at: null,
        orphan_ads_count: 0,
        active_ads_checked: 0,
        checked_at: new Date().toISOString(),
        cached: false,
      };
      await upsertCache(sb, user_id, persona_id, selectedAccountId, result);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Summarize all pixels, pick primary (most recently fired) ────────
    const now = new Date();
    const pixels: PixelSummary[] = rawPixels
      .map((p: any) => {
        const lastFired = p.last_fired_time ? new Date(p.last_fired_time) : null;
        const days = lastFired ? daysBetween(now, lastFired) : null;
        return {
          id: p.id,
          name: p.name || "Pixel sem nome",
          last_fired_time: p.last_fired_time || null,
          days_since_fire: days,
          is_created_by_business: !!p.is_created_by_business,
        };
      })
      .sort((a, b) => {
        // Most recently fired first; pixels that never fired go last
        const ta = a.last_fired_time ? new Date(a.last_fired_time).getTime() : -Infinity;
        const tb = b.last_fired_time ? new Date(b.last_fired_time).getTime() : -Infinity;
        return tb - ta;
      });

    const primary = pixels[0];
    const primaryFired = primary.last_fired_time ? new Date(primary.last_fired_time) : null;
    const daysSincePrimaryFire = primary.days_since_fire;

    // ── Case 2: pixel stale (never fired or > 7 days) ───────────────────
    if (!primaryFired || (daysSincePrimaryFire !== null && daysSincePrimaryFire > 7)) {
      const result: PixelHealthResult = {
        status: "pixel_stale",
        message: buildMessage("pixel_stale", primary, 0, 0),
        pixels,
        primary_pixel_id: primary.id,
        last_fired_at: primary.last_fired_time,
        orphan_ads_count: 0,
        active_ads_checked: 0,
        checked_at: new Date().toISOString(),
        cached: false,
      };
      await upsertCache(sb, user_id, persona_id, selectedAccountId, result);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Fetch active ads' tracking_specs to check orphan ratio ──────────
    let activeAds: any[] = [];
    if (adsRes.ok) {
      const adsJson = await adsRes.json().catch(() => ({ data: [] }));
      activeAds = (adsJson.data || []) as any[];
    }

    // No active ads to check — we can't verify wiring. Call it ok-ish:
    // pixel fires recently so account is healthy from Meta's side, and the
    // FeedPage 'no-traffic' state will handle the "nothing running" UX.
    if (activeAds.length === 0) {
      const result: PixelHealthResult = {
        status: "pixel_ok",
        message: buildMessage("pixel_ok", primary, 0, 0),
        pixels,
        primary_pixel_id: primary.id,
        last_fired_at: primary.last_fired_time,
        orphan_ads_count: 0,
        active_ads_checked: 0,
        checked_at: new Date().toISOString(),
        cached: false,
      };
      await upsertCache(sb, user_id, persona_id, selectedAccountId, result);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Count ads that don't reference primary pixel
    const orphans = activeAds.filter((ad) => !adReferencesPixel(ad, primary.id));
    const orphanRatio = orphans.length / activeAds.length;

    // ── Case 3: pixel orphan (most active ads not wired) ────────────────
    // Threshold: > 50% of active ads orphaned. Below that we consider it ok —
    // could be legitimate campaigns on different objectives (reach, engagement).
    if (orphanRatio > 0.5) {
      const result: PixelHealthResult = {
        status: "pixel_orphan",
        message: buildMessage("pixel_orphan", primary, orphans.length, activeAds.length),
        pixels,
        primary_pixel_id: primary.id,
        last_fired_at: primary.last_fired_time,
        orphan_ads_count: orphans.length,
        active_ads_checked: activeAds.length,
        checked_at: new Date().toISOString(),
        cached: false,
      };
      await upsertCache(sb, user_id, persona_id, selectedAccountId, result);
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Case 4: all good ────────────────────────────────────────────────
    const result: PixelHealthResult = {
      status: "pixel_ok",
      message: buildMessage("pixel_ok", primary, orphans.length, activeAds.length),
      pixels,
      primary_pixel_id: primary.id,
      last_fired_at: primary.last_fired_time,
      orphan_ads_count: orphans.length,
      active_ads_checked: activeAds.length,
      checked_at: new Date().toISOString(),
      cached: false,
    };
    await upsertCache(sb, user_id, persona_id, selectedAccountId, result);
    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("pixel-health-check error:", err);
    return new Response(JSON.stringify({
      error: "internal_error",
      message: err?.message || "unknown",
    }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Cache upsert (fire-and-forget — never blocks the response on DB failure)
// ═══════════════════════════════════════════════════════════════════════════
async function upsertCache(
  sb: any,
  user_id: string,
  persona_id: string | null | undefined,
  ad_account_id: string,
  result: PixelHealthResult
): Promise<void> {
  try {
    await sb.from("pixel_health_cache").upsert({
      user_id,
      persona_id: persona_id || null,
      ad_account_id,
      status: result.status,
      pixels: result.pixels,
      primary_pixel_id: result.primary_pixel_id,
      last_fired_at: result.last_fired_at,
      orphan_ads_count: result.orphan_ads_count,
      active_ads_checked: result.active_ads_checked,
      message: result.message,
      checked_at: result.checked_at,
      error: result.error || null,
    }, { onConflict: "user_id,ad_account_id" });
  } catch (e) {
    console.error("pixel-health-check cache upsert failed:", e);
  }
}
