// adbrief-ai-chat v21.0 — stability + context size fix
import { createClient } from "npm:@supabase/supabase-js@2";
import { getEffectivePlan } from "../_shared/credits.ts";
import { requireCredits } from "../_shared/deductCredits.ts";
import { checkCostCap, recordCost, capExceededResponse } from "../_shared/cost-cap.ts";
import {
  NON_LP_HOSTS,
  normalizeUrl,
  extractLandingUrls,
  stripHtmlToText,
  detectStructuralSignals,
} from "./detect-signals.ts";

// ── Timing helper ──
const _t0 = Date.now();
const _lap = (label: string) => console.log(`[ai-chat] ${label}: ${Date.now() - _t0}ms`);

// ─────────────────────────────────────────────────────────────────────────────
// Landing-page fetch — lets the AI actually *read* URLs the user drops in chat.
//
// Flow:
//  1. extractLandingUrls(message) pulls up to 2 candidate URLs, excluding
//     social / platform noise (Instagram posts, YouTube, fb.com, etc.).
//  2. getOrFetchLanding(url) checks the landing_page_snapshots cache (24h TTL).
//     On miss, fetches via Jina Reader (handles SPAs/JS) and falls back to raw
//     fetch() with a minimal HTML→text extractor.
//  3. Result is injected into the system prompt as a `## LANDING PAGE` block
//     so the AI can diagnose ad↔LP mismatch, pixel presence, CTA friction, etc.
//
// Philosophy: the AI should USE this content naturally when a URL is present —
// but MUST NOT proactively beg the user to send URLs when the conversation
// doesn't call for it. That rule lives in the system prompt.
// ─────────────────────────────────────────────────────────────────────────────

// Landing-page URL extraction, HTML→text and structural-signal detection
// live in ./detect-signals.ts (pure functions, unit-tested).

async function md5(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("MD5", data).catch(() => null);
  if (hash) return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Fallback: SHA-256 first 32 chars (MD5 unavailable in some runtimes)
  const sha = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(sha)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * fetchMetaWithRetry — exponential backoff on Meta Graph API failures.
 * Essential for agency-scale accounts (100+ campaigns) that routinely hit
 * Meta's user-level rate limits (429) or transient 5xx during peak hours.
 *
 * Retries only on:
 *   - 429 (rate limited) — honor Retry-After header if present
 *   - 5xx (server error) — backoff + retry
 *   - Network errors (aborted, timeout)
 *
 * Does NOT retry on 4xx (bad request, auth) — those are not transient.
 */
async function fetchMetaWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10000, maxRetries = 3 } = opts;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      // Retry on transient HTTP
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt === maxRetries) return res; // give up, caller handles
        const retryAfter = res.headers.get("retry-after");
        const hinted = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 8000) : 0;
        const backoff = Math.min(Math.pow(2, attempt) * 500, 8000);
        const wait = Math.max(hinted, backoff);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === maxRetries) break;
      const backoff = Math.min(Math.pow(2, attempt) * 500, 8000);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  // Exhausted retries from a caught error — rethrow so caller's catch block
  // lights up the same way it did before (Promise.allSettled handles this).
  throw lastErr ?? new Error("fetchMetaWithRetry: exhausted retries");
}

/**
 * Fetch a URL and return cleaned text + structural hints.
 * Tries Jina Reader first (handles JS-heavy SPAs), falls back to raw fetch().
 */
async function fetchLandingContent(url: string): Promise<{
  content: string;
  title: string;
  source: "jina" | "raw" | "error";
  error?: string;
  hasFbPixel: boolean;
  hasConvEvent: boolean;
  primaryCta: string | null;
}> {
  // 1. Jina Reader — markdown-clean, SPA-capable
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetchWithTimeout(jinaUrl, {
      headers: { "X-Return-Format": "text", "User-Agent": "AdBrief/1.0 (+https://adbrief.pro)" },
    }, 12000);
    if (res.ok) {
      const raw = await res.text();
      const content = (raw || "").slice(0, 8000);
      // Jina includes "Title:" line at the top
      const titleMatch = content.match(/^Title:\s*(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : "";
      const cleaned = content.replace(/^Title:.*$/m, "").replace(/^URL Source:.*$/m, "").trim();
      const signals = detectStructuralSignals(cleaned);
      return { content: cleaned, title, source: "jina", ...signals };
    }
  } catch (e) {
    console.log("[ai-chat] jina fetch failed:", (e as Error).message);
  }

  // 2. Raw fetch fallback
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AdBrief/1.0; +https://adbrief.pro)",
        "Accept": "text/html,application/xhtml+xml",
      },
    }, 10000);
    if (!res.ok) {
      return { content: "", title: "", source: "error", error: `HTTP ${res.status}`, hasFbPixel: false, hasConvEvent: false, primaryCta: null };
    }
    const html = (await res.text()).slice(0, 200000); // cap before parse
    // Detect pixel on RAW HTML (scripts aren't stripped yet)
    const signals = detectStructuralSignals(html);
    const { title, text } = stripHtmlToText(html);
    return {
      content: text.slice(0, 8000),
      title,
      source: "raw",
      ...signals,
    };
  } catch (e) {
    return { content: "", title: "", source: "error", error: (e as Error).message || "fetch failed", hasFbPixel: false, hasConvEvent: false, primaryCta: null };
  }
}

/**
 * Cache-aware wrapper. Returns cached content if under 24h old.
 * Writes snapshot on every fresh fetch (upsert by user_id + url_hash).
 */
async function getOrFetchLanding(
  sb: any,
  userId: string,
  url: string,
): Promise<{
  url: string;
  title: string;
  content: string;
  source: string;
  error?: string;
  hasFbPixel: boolean;
  hasConvEvent: boolean;
  primaryCta: string | null;
  fetchedAt: string;
} | null> {
  if (!userId || !url) return null;
  const hash = await md5(url);
  const TTL_MS = 24 * 60 * 60 * 1000;

  // 1. Cache lookup
  try {
    const { data: cached } = await sb
      .from("landing_page_snapshots")
      .select("url, title, content, source, error, has_fb_pixel, has_conversion_event, primary_cta, fetched_at")
      .eq("user_id", userId)
      .eq("url_hash", hash)
      .maybeSingle();
    if (cached && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < TTL_MS && cached.source !== "error") {
        return {
          url: cached.url,
          title: cached.title || "",
          content: cached.content || "",
          source: cached.source,
          hasFbPixel: !!cached.has_fb_pixel,
          hasConvEvent: !!cached.has_conversion_event,
          primaryCta: cached.primary_cta || null,
          fetchedAt: cached.fetched_at,
        };
      }
    }
  } catch (e) {
    console.log("[ai-chat] lp cache lookup failed:", (e as Error).message);
  }

  // 2. Fresh fetch
  const fetched = await fetchLandingContent(url);

  // 3. Upsert cache (fire-and-forget, don't block response)
  try {
    await sb.from("landing_page_snapshots").upsert({
      user_id: userId,
      url,
      url_hash: hash,
      title: fetched.title || null,
      content: fetched.content || null,
      source: fetched.source,
      error: fetched.error || null,
      has_fb_pixel: fetched.source === "error" ? null : fetched.hasFbPixel,
      has_conversion_event: fetched.source === "error" ? null : fetched.hasConvEvent,
      primary_cta: fetched.primaryCta || null,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "user_id,url_hash" });
  } catch (e) {
    console.log("[ai-chat] lp cache upsert failed:", (e as Error).message);
  }

  return {
    url,
    title: fetched.title,
    content: fetched.content,
    source: fetched.source,
    error: fetched.error,
    hasFbPixel: fetched.hasFbPixel,
    hasConvEvent: fetched.hasConvEvent,
    primaryCta: fetched.primaryCta,
    fetchedAt: new Date().toISOString(),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { message, context, user_id, persona_id, history, user_language, user_prefs, panel_data, active_metric_alert } = body;

    // ── Auth check — runs first for ALL modes including panel_data ────────────
    const sbAuth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeaderEarly = req.headers.get("Authorization");
    if (authHeaderEarly?.startsWith("Bearer ")) {
      const earlyToken = authHeaderEarly.slice(7);
      const {
        data: { user: earlyUser },
        error: earlyAuthError,
      } = await sbAuth.auth.getUser(earlyToken);
      if (earlyAuthError || !earlyUser || earlyUser.id !== user_id) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (user_id) {
      // No auth header at all — reject
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate persona_id belongs to this user (prevents cross-account access) ──
    if (persona_id && user_id) {
      const { data: personaCheck } = await sbAuth
        .from("personas")
        .select("id")
        .eq("id", persona_id)
        .eq("user_id", user_id)
        .maybeSingle();
      if (!personaCheck) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Update selected account — service_role bypasses trigger/RLS ──────────
    if (body.update_selected_account && user_id && persona_id && body.account_id) {
      // Validate the account actually belongs to this user's persona connection
      // before writing. Defense-in-depth on top of the JWT ownership check
      // above — prevents a client from saving an account_id that isn't theirs.
      const { data: connRow } = await sbAuth
        .from("platform_connections" as any)
        .select("ad_accounts")
        .eq("user_id", user_id)
        .eq("persona_id", persona_id)
        .eq("platform", "meta")
        .maybeSingle();

      const owned = Array.isArray((connRow as any)?.ad_accounts)
        && (connRow as any).ad_accounts.some((a: any) => a?.id === body.account_id);

      if (!owned) {
        return new Response(JSON.stringify({ error: "account_not_owned" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sbAuth.from("platform_connections" as any)
        .update({ selected_account_id: body.account_id })
        .eq("user_id", user_id)
        .eq("persona_id", persona_id)
        .eq("platform", "meta");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── Panel Data mode — skip Claude, return structured ad data for LivePanel ──
    if (panel_data && user_id && persona_id) {
      const sbPanel = sbAuth;
      const platforms: string[] = body.platforms || [];
      const result: Record<string, any> = {};
      const today = body.date_to || body.date_to || new Date().toISOString().split("T")[0];
      const since = body.date_from || new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

      // Meta Ads
      if (platforms.includes("meta")) {
        const panelAccId = body.account_id || null;
        const { data: mcAll } = await sbPanel
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id)
          .eq("platform", "meta")
          .eq("status", "active");
        const mcList = (mcAll as any[]) || [];
        const mc = persona_id
          ? mcList.find((c: any) => c.persona_id === persona_id) || null
          : mcList[0] || null;
        if (mc?.access_token) {
          const token = mc.access_token;
          const effectivePanelAccId = panelAccId || mc.selected_account_id;
          const acc =
            (mc.ad_accounts || []).find((a: any) => a.id === effectivePanelAccId) || (mc.ad_accounts || [])[0];
          if (acc) {
            const fields =
              "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency,reach";
            const [r1, r2, r3, r4] = await Promise.allSettled([
              fetchMetaWithRetry(
                `https://graph.facebook.com/v21.0/${acc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${today}"}&sort=spend_descending&limit=100&access_token=${token}`,
              ),
              fetchMetaWithRetry(
                `https://graph.facebook.com/v21.0/${acc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=100&access_token=${token}`,
              ),
              fetchMetaWithRetry(
                `https://graph.facebook.com/v21.0/${acc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&time_range={"since":"${since}","until":"${today}"}&time_increment=1&limit=60&access_token=${token}`,
              ),
              fetchMetaWithRetry(`https://graph.facebook.com/v21.0/${acc.id}?fields=currency,timezone_name&access_token=${token}`),
            ]);
            const ads = r1.status === "fulfilled" ? await r1.value.json() : null;
            const camps = r2.status === "fulfilled" ? await r2.value.json() : null;
            const ts = r3.status === "fulfilled" ? await r3.value.json() : null;
            const accInfo = r4.status === "fulfilled" ? await r4.value.json() : null;
            const currency = accInfo?.currency || "BRL";
            const currSymbol =
              currency === "BRL"
                ? "R$"
                : currency === "USD"
                  ? "$"
                  : currency === "EUR"
                    ? "€"
                    : currency === "MXN"
                      ? "$"
                      : currency;
            if (ads?.error?.code === 190 || camps?.error?.code === 190) {
              result.meta = { error: "token_expired", account_name: acc.name || acc.id };
            } else {
              const adsData: any[] = ads?.data || [];
              const totalSpend = adsData.reduce((s: number, a: any) => s + parseFloat(a.spend || 0), 0);
              const totalImpr = adsData.reduce((s: number, a: any) => s + parseInt(a.impressions || 0), 0);
              const totalClicks = adsData.reduce((s: number, a: any) => s + parseInt(a.clicks || 0), 0);
              const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
              const avgCPM = totalImpr > 0 ? (totalSpend / totalImpr) * 1000 : 0;
              const avgFreq =
                adsData.length > 0
                  ? adsData.reduce((s: number, a: any) => s + parseFloat(a.frequency || 0), 0) / adsData.length
                  : 0;
              const totalConv = adsData.reduce((s: number, a: any) => {
                const p = parseFloat(a.actions?.find((x: any) => x.action_type === "purchase")?.value || 0);
                const l = parseFloat(a.actions?.find((x: any) => x.action_type === "lead")?.value || 0);
                return s + p + l;
              }, 0);
              const enriched = adsData
                .map((a: any) => {
                  const spend = parseFloat(a.spend || 0),
                    ctr = parseFloat(a.ctr || 0),  // Meta returns CTR as percentage string (e.g. 7.81 = 7.81%)
                    freq = parseFloat(a.frequency || 0);
                  const hookRate = () => {
                    const plays = a.video_play_actions?.find((x: any) => x.action_type === "video_play")?.value;
                    const impr = parseInt(a.impressions || 0);
                    return plays && impr ? (parseFloat(plays) / impr) * 100 : null;
                  };
                  return {
                    name: a.ad_name,
                    campaign: a.campaign_name,
                    spend,
                    ctr,
                    cpm: parseFloat(a.cpm || 0),
                    freq,
                    hookRate: hookRate(),
                    conv: parseFloat(
                      a.actions?.find((x: any) => x.action_type === "purchase")?.value ||
                        a.actions?.find((x: any) => x.action_type === "lead")?.value ||
                        0,
                    ),
                    isRisk: freq > 3.5 || (ctr < 0.5 && spend > 20),
                    isWinner: ctr > 1.5 && freq < 3 && spend > 5,
                  };
                })
                .sort((a: any, b: any) => b.spend - a.spend);
              // Compute tracking health for panel_data — structured Problem/Cause/Impact
              let panelTrackingStatus: "healthy" | "uncertain" | "broken" = "uncertain";
              let panelTrackingLabel = "";
              let panelTrackingProblem = "";
              let panelTrackingCauses: string[] = [];
              let panelTrackingImpact = "";
              let panelTrackingCase = ""; // case1 | case2 | case3 | none
              let panelTrackingChatMsg = ""; // auto-inject into AI chat on CTA click

              if (totalConv > 0) {
                // Check for event mismatch even when conversions exist
                const goalEvt = (() => {
                  try {
                    const { data: gd } = (result as any).__goalData || {};
                    return null; // goalData not accessible here; mismatch checked via low conv rate
                  } catch { return null; }
                })();
                const convRate = totalClicks > 0 ? totalConv / totalClicks : 0;
                if (totalSpend > 100 && convRate < 0.005) {
                  // Case 2: high spend + very low conversions
                  panelTrackingStatus = "uncertain";
                  panelTrackingCase = "case2";
                  panelTrackingLabel = "Taxa de conversão muito baixa";
                  panelTrackingProblem = `${totalConv} conversões em ${totalClicks} cliques (${(convRate * 100).toFixed(2)}%) — abaixo do esperado`;
                  panelTrackingCauses = [
                    "Evento de conversão pode estar disparando na página errada",
                    "Tracking parcial — apenas parte das conversões é registrada",
                    "Evento duplicado sendo descartado pelo Meta",
                  ];
                  panelTrackingImpact = "CPA pode estar inflado. Otimização de campanha pode ser imprecisa.";
                  panelTrackingChatMsg = `Diagnóstico de Tracking\n\nMinhas campanhas estão com taxa de conversão muito baixa (${(convRate * 100).toFixed(2)}%). Tenho ${totalConv} conversões em ${totalClicks} cliques com $${totalSpend.toFixed(0)} de investimento.\n\nIsso pode ser problema de tracking? Me ajuda a diagnosticar.`;
                } else {
                  panelTrackingStatus = "healthy";
                  panelTrackingLabel = "Tracking ativo";
                  panelTrackingCase = "none";
                }
              } else if (totalSpend > 0 && totalConv === 0) {
                // Zero conversions with spend — need to decide if this is a real
                // tracking problem or just a young campaign. Use the time-series
                // to count days of actual delivery.
                const panelDaysWithSpend = Array.isArray(ts?.data)
                  ? ts.data.filter((d: any) => parseFloat(d.spend || 0) > 0).length
                  : 0;
                if (panelDaysWithSpend > 0 && panelDaysWithSpend < 3) {
                  // Fresh campaign — attribution window (24–72h) still settling.
                  panelTrackingStatus = "uncertain";
                  panelTrackingCase = "none";
                  panelTrackingLabel = `Campanha nova (${panelDaysWithSpend} dia${panelDaysWithSpend === 1 ? "" : "s"})`;
                } else if (panelDaysWithSpend >= 3 && totalSpend > 300 && totalClicks > 100) {
                  // 3+ days, material spend, real click volume, still 0 → real flag.
                  panelTrackingStatus = "broken";
                  panelTrackingCase = "case1";
                  panelTrackingLabel = "Nenhuma conversão detectada";
                  panelTrackingProblem = `${panelDaysWithSpend} dias rodando — ${totalClicks} cliques, $${totalSpend.toFixed(0)} investidos, 0 conversões registradas`;
                  panelTrackingCauses = [
                    "Evento de conversão não está disparando no site",
                    "Evento selecionado não corresponde à ação real do usuário",
                    "Landing page com problema impedindo a conversão",
                  ];
                  panelTrackingImpact = "AdBrief não consegue calcular CPA. Otimização de performance está limitada.";
                  panelTrackingChatMsg = `Diagnóstico de Tracking\n\nMinhas campanhas estão rodando há ${panelDaysWithSpend} dias (${totalClicks} cliques, $${totalSpend.toFixed(0)} investidos) mas nenhuma conversão está sendo registrada.\n\nPreciso diagnosticar o que está errado com o tracking. Em qual plataforma meu site foi construído?`;
                } else {
                  // Has spend but not enough signal yet to blame tracking.
                  panelTrackingStatus = "uncertain";
                  panelTrackingCase = "none";
                  panelTrackingLabel = "Volume ainda baixo";
                }
              } else if (totalSpend === 0) {
                panelTrackingStatus = "uncertain";
                panelTrackingCase = "none";
                panelTrackingLabel = "Sem dados suficientes";
              } else {
                panelTrackingStatus = "uncertain";
                panelTrackingCase = "none";
                panelTrackingLabel = "Avaliando tracking";
              }

              result.meta = {
                account_name: acc.name || acc.id,
                period: `${since} → ${today}`,
                currency,
                currency_symbol: currSymbol,
                kpis: {
                  spend: totalSpend.toFixed(2),
                  ctr: avgCTR.toFixed(2),
                  cpm: avgCPM.toFixed(2),
                  frequency: avgFreq.toFixed(1),
                  conversions: totalConv.toFixed(0),
                  active_ads: adsData.length,
                },
                tracking_health: {
                  status: panelTrackingStatus,
                  label: panelTrackingLabel,
                  case: panelTrackingCase,
                  problem: panelTrackingProblem || undefined,
                  causes: panelTrackingCauses.length > 0 ? panelTrackingCauses : undefined,
                  impact: panelTrackingImpact || undefined,
                  chat_message: panelTrackingChatMsg || undefined,
                },
                winners: enriched.filter((a: any) => a.isWinner).slice(0, 5),
                at_risk: enriched.filter((a: any) => a.isRisk).slice(0, 5),
                top_ads: enriched.slice(0, 10),
                campaigns: (camps?.data || []).slice(0, 10).map((c: any) => ({
                  name: c.name,
                  status: c.effective_status || c.status,
                  budget: c.daily_budget
                    ? `${currSymbol}${(parseInt(c.daily_budget) / 100).toFixed(0)}/dia`
                    : c.lifetime_budget
                      ? `${currSymbol}${(parseInt(c.lifetime_budget) / 100).toFixed(0)} total`
                      : "—",
                  objective: c.objective,
                })),
                time_series: (ts?.data || [])
                  .filter((d: any) => parseFloat(d.spend || 0) > 0)
                  .map((d: any) => ({
                    date: d.date_start,
                    spend: parseFloat(d.spend || 0),
                    ctr: parseFloat(d.ctr || 0),  // Already percentage from Meta API
                    cpm: parseFloat(d.cpm || 0),
                  })),
              };
            }
          } else {
            result.meta = { error: "no_account_selected" };
          }
        } else {
          result.meta = { error: "not_connected" };
        }
      }

      // Google Ads
      if (platforms.includes("google")) {
        const { data: gc } = await sbPanel
          .from("platform_connections" as any)
          .select("access_token, refresh_token, expires_at, ad_accounts, selected_account_id")
          .eq("user_id", user_id)
          .eq("persona_id", persona_id)
          .eq("platform", "google")
          .eq("status", "active")
          .maybeSingle();
        if (gc?.access_token) {
          let token = gc.access_token;
          if (gc.expires_at && new Date(gc.expires_at) < new Date()) {
            const rr = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
                client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
                refresh_token: gc.refresh_token ?? "",
                grant_type: "refresh_token",
              }),
            });
            const rd = await rr.json();
            if (rd.access_token) {
              token = rd.access_token;
              await sbPanel
                .from("platform_connections" as any)
                .update({
                  access_token: token,
                  expires_at: new Date(Date.now() + (rd.expires_in || 3600) * 1000).toISOString(),
                })
                .eq("user_id", user_id)
                .eq("persona_id", persona_id)
                .eq("platform", "google");
            }
          }
          const acc =
            (gc.ad_accounts || []).find((a: any) => a.id === gc.selected_account_id) || (gc.ad_accounts || [])[0];
          if (acc) {
            const custId = acc.id.replace(/-/g, "");
            const hdr = {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "developer-token": Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? "",
            }; // login-customer-id removed
            const gq = (q: string) =>
              fetch(`https://googleads.googleapis.com/v23/customers/${custId}/googleAds:search`, {
                method: "POST",
                headers: hdr,
                body: JSON.stringify({ query: q }),
              }).then((r) => r.json());
            const [cr, ar, tr] = await Promise.allSettled([
              gq(
                `SELECT campaign.name,campaign.status,campaign.advertising_channel_type,metrics.impressions,metrics.clicks,metrics.ctr,metrics.average_cpc,metrics.cost_micros,metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${today}' AND campaign.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`,
              ),
              gq(
                `SELECT ad_group_ad.ad.name,ad_group_ad.ad.type,campaign.name,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${today}' AND ad_group_ad.status!='REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`,
              ),
              gq(
                `SELECT segments.date,metrics.impressions,metrics.clicks,metrics.ctr,metrics.cost_micros,metrics.conversions FROM customer WHERE segments.date BETWEEN '${since}' AND '${today}' ORDER BY segments.date ASC LIMIT 14`,
              ),
            ]);
            const parse = (r: any) => (r.status === "fulfilled" ? r.value?.results || [] : []);
            const gcs = parse(cr),
              gas = parse(ar),
              gts = parse(tr);
            const totSpend = gcs.reduce((s: number, r: any) => s + (r.metrics?.costMicros || 0) / 1e6, 0);
            const totConv = gcs.reduce((s: number, r: any) => s + (r.metrics?.conversions || 0), 0);
            const totClk = gcs.reduce((s: number, r: any) => s + (r.metrics?.clicks || 0), 0);
            const totImpr = gcs.reduce((s: number, r: any) => s + (r.metrics?.impressions || 0), 0);
            result.google = {
              account_name: acc.name || custId,
              period: `${since} → ${today}`,
              kpis: {
                spend: totSpend.toFixed(2),
                ctr: totImpr > 0 ? ((totClk / totImpr) * 100).toFixed(2) : "0",
                cpc: totClk > 0 ? (totSpend / totClk).toFixed(2) : "0",
                conversions: totConv.toFixed(0),
                impressions: totImpr.toLocaleString(),
                active_campaigns: gcs.length,
              },
              campaigns: gcs
                .slice(0, 10)
                .map((r: any) => ({
                  name: r.campaign?.name || "—",
                  status: r.campaign?.status || "—",
                  spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
                  ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
                  conversions: (r.metrics?.conversions || 0).toFixed(1),
                })),
              top_ads: gas
                .slice(0, 10)
                .map((r: any) => ({
                  name: r.adGroupAd?.ad?.name || "Ad",
                  campaign: r.campaign?.name || "—",
                  spend: ((r.metrics?.costMicros || 0) / 1e6).toFixed(2),
                  ctr: ((r.metrics?.ctr || 0) * 100).toFixed(2),
                  conversions: (r.metrics?.conversions || 0).toFixed(1),
                })),
              time_series: gts
                .map((r: any) => ({
                  date: r.segments?.date,
                  spend: (r.metrics?.costMicros || 0) / 1e6,
                  ctr: (r.metrics?.ctr || 0) * 100,
                }))
                .filter((d: any) => d.spend > 0),
            };
          } else {
            result.google = { error: "no_account_selected" };
          }
        } else {
          result.google = { error: "not_connected" };
        }
      }

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ── End panel_data mode ──────────────────────────────────────────────────

    if (!message || !user_id) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 1. Reuse sbAuth as the main supabase client (already created above) ──
    const supabase = sbAuth;

    // ── 2. Plan check + atomic rate limiting ─────────────────────────────────
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("plan, email, dashboard_count, subscription_status, trial_end")
      .eq("id", user_id)
      .maybeSingle();
    const plan = getEffectivePlan(profileRow?.plan, (profileRow as any)?.email);
    const planKey =
      (["free", "maker", "pro", "studio"].includes(plan)
        ? plan
        : ({ creator: "maker", starter: "pro", scale: "studio", lifetime: "studio", appsumo: "studio", ltd: "studio" } as any)[plan]) || "free";

    // ── Trial detection ────────────────────────────────────────────────────────
    const isTrialing = (profileRow as any)?.subscription_status === "trialing";
    const trialEndDate = (profileRow as any)?.trial_end ? new Date((profileRow as any).trial_end) : null;
    const trialExpired = trialEndDate ? trialEndDate < new Date() : false;
    // If trial expired and not updated yet — treat as free
    const effectivePlanKey = (isTrialing && trialExpired) ? "free" : planKey;

    const todayDate = new Date().toISOString().slice(0, 10);
    const monthKey = todayDate.slice(0, 7); // YYYY-MM

    const uiLang = (user_language as string) || "pt";

    // ── Credit check: Chat costs 2 credits per message ────────────────────────
    const creditCheck = await requireCredits(supabase, user_id, "chat");
    if (!creditCheck.allowed) {
      const uLang = (user_language as string) || "pt";
      const total = creditCheck.total ?? 0;

      // Tier-specific response blocks:
      //   free   → show plans only (upgrade wall)
      //   maker  → buy credits OR upgrade to Pro
      //   pro    → buy credits OR upgrade to Studio
      //   studio → buy credits only (already max plan)

      const PLAN_NAMES: Record<string, string> = { free: "Free", maker: "Maker", pro: "Pro", studio: "Studio" };
      // Labels are left blank — frontend renders them from its i18n dict keyed by `key`.
      const NEXT_PLAN: Record<string, { key: string; name: string; credits: number; price_monthly: number } | null> = {
        free:   { key: "maker",  name: "Maker",  credits: 1000,  price_monthly: 19  },
        maker:  { key: "pro",    name: "Pro",    credits: 2500,  price_monthly: 49  },
        pro:    { key: "studio", name: "Studio", credits: 99999, price_monthly: 299 },
        studio: null,
      };

      const planName = PLAN_NAMES[planKey] || planKey;
      const next = NEXT_PLAN[planKey] ?? null;
      const blocks: any[] = [];

      if (planKey === "free") {
        // FREE → plans only, no credit option. Frontend renders all human-readable
        // text from its i18n map, keyed by `key`. Only machine-readable metadata here.
        blocks.push({
          type: "credits_exhausted_free",
          plan: "free",
          plans: [
            { key: "maker",  price_monthly: 19  },
            { key: "pro",    price_monthly: 49,  recommended: true },
            { key: "studio", price_monthly: 299 },
          ],
        });
      } else if (planKey === "studio") {
        // STUDIO → credits only (already top plan)
        blocks.push({
          type: "credits_exhausted_paid",
          plan: planKey,
          plan_name: planName,
          total_credits: total,
          options: ["buy_credits"],
        });
      } else {
        // MAKER / PRO → credits OR upgrade
        blocks.push({
          type: "credits_exhausted_paid",
          plan: planKey,
          plan_name: planName,
          total_credits: total,
          next_plan: next,
          options: ["buy_credits", "upgrade"],
        });
      }

      return new Response(JSON.stringify({
        ...creditCheck.error,
        type: "credits_exhausted",
        plan: planKey,
        blocks,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2a. Hard cost cap — daily USD ceiling per plan ─────────────────────────
    // Independent safety net beyond credits. Protects the Anthropic account from
    // runaway spend (e.g. a prompt-injection loop or a misbehaving client).
    const costCap = await checkCostCap(supabase, user_id, effectivePlanKey);
    if (!costCap.allowed) {
      console.warn(`[ai-chat] Cost cap hit: user=${user_id} spent=$${costCap.spent_usd.toFixed(4)} cap=$${costCap.cap_usd}`);
      return capExceededResponse(costCap, corsHeaders);
    }

    // ── 2b. Detect "remember this" instructions — save before fetching context ──
    // Tolerante a typos: lemnre, lembr, lemb etc.
    const rememberTriggers =
      /(lemb?[rn]?e?(-se)?( de)?|quero que (voc[êe]|vc) (lembre|saiba|guarde)|n[ãa]o (esque[çc]a?|esquece)|sempre que|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|j[aá] te (falei|disse)|eu (j[aá] )?te (falei|disse))/i;
    if (rememberTriggers.test(message)) {
      // Extract what to remember — take the message minus trigger words
      const noteText = message
        .replace(/^(ei[,!]?\s*)?/i, "")
        .replace(
          /lembre(-se)?( de)?|quero que (você|vc) (lembre|saiba|guarde)|não (esqueça|esquece)|remember( that| this)?|keep in mind|note that|anota( que)?|guarda( que)?|já te (falei|disse)|eu (já )?te (falei|disse)/gi,
          "",
        )
        .replace(/[,:\s]+$/, "")
        .trim()
        .slice(0, 300);

      if (noteText.length > 5) {
        // Save to user_ai_profile.pain_point (reusing existing column for user notes)
        // Get current notes first
        const { data: existingProfile } = await (supabase as any)
          .from("user_ai_profile")
          .select("pain_point")
          .eq("user_id", user_id)
          .maybeSingle();

        const existing = (existingProfile?.pain_point as string) || "";
        const timestamp = new Date().toISOString().slice(0, 10);
        const newNote = `[${timestamp}] ${noteText}`;
        // Keep last 5 notes, separated by | — avoids unbounded growth
        const allNotes = existing
          ? [newNote, ...existing.split("|||").filter(Boolean)].slice(0, 5).join("|||")
          : newNote;

        await (supabase as any)
          .from("user_ai_profile")
          .upsert({ user_id, pain_point: allNotes, last_updated: new Date().toISOString() }, { onConflict: "user_id" });
      }
    }

    // ── 3. Fetch account data in parallel ─────────────────────────────────────
    const [
      { data: recentAnalyses },
      { data: aiProfile },
      { data: creativeMemory },
      { data: platformConns },
      { data: adsImports },
      { data: personaRow },
      { data: learnedPatterns },
      { data: globalBenchmarks },
      { data: marketSummaryRow },
      { data: dailySnapshots },
      { data: preflightHistory },
      { data: accountAlerts },
      { data: telegramConnection },
      { data: crossAccountPatterns },
      { data: chatMemories },
      { data: chatExamples },
      { data: activeTrends },
      { data: trendBaseline },
    ] = await Promise.all([
      // 1. Recent analyses — scoped to this persona/account (limit 5 for context size)
      persona_id
        ? (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status")
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(5)
        : (supabase.from("analyses" as any) as any)
            .select("id, created_at, title, result, hook_strength, status")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .is("persona_id", null)
            .order("created_at", { ascending: false })
            .limit(5),
      // 2. AI profile
      (supabase as any).from("user_ai_profile").select("*").eq("user_id", user_id).maybeSingle(),
      // 3. Creative memory (limit 10)
      (supabase as any)
        .from("creative_memory")
        .select("hook_type, hook_score, platform, notes, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(10),
      // 4. Platform connections — STRICT persona scope
      supabase
        .from("platform_connections" as any)
        .select("platform, status, ad_accounts, selected_account_id, connected_at, persona_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .then(async (r: any) => {
          if (r.error) {
            console.error("[adbrief-ai-chat] platformConns error:", r.error.code, r.error.message);
            if (r.error.code === "42P01") return { data: [], error: null };
          }
          const all = (r.data || []) as any[];
          if (persona_id) {
            const scoped = all.filter((c: any) => c.persona_id === persona_id);
            // Fallback: if no connection for this persona, try connections without persona_id
            if (scoped.length > 0) return { data: scoped };
            const global = all.filter((c: any) => !c.persona_id);
            return { data: global.length > 0 ? global : all.slice(0, 1) };
          }
          return { data: all.filter((c: any) => !c.persona_id) };
        }),
      // 5. Ads data imports
      (supabase as any)
        .from("ads_data_imports")
        .select("platform, result, created_at")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(3),
      // 6. Persona row — bring the full business context (name, site, description) so
      //    the AI never asks for what the user already configured.
      persona_id
        ? supabase.from("personas").select("result, name, website, description").eq("id", persona_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // 7. Learned patterns — STRICT persona scope (limit 20)
      persona_id
        ? (supabase as any)
            .from("learned_patterns")
            .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, persona_id")
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .order("confidence", { ascending: false })
            .limit(20)
        : (supabase as any)
            .from("learned_patterns")
            .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, persona_id")
            .eq("user_id", user_id)
            .order("confidence", { ascending: false })
            .limit(20),
      // 7b. Global benchmarks — limit 8 for context size
      (supabase as any)
        .from("learned_patterns")
        .select("pattern_key, avg_ctr, avg_roas, is_winner, confidence, insight_text")
        .is("user_id", null)
        .like("pattern_key", "global_benchmark::%")
        .gte("confidence", 0.3)
        .order("avg_ctr", { ascending: false })
        .limit(8)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 7c. Global market summary — synthesized narrative from aggregate-intelligence
      (supabase as any)
        .from("learned_patterns")
        .select("insight_text, variables")
        .is("user_id", null)
        .eq("pattern_key", "global_market_summary")
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
      // 8. Daily snapshots
      // 8. Daily snapshots — limit 3 for context size (was 7)
      persona_id
        ? (supabase as any)
            .from("daily_snapshots")
            .select(
              "date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr",
            )
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .order("date", { ascending: false })
            .limit(3)
        : (supabase as any)
            .from("daily_snapshots")
            .select(
              "date, account_name, total_spend, avg_ctr, active_ads, top_ads, ai_insight, yesterday_spend, yesterday_ctr",
            )
            .eq("user_id", user_id)
            .order("date", { ascending: false })
            .limit(3),
      // 9. Preflight history (limit 5)
      (supabase as any)
        .from("preflight_results")
        .select("created_at, score, verdict, platform, market, format")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 10. Active account alerts
      (supabase as any)
        .from("account_alerts")
        .select("type, urgency, ad_name, campaign_name, detail, kpi_label, kpi_value, action_suggestion, created_at")
        .eq("user_id", user_id)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(5)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 11. Telegram connection status
      (supabase as any)
        .from("telegram_connections")
        .select("chat_id, telegram_username, connected_at")
        .eq("user_id", user_id)
        .eq("active", true)
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
      // 11b. Cross-account winners — high confidence patterns from other personas
      (supabase as any)
        .from("learned_patterns")
        .select("pattern_key, is_winner, avg_ctr, avg_roas, confidence, insight_text, persona_id")
        .eq("user_id", user_id)
        .eq("is_winner", true)
        .gte("confidence", 0.7)
        .order("avg_ctr", { ascending: false })
        .limit(5)
        .then((r: any) =>
          r.error
            ? { data: [] }
            : {
                data: (r.data || []).filter((p: any) => p.persona_id !== persona_id),
              },
        ),
      // 12. Chat memory (limit 15 for context size)
      // STRICT persona isolation — never leak data between accounts/personas
      persona_id
        ? (supabase as any)
            .from("chat_memory")
            .select("memory_text, memory_type, importance")
            .eq("user_id", user_id)
            .eq("persona_id", persona_id)
            .order("importance", { ascending: false })
            .limit(15)
        : (supabase as any)
            .from("chat_memory")
            .select("memory_text, memory_type, importance")
            .eq("user_id", user_id)
            .is("persona_id", null)
            .order("importance", { ascending: false })
            .limit(15),
      // 13. Few-shot examples
      (supabase as any)
        .from("chat_examples")
        .select("user_message, assistant_blocks, quality_score, created_at")
        .eq("user_id", user_id)
        .then((r: any) => {
          if (r.error) return { data: [] };
          const all = (r.data || []) as any[];
          const scoped = persona_id
            ? all.filter((e: any) => e.persona_id === persona_id || !e.persona_id)
            : all.filter((e: any) => !e.persona_id);
          return { data: scoped.sort((a: any, b: any) => (b.quality_score || 0) - (a.quality_score || 0)).slice(0, 3) };
        }),
      // 15. Active trends (limit 5 for context size)
      (supabase as any)
        .from("trend_intelligence")
        .select("term,angle,ad_angle,niches,category,days_active,appearances,last_volume,peak_volume")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .lt("risk_score", 7)
        .order("last_volume", { ascending: false })
        .limit(5)
        .then((r: any) => (r.error ? { data: [] } : r)),
      // 16. Trend baseline
      (supabase as any)
        .from("trend_platform_baseline")
        .select("p75_volume,p90_volume")
        .eq("geo", "BR")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r: any) => (r.error ? { data: null } : r)),
    ]);
    _lap("db-queries-done");

    // ── 4. Build context ──────────────────────────────────────────────────────
    const analyses = (recentAnalyses || []) as any[];
    // creative_memory: scope to persona if available
    const allMemory = (creativeMemory || []) as any[];
    const memory = allMemory; // creative_memory doesn't have persona_id yet — use all, AI persona context prevents cross-contamination
    const connections = (platformConns || []) as any[];
    const imports = (adsImports || []) as any[];

    // chat_memory: strictly scoped per persona — no cross-account leaks
    // persona_id present → returns ONLY that persona's memories
    // no persona_id → returns ONLY global (null) memories
    const persistentMemories = (chatMemories || []) as any[];

    // few-shot examples: liked responses used as style/format guide
    const fewShotExamples = (chatExamples || []) as any[];
    const fewShotBlock = fewShotExamples.length
      ? fewShotExamples
          .map((ex: any, i: number) => {
            const blocks = Array.isArray(ex.assistant_blocks) ? ex.assistant_blocks : [];
            const responseText = blocks
              .map((b: any) => `${b.title ? `[${b.title}] ` : ""}${b.content || ""}`.trim())
              .filter(Boolean)
              .join(" / ")
              .slice(0, 300);
            return `Exemplo ${i + 1}:\n  Pergunta: "${String(ex.user_message || "").slice(0, 150)}"\n  Resposta aprovada: "${responseText}"`;
          })
          .join("\n\n")
      : null;
    const memorySummary = persistentMemories.length
      ? persistentMemories
          .sort((a: any, b: any) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 10)
          .map((m: any) => {
            const imp = (m.importance || 0) >= 5 ? "🔴" : (m.importance || 0) >= 4 ? "🟡" : "⚪";
            return `${imp} [${m.memory_type || "ctx"}] ${(m.memory_text || "").slice(0, 150)}`;
          })
          .join("\n")
      : null;

    const scores = analyses.map((a: any) => (a.result as any)?.hook_score).filter(Boolean) as number[];
    const avgScore = scores.length ? (scores.reduce((a: number, b: number) => a + b) / scores.length).toFixed(1) : null;

    const hookTypes: Record<string, { count: number; total: number }> = {};
    memory.forEach((m: any) => {
      if (!m.hook_type) return;
      if (!hookTypes[m.hook_type]) hookTypes[m.hook_type] = { count: 0, total: 0 };
      hookTypes[m.hook_type].count++;
      hookTypes[m.hook_type].total += m.hook_score || 0;
    });
    const topHooks = Object.entries(hookTypes)
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .slice(0, 3)
      .map(([type, d]) => `${type} (avg ${(d.total / d.count).toFixed(1)}, ${d.count} uses)`);

    const recentSummary = analyses
      .slice(0, 3)
      .map((a: any) => {
        try {
          const r = (a?.result as any) || {};
          return `  - "${(a?.title || r?.market_guess || "untitled").slice(0, 40)}" score:${r?.hook_score ?? "—"} hook:${r?.hook_type || a?.hook_strength || "—"} date:${a?.created_at?.split("T")[0] || "?"}`;
        } catch { return ""; }
      })
      .filter(Boolean)
      .join("\n");

    const connectedPlatforms = connections.map((c: any) => {
      const accounts = (c.ad_accounts as any[]) || [];
      const selectedId = c.selected_account_id || accounts[0]?.id;
      const selectedAcc = accounts.find((a: any) => a.id === selectedId) || accounts[0];
      const accLabel = selectedAcc ? `active:${selectedAcc.name || selectedAcc.id}` : `${accounts.length} accounts`;
      return `${c.platform}(${accLabel})`;
    });

    // Extract business goal if set
    const businessGoal = (aiProfile as any)?.ai_recommendations?.business_goal || null;

    // ── Load user-defined account goal (Conversion Intelligence) ──
    let accountGoal:
      | {
          objective: string;
          primary_metric: string;
          conversion_event: string;
          target_value: number | null;
          profit_margin_pct: number | null;
        }
      | null = null;
    try {
      const metaConn = (platformConns || []).find((c: any) => c.platform === "meta" && c.ad_accounts?.length);
      if (metaConn) {
        const accs = (metaConn.ad_accounts || []) as any[];
        const selId = metaConn.selected_account_id || accs[0]?.id;
        if (selId) {
          const { data: goalRow } = await (supabase as any)
            .from("ad_accounts")
            .select(
              "goal_objective, goal_primary_metric, goal_conversion_event, goal_target_value, profit_margin_pct",
            )
            .eq("user_id", user_id)
            .eq("meta_account_id", String(selId).replace("act_", ""))
            .maybeSingle();
          if (goalRow?.goal_objective) {
            accountGoal = {
              objective: goalRow.goal_objective,
              primary_metric: goalRow.goal_primary_metric,
              conversion_event: goalRow.goal_conversion_event,
              target_value: goalRow.goal_target_value,
              profit_margin_pct: goalRow.profit_margin_pct ?? null,
            };
          }
        }
      }
    } catch (e) { console.error("[adbrief-ai-chat] accountGoal load error:", e); }

    const persona = personaRow as any;
    // Business-level fields live on the persona row itself (top-level columns),
    // while audience/tone/etc live inside `result`.
    const personaBusinessName = persona?.name || (persona?.result as any)?.name || "";
    const personaSite = (persona?.website || "").trim();
    const personaDescription = (persona?.description || "").trim();
    const personaName = personaBusinessName;
    const personaCtx = persona?.result
      ? `ACTIVE WORKSPACE: ${personaName} | ${(persona.result as any)?.headline || ""}
Market: ${(persona.result as any)?.preferred_market || "unknown"} | Age: ${(persona.result as any)?.age || "—"}
Platforms: ${((persona.result as any)?.best_platforms || []).join(", ")}
Language style: ${(persona.result as any)?.language_style || "—"}`
      : persona?.name
      ? `ACTIVE WORKSPACE: ${personaName}`
      : "";

    // ── USER DEFAULTS ──────────────────────────────────────────────────────────
    // Single source-of-truth block. The AI must read this BEFORE asking clarifying
    // questions about objective, target CPA/ROAS, margin, or landing page.
    const defaultsBlock = (() => {
      const hasGoal = !!accountGoal;
      const hasSite = !!personaSite;
      const hasMargin = accountGoal?.profit_margin_pct != null;
      if (!hasGoal && !hasSite && !hasMargin && !personaDescription) return "";

      const lines: string[] = [];
      lines.push("=== DADOS JÁ CONFIGURADOS PELO USUÁRIO — NÃO PERGUNTE DE NOVO ===");
      if (personaBusinessName) lines.push(`Negócio: ${personaBusinessName}`);
      if (personaSite) lines.push(`Site/Landing Page configurada: ${personaSite.startsWith("http") ? personaSite : `https://${personaSite}`}`);
      if (personaDescription) lines.push(`Descrição: ${personaDescription.slice(0, 200)}`);
      if (accountGoal) {
        const objLabel =
          accountGoal.objective === "leads"
            ? "Gerar leads/cadastros"
            : accountGoal.objective === "sales"
            ? "Vendas/E-commerce"
            : accountGoal.objective === "traffic"
            ? "Tráfego/Visitas"
            : accountGoal.objective;
        lines.push(`Objetivo: ${objLabel}`);
        lines.push(`Métrica principal: ${accountGoal.primary_metric.toUpperCase()}`);
        lines.push(`Evento de conversão: ${accountGoal.conversion_event}`);
        if (accountGoal.target_value != null) {
          const target =
            accountGoal.primary_metric === "roas"
              ? `${(accountGoal.target_value / 10000).toFixed(2)}x ROAS`
              : `R$${(accountGoal.target_value / 100).toFixed(2)} ${accountGoal.primary_metric.toUpperCase()}`;
          lines.push(`Meta definida: ${target}`);
        }
      }
      if (accountGoal?.profit_margin_pct != null) {
        lines.push(`Margem de lucro: ${accountGoal.profit_margin_pct}% (usa isso pra calcular ROAS mínimo e custo máximo aceitável por conversão)`);
      }
      lines.push(
        "REGRA: Esses campos JÁ ESTÃO CONFIGURADOS. NUNCA pergunte 'qual é o objetivo?', 'qual o CPA alvo?', 'qual sua margem?', 'qual a landing?'. Use os valores acima como verdade. Se o usuário quiser analisar outra LP, ele vai colar o link — até lá, assuma a configurada.",
      );
      return lines.join("\n");
    })();

    const importInsights = imports
      .map((i: any) => {
        const r = i.result as any;
        if (!r?.summary) return "";
        return `${i.platform}: ${r.summary} | best format: ${r.patterns?.best_format || "?"} | best hook: ${r.patterns?.best_hook_style || "?"}`;
      })
      .filter(Boolean)
      .join("\n");

    // Learned patterns — what the product knows about this user
    // Scope patterns to this persona — prefer persona-specific, include global (null persona_id), exclude other personas
    const allRawPatterns = (learnedPatterns || []) as any[];
    const patterns = persona_id
      ? allRawPatterns.filter((p: any) => p.persona_id === persona_id || p.persona_id === null).slice(0, 15)
      : allRawPatterns.filter((p: any) => p.persona_id === null).slice(0, 15);
    // CRITICAL: limit each category to max 3 for context size
    const winners = patterns.filter((p) => p.is_winner && p.confidence > 0.2).slice(0, 3);
    const businessProfile = patterns.find((p) => p.pattern_key?.startsWith("business_profile_")) || null;
    const competitors = patterns.filter((p) => p.pattern_key?.startsWith("competitor_")).slice(0, 3);
    const perfPatterns = patterns.filter((p) => p.pattern_key?.startsWith("perf_")).slice(0, 3);
    const preflightPatterns = patterns.filter((p) => p.pattern_key?.startsWith("preflight_")).slice(0, 2);
    const actionPatterns = patterns.filter((p) => p.pattern_key?.startsWith("action_")).slice(0, 2);
    const marketPatterns = patterns
      .filter((p) => p.pattern_key?.startsWith("market_intel_") || p.pattern_key?.startsWith("market_competitor_"))
      .slice(0, 5);
    const latestMarket = marketPatterns.find((p) => p.pattern_key?.startsWith("market_intel_")) || null;
    const competitorSignals = marketPatterns.filter((p) => p.pattern_key?.startsWith("market_competitor_")).slice(0, 3);

    // ── Trend intelligence — já carregado no Promise.all acima ──────────────
    let trendContext = "";
    try {
      const trendsData = (activeTrends || []) as any[];
      if (trendsData.length > 0) {
        // Use calibrated defaults for Brave Search volumes (50-70 range)
        // Matches the scoring in trend-watcher/index.ts
        const p75 = (trendBaseline as any)?.p75_volume || 55;
        const p90 = (trendBaseline as any)?.p90_volume || 65;
        const scored = trendsData
          .map((t: any) => {
            let score = 0;
            // Volume score — calibrated for Brave Search output
            if (t.last_volume >= p90) score += 40;
            else if (t.last_volume >= p75) score += 28;
            else if (t.last_volume >= 45) score += 15;
            else score += 5;
            // Longevity — most valuable signal
            if (t.days_active >= 5) score += 30;
            else if (t.days_active >= 3) score += 22;
            else if (t.days_active >= 2) score += 14;
            else score += 6; // day 1 still counts
            // Return appearances — trend durability
            if (t.appearances >= 4) score += 20;
            else if (t.appearances >= 2) score += 14;
            else score += 4;
            // Peak bonus
            if (t.peak_volume >= p90) score += 8;
            return { ...t, relevance_score: Math.min(score, 100) };
          })
          .sort((a: any, b: any) => b.relevance_score - a.relevance_score);
        // Infer STRUCTURAL format from the trend's term + angle, so
        // Claude can actually apply it as architecture (not flavor).
        // Without this, trends like "2026 é o novo 2016" read as
        // "mention 2016 somewhere" instead of "structure the video as
        // before/after split 2016 vs 2026." Pure heuristics over the
        // text we already have — no new DB columns required.
        const inferTrendFormat = (t: any): { format: string; howToUse: string } => {
          const blob = `${t.term || ""} ${t.angle || ""} ${t.ad_angle || ""}`.toLowerCase();
          // Before/after, nostalgia split-screen — e.g. "2026 é o novo
          // 2016", "antes vs depois", "X virou Y"
          if (/\b(antes\s+vs\s+depois|passado\s+vs|vs\s+agora|é\s+o\s+novo|virou\s+o\s+novo|anos?\s+\d{4}.*\d{4}|nostalg)/i.test(blob)
              || /\b(20\d\d).*(20\d\d)\b/.test(blob)) {
            return {
              format: "split_screen_before_after",
              howToUse: "Estruture em 2 blocos explícitos: 'antes' (tom + visual antigo) × 'agora' (tom + visual novo). NÃO mencione a trend só por citação — faça o formato aparecer na edição (sépia/filtro vs limpo, música retrô vs atual, texto ANTES/AGORA na tela).",
            };
          }
          // Music/audio-driven trends — e.g. "Hits do TikTok", "trending audio"
          if (/\b(hit|música|musica|trilha|áudio|audio|som\s+viral|trending\s+sound|beat)/i.test(blob)) {
            return {
              format: "music_sync",
              howToUse: "O áudio É a estrutura. Sincronize cortes e on-screen com os beats/drops do som viral. Hook visual nos primeiros 0.5s deve bater com a primeira batida. Sem o som não existe o formato.",
            };
          }
          // Challenge / participation trends
          if (/\b(desafio|challenge|trend\s+de\s+dança|coreografia)/i.test(blob)) {
            return {
              format: "challenge_participation",
              howToUse: "O formato exige participação visível do usuário no challenge em si (imitar a ação, dança, gesto). Marca aparece como contexto/pano-de-fundo, não narração.",
            };
          }
          // POV / first-person storytelling trend
          if (/\b(pov|point\s+of\s+view|perspectiva)/i.test(blob)) {
            return {
              format: "pov_first_person",
              howToUse: "Tudo filmado em 1ª pessoa. Texto on-screen começa com 'POV:'. A marca entra como elemento do ambiente do POV, não como pitch.",
            };
          }
          // Storytelling / narrative trend
          if (/\b(história|story|depoiment|relato|confiss)/i.test(blob)) {
            return {
              format: "storytelling",
              howToUse: "Estrutura narrativa em 3 atos: gancho pessoal (1-2s) → conflito (midsection) → resolução com a marca. Voz em 1ª pessoa, não 3ª.",
            };
          }
          // Meme / humor trend — hard to enforce format, use format as vibe
          if (/\b(meme|piada|humor|engraç|zoeir)/i.test(blob)) {
            return {
              format: "meme_humor",
              howToUse: "Formato depende do meme específico. Identifique o gatilho cômico (reação, frase, gesto) e replique literalmente — o meme não funciona se você só 'mencionar que é meme'.",
            };
          }
          // Default: no clear structural format — use as creative angle only
          return {
            format: "thematic",
            howToUse: "Use como referência temática/de copy, não como estrutura forçada.",
          };
        };

        trendContext =
          `=== TRENDS ATIVAS NO BRASIL HOJE ===\n` +
          `(Baseline: normal=${p75}, viral>=${p90})\n` +
          scored
            .map((t: any) => {
              const fmt = inferTrendFormat(t);
              return (
                `• "${t.term}" [${t.category}] — ${t.angle} | Score: ${t.relevance_score}/100` +
                (t.appearances > 1 ? ` | 🔄 voltou ${t.appearances}x` : "") +
                (t.days_active > 1 ? ` | ${t.days_active} dias ativa` : "") +
                `\n  → Ângulo criativo: ${t.ad_angle}` +
                (t.niches?.length ? `\n  → Nichos: ${t.niches.join(", ")}` : "") +
                `\n  → FORMATO (${fmt.format}): ${fmt.howToUse}`
              );
            })
            .join("\n") +
          `\n\nREGRA DE USO DE TREND EM SCRIPT/HOOK:\n` +
          `Quando o usuário pedir roteiro, hook ou criativo E houver trend com format ≠ 'thematic' acima:\n` +
          `  • Pelo menos UM dos scripts DEVE seguir o FORMATO da trend top (não só o tema).\n` +
          `  • "Seguir o formato" = replicar a estrutura (split-screen, sync com áudio, POV, etc.), não citar a trend na copy.\n` +
          `  • Se a trend for split_screen_before_after, a cena 1 é o ANTES e a cena 2 é o DEPOIS — literal, não metafórico.\n` +
          `  • Se o usuário NÃO pediu roteiro/hook, só mencione a trend proativamente quando score >= 80.`;
      }
    } catch (trendErr) {
      console.error("[trend-ctx error]", String(trendErr));
    }

    // ── PATTERN-LOCK: patterns are the primary decision engine ──
    // When patterns exist, they MUST be the foundation of all advice
    const hasPatterns = winners.length > 0 || perfPatterns.length > 0;

    const learnedCtx = [
      // PATTERN PRIORITY BLOCK — must be first in context
      hasPatterns
        ? `═══════════════════════════════════
PADRÕES DA CONTA — PRIORIDADE MÁXIMA
═══════════════════════════════════
REGRA: Padrões detectados são a BASE de toda recomendação.
- Toda sugestão de hook, criativo, copy ou estratégia DEVE referenciar um padrão.
- NUNCA dê conselho genérico quando há padrões disponíveis.
- Formato obrigatório: cite o padrão, explique o porquê, recomende ação.
- Se o usuário pedir algo que contradiz um padrão: avise antes de prosseguir.

PREVISÕES — regras obrigatórias:
- Toda recomendação DEVE incluir uma previsão baseada em dados reais.
- Formato: "CTR atual: X% → Esperado: Y% (+Z%). Impacto estimado: +R$X/mês"
- NUNCA invente números. Use os dados dos padrões (avg_ctr, sample_size, confidence).
- Sempre mostre: baseline → esperado → impacto financeiro → confiança → base de dados.
- Se a confiança for baixa, diga: "Previsão com confiança baixa — X ads analisados"
═══════════════════════════════════`
        : `═══════════════════════════════════
SEM PADRÕES FORTES DETECTADOS
═══════════════════════════════════
Esta conta ainda não tem padrões validados com dados suficientes.
- Seja honesto: "Ainda não há dados suficientes para gerar previsões confiáveis."
- NÃO invente padrões, previsões, ou dê conselhos genéricos como se fossem da conta.
- Trabalhe com os dados reais disponíveis, sem extrapolar.
- NUNCA inclua estimativas financeiras sem base em dados reais.
═══════════════════════════════════`,
      winners.length
        ? `PADRÕES VENCEDORES:\n${winners
            .map((p) => {
              const confPct = ((p.confidence || 0) * 100);
              // Rotulagem que o usuário vê na UI (AdBriefAI.tsx). Incluído
              // aqui pra Claude reconhecer o padrão quando o usuário citar
              // "Sinal inicial detectado" / "Padrão emergente" etc.
              const uiLabel = confPct >= 40
                ? '[UI: "PADRÃO APRENDIDO"]'
                : '[UI: "PADRÃO EMERGENTE — Sinal inicial detectado"]';
              // If the pattern_key is the machine-style deviation key,
              // surface the ad name that IS in insight_text so Claude can
              // speak about "that ad" naturally.
              const adHint = (p.pattern_key || "").startsWith("persona:") && (p.pattern_key || "").includes(":deviation:")
                ? " [tipo: winner emergente de ad individual no conjunto]"
                : "";
              return `  ✓ ${uiLabel}${adHint} ${(p.insight_text || "").slice(0, 200)} (conf: ${confPct.toFixed(0)}%)`;
            })
            .join("\n")}

CONVENÇÃO DE ROTULAGEM NA UI — o usuário vê estes termos, você precisa reconhecê-los:
  • "Padrão aprendido" / "LEARNED PATTERN" = padrão com confiança ≥ 40% (validado)
  • "Padrão emergente" / "EMERGING PATTERN" / "Sinal inicial detectado" / "early signal" = padrão com confiança < 40% (preliminar, amostra pequena)
  • "Winner emergente: <ad>" / "Underperformer: <ad>" = padrão de desvio de um ad individual vs a média do conjunto dele
Quando o usuário se referir a qualquer desses termos, ele tá falando de um dos padrões listados acima. Não responda "não é uma coisa real" — é real, mas é sinal preliminar. Valide com os dados acima e responda direto.`
        : "",
      perfPatterns.length
        ? `PERFORMANCE:\n${perfPatterns
            .map((p) => `  - ${(p.insight_text || "").slice(0, 100)}`)
            .join("\n")}`
        : "",
      competitors.length
        ? `CONCORRENTES:\n${competitors
            .map((p) => `  - ${(p.insight_text || "").slice(0, 100)}`)
            .join("\n")}`
        : "",
      preflightPatterns.length
        ? `PREFLIGHT:\n${preflightPatterns
            .map((p) => `  - ${(p.insight_text || "").slice(0, 80)}`)
            .join("\n")}`
        : "",
      actionPatterns.length
        ? `AÇÕES:\n${actionPatterns
            .map((p) => `  - ${(p.insight_text || "").slice(0, 80)}`)
            .join("\n")}`
        : "",
      // Global benchmarks — limit 5 lines for context size
      (() => {
        try {
          const globals = (globalBenchmarks || []) as any[];
          if (!globals.length) return "";
          const relevant = globals.slice(0, 5);
          const summary = (marketSummaryRow as any)?.insight_text || "";
          const lines = relevant
            .map((g) => `  - ${(g.insight_text || "").slice(0, 100)}${g.avg_ctr ? ` (CTR ${(g.avg_ctr * 100).toFixed(2)}%)` : ""}`)
            .join("\n");
          return `BENCHMARKS DO SETOR:\n${summary ? `${summary.slice(0, 150)}\n` : ""}${lines}`;
        } catch { return ""; }
      })(),
      // Business profile — simplified, no auto-generated compliance rules
      businessProfile
        ? `=== PERFIL DO NEGÓCIO ===\n` +
          `Indústria: ${(businessProfile.variables as any)?.industry || "não definida"}\n` +
          `Oportunidades: ${((businessProfile.variables as any)?.marketing_opportunities || []).slice(0, 2).join(" | ") || "a descobrir"}`
        : "",
      // Real-time market context — Google Trends + Meta Ads Library
      latestMarket
        ? `=== CONTEXTO DE MERCADO (${(latestMarket.variables as any)?.fetched_at?.slice(0, 10) || "hoje"}) ===\n` +
          `${latestMarket.insight_text}\n` +
          `Ação recomendada: ${(latestMarket.variables as any)?.action || ""}\n` +
          `Concorrentes ativos: ${(latestMarket.variables as any)?.competitor_count || 0} | Formatos dominantes: ${((latestMarket.variables as any)?.top_competitor_formats || []).join(", ")}`
        : "",
      competitorSignals.length
        ? `CONCORRENTES NO AR AGORA (Meta Ads Library):\n${competitorSignals.map((p) => `  - ${p.insight_text}`).join("\n")}`
        : "",
      trendContext || "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ── 4b. Fetch live Meta Ads data (with historical date detection) ──────────
    // Detect if user is asking about a specific historical period
    const historicalMatch = message.match(
      /(?:em|in|de|desde|from|between|entre|no mês de|no dia|week of|semana de)?\s*(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\s*(?:de\s*)?(?:20\d{2})?|(?:\d{1,2})[\/\-](?:\d{1,2})(?:[\/\-](?:20)?\d{2,4})?|(?:last|[uú]ltim[ao]s?|past|nos\s+[uú]ltim[ao]s?)\s+(?:\d+)\s+(?:days?|dias?|weeks?|semanas?|months?|meses?)|(?:esta|essa|this)\s+(?:semana|week)|(?:semana|week)\s+(?:passada|last)|(?:ontem|yesterday|hoje|today|this week|esta semana)/i,
    );
    let historicalSince: string | null = null;
    let historicalUntil: string | null = null;

    if (historicalMatch) {
      try {
        const matched = historicalMatch[0].toLowerCase();
        const now = new Date();
        const MONTHS_PT: Record<string, number> = {
          janeiro: 0,
          fevereiro: 1,
          março: 2,
          abril: 3,
          maio: 4,
          junho: 5,
          julho: 6,
          agosto: 7,
          setembro: 8,
          outubro: 9,
          novembro: 10,
          dezembro: 11,
          january: 0,
          february: 1,
          march: 2,
          april: 3,
          may: 4,
          june: 5,
          july: 6,
          august: 7,
          september: 8,
          october: 9,
          november: 10,
          december: 11,
        };
        // Month name match (e.g. "janeiro", "março de 2024")
        const monthMatch = matched.match(
          /(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)/,
        );
        if (monthMatch) {
          const yearMatch = matched.match(/20(\d{2})/);
          const year = yearMatch ? parseInt("20" + yearMatch[1]) : now.getFullYear();
          const month = MONTHS_PT[monthMatch[1]];
          historicalSince = new Date(year, month, 1).toISOString().split("T")[0];
          historicalUntil = new Date(year, month + 1, 0).toISOString().split("T")[0];
        }
        // "last N days/weeks/months" or "últimos N dias"
        const relMatch = matched.match(/(\d+)\s*(day|dia|week|semana|month|mes)/);
        if (relMatch) {
          const n = parseInt(relMatch[1]);
          const unit = relMatch[2];
          const ms =
            unit.startsWith("day") || unit.startsWith("dia")
              ? n * 86400000
              : unit.startsWith("week") || unit.startsWith("seman")
                ? n * 7 * 86400000
                : n * 30 * 86400000;
          historicalSince = new Date(Date.now() - ms).toISOString().split("T")[0];
          historicalUntil = new Date().toISOString().split("T")[0];
        }
        // "esta semana" / "this week" — last 7 days
        if (!historicalSince && /(?:esta|essa|this)\s*(?:semana|week)/i.test(matched)) {
          historicalSince = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
          historicalUntil = new Date().toISOString().split("T")[0];
        }
        // "semana passada" / "last week" — 14 to 7 days ago
        if (!historicalSince && /(?:semana|week)\s*(?:passada|last)/i.test(matched)) {
          historicalSince = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
          historicalUntil = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        }
        // "hoje" / "today" — today only
        if (!historicalSince && /(?:hoje|today)/i.test(matched)) {
          historicalSince = new Date().toISOString().split("T")[0];
          historicalUntil = new Date().toISOString().split("T")[0];
        }
        // "ontem" / "yesterday" — yesterday only
        if (!historicalSince && /(?:ontem|yesterday)/i.test(matched)) {
          historicalSince = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          historicalUntil = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        }
        // Always respect the user's requested period — even short ones like "7 days"
        // Previously we discarded <=32 days but that caused wrong data when user asks about 7 days
      } catch (_) {
        historicalSince = null;
        historicalUntil = null;
      }
    }

    let liveMetaData = "";
    const metaConn = (connections as any[]).find((c: any) => c.platform === "meta");
    if (metaConn) {
      try {
        const { data: allConns } = await supabase
          .from("platform_connections" as any)
          .select("access_token, ad_accounts, selected_account_id, persona_id")
          .eq("user_id", user_id)
          .eq("platform", "meta")
          .eq("status", "active");
        const allC = (allConns as any[]) || [];
        // Find connection: first try exact persona match, then fallback to any active connection
        const tokenRow = persona_id
          ? allC.find((c: any) => c.persona_id === persona_id) ||
            allC.find((c: any) => !c.persona_id) ||
            allC[0] ||
            null
          : allC[0] || null;

        if (tokenRow?.access_token) {
          const token = tokenRow.access_token;
          const accs = (tokenRow.ad_accounts as any[]) || [];
          // Use account_id from frontend (localStorage selection) over DB value
          const selId = (body.account_id as string) || tokenRow.selected_account_id;
          const activeAcc = (selId && accs.find((a: any) => a.id === selId)) || accs[0];

          if (activeAcc?.id) {
            // Default: 30 days (aligned with Live Panel's default). historicalSince overrides.
            const since = historicalSince || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0];
            const until = historicalUntil || new Date().toISOString().split("T")[0];
            // Lifetime since (for all-time top performers)
            const lifetimeSince = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString().split("T")[0];

            // ── Two-tier cache (15 min) ──────────────────────────────────────
            // Level 1: in-memory per edge-fn instance. Fastest — zero DB hit.
            //   Evicts expired keys on each write. Frail across cold starts.
            // Level 2: ai_context_cache table. Persistent, survives cold
            //   starts and different edge-fn instances. ~1 DB round-trip on
            //   miss.
            // Level 3 fallback: Meta Graph API (expensive, rate-limited).
            //
            // Why bother with both: an agency-scale account running ~10
            // chats per session would otherwise pay 10x the Meta API budget
            // and 10x the token cost on repeated context — for data that
            // doesn't meaningfully change in 15 minutes.
            const cacheKey = `${activeAcc.id}:${since}:${until}`;
            const dbCacheKey = `${user_id}:${cacheKey}`;
            const now_ts = Date.now();
            const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
            if (!(globalThis as any).__metaCache) (globalThis as any).__metaCache = {};
            const cached = (globalThis as any).__metaCache[cacheKey];
            let adsRaw: any = null,
              campsRaw: any = null,
              adsetsRaw: any = null,
              timeSeriesRaw: any = null,
              placementRaw: any = null,
              lifetimeAdsRaw: any = null;

            let cacheHitSource: "memory" | "db" | "miss" = "miss";

            if (cached && now_ts - cached.ts < CACHE_TTL) {
              adsRaw = cached.adsRaw;
              campsRaw = cached.campsRaw;
              adsetsRaw = cached.adsetsRaw;
              timeSeriesRaw = cached.timeSeriesRaw;
              placementRaw = cached.placementRaw;
              lifetimeAdsRaw = cached.lifetimeAdsRaw;
              cacheHitSource = "memory";
            } else {
              // Miss in-memory — try DB cache before hitting Meta.
              try {
                const { data: dbCached } = await supabase
                  .from("ai_context_cache" as any)
                  .select("data, checked_at")
                  .eq("cache_key", dbCacheKey)
                  .maybeSingle();
                if (dbCached?.checked_at) {
                  const age = now_ts - new Date(dbCached.checked_at).getTime();
                  if (age < CACHE_TTL && dbCached.data) {
                    const d: any = dbCached.data;
                    adsRaw = d.adsRaw ?? null;
                    campsRaw = d.campsRaw ?? null;
                    adsetsRaw = d.adsetsRaw ?? null;
                    timeSeriesRaw = d.timeSeriesRaw ?? null;
                    placementRaw = d.placementRaw ?? null;
                    lifetimeAdsRaw = d.lifetimeAdsRaw ?? null;
                    // Warm the in-memory tier so sibling requests in the same
                    // instance don't repeat the DB round-trip.
                    (globalThis as any).__metaCache[cacheKey] = {
                      ts: now_ts,
                      adsRaw, campsRaw, adsetsRaw, timeSeriesRaw, placementRaw, lifetimeAdsRaw,
                    };
                    cacheHitSource = "db";
                    _lap("meta-cache-db-hit");
                  }
                }
              } catch { /* table may not exist yet — proceed to fetch */ }
            }

            if (cacheHitSource === "miss") {
              // Comprehensive Meta Ads data fetch: period-aware + lifetime top performers
              const fields =
                "campaign_name,adset_name,ad_name,spend,impressions,clicks,ctr,cpm,cpc,actions,video_play_actions,frequency";
              // Time series granularity: daily for <=31 days, monthly for longer
              const periodDays = Math.round((new Date(until).getTime() - new Date(since).getTime()) / 86400000) + 1;
              const timeIncrement = periodDays <= 31 ? "1" : "monthly";
              const timeSeriesLimit = periodDays <= 31 ? periodDays : 6;
              // Limits raised from 25/30/20/15 → 100/100/50/50 to support
              // agency-scale accounts. Previously top-25-by-spend was hiding
              // long-tail campaigns (fresh tests, paused gems) from analysis.
              // Each call wrapped in retry-with-backoff so transient 429s
              // from Meta don't blank out a data slice silently.
              const [r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
                // Ad insights for period
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=100&access_token=${token}`,
                ),
                // Campaigns
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/campaigns?fields=name,status,daily_budget,lifetime_budget,objective,effective_status&limit=100&access_token=${token}`,
                ),
                // Adsets
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/adsets?fields=name,status,effective_status,daily_budget,optimization_goal&limit=50&access_token=${token}`,
                ),
                // Time series — daily or monthly depending on period
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&time_range={"since":"${since}","until":"${until}"}&time_increment=${timeIncrement}&limit=${timeSeriesLimit}&access_token=${token}`,
                ),
                // Placement breakdown
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?fields=spend,impressions,clicks,ctr,cpm&breakdowns=publisher_platform,platform_position&time_range={"since":"${since}","until":"${until}"}&sort=spend_descending&limit=10&access_token=${token}`,
                ),
                // Lifetime top ads
                fetchMetaWithRetry(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/insights?level=ad&fields=${fields}&time_range={"since":"${lifetimeSince}","until":"${until}"}&sort=spend_descending&limit=50&access_token=${token}`,
                ),
              ]);
              adsRaw = r1.status === "fulfilled" ? await r1.value.json() : null;
              campsRaw = r2.status === "fulfilled" ? await r2.value.json() : null;
              adsetsRaw = r3.status === "fulfilled" ? await r3.value.json() : null;
              timeSeriesRaw = r4.status === "fulfilled" ? await r4.value.json() : null;
              placementRaw = r5.status === "fulfilled" ? await r5.value.json() : null;
              lifetimeAdsRaw = r6.status === "fulfilled" ? await r6.value.json() : null;

              _lap("meta-api-done");
              // Write-through to both cache tiers.
              const metaCache = (globalThis as any).__metaCache;
              // Evict stale in-memory entries to prevent unbounded growth.
              for (const k of Object.keys(metaCache)) {
                if (now_ts - metaCache[k].ts >= CACHE_TTL) delete metaCache[k];
              }
              metaCache[cacheKey] = {
                ts: now_ts,
                adsRaw, campsRaw, adsetsRaw, timeSeriesRaw, placementRaw, lifetimeAdsRaw,
              };
              // Persist to DB (best-effort — never blocks the response).
              try {
                await supabase.from("ai_context_cache" as any).upsert({
                  cache_key: dbCacheKey,
                  user_id,
                  meta_account_id: activeAcc.id,
                  persona_id: persona_id || null,
                  data: { adsRaw, campsRaw, adsetsRaw, timeSeriesRaw, placementRaw, lifetimeAdsRaw, schema_version: 1 },
                  checked_at: new Date().toISOString(),
                } as any, { onConflict: "cache_key" });
              } catch { /* DB cache write failed — in-memory still works */ }
            }

            // ── Pixel detection (lightweight, cached separately) ──
            let pixelInfo = "";
            try {
              const pixelCacheKey = `pixel:${activeAcc.id}`;
              const cachedPixel = (globalThis as any).__metaCache?.[pixelCacheKey];
              if (cachedPixel && now_ts - cachedPixel.ts < CACHE_TTL) {
                pixelInfo = cachedPixel.info;
              } else {
                const pixelRes = await fetch(
                  `https://graph.facebook.com/v21.0/${activeAcc.id}/adspixels?fields=id,name,last_fired_time,is_created_by_business&limit=5&access_token=${token}`
                );
                const pixelData = await pixelRes.json();
                if (pixelData?.data?.length) {
                  const pixels = pixelData.data.map((p: any) =>
                    `Pixel "${p.name}" (ID: ${p.id})${p.last_fired_time ? ` — último disparo: ${p.last_fired_time}` : " — NUNCA disparou"}`
                  ).join("; ");
                  pixelInfo = `PIXELS INSTALADOS: ${pixels}`;
                } else {
                  pixelInfo = "PIXELS: Nenhum pixel encontrado nesta conta. O usuário PRECISA criar e instalar um pixel para rastrear conversões no site.";
                }
                if (!(globalThis as any).__metaCache) (globalThis as any).__metaCache = {};
                (globalThis as any).__metaCache[pixelCacheKey] = { ts: now_ts, info: pixelInfo };
              }
            } catch { pixelInfo = ""; }

            // ── Pixel health cache (richer diagnostic — orphan ads, last fired, etc.) ──
            // Supplements the live fetch above with the structured result
            // produced by the pixel-health-check edge function.
            let pixelHealthBlock = "";
            try {
              const { data: phc } = await supabase
                .from("pixel_health_cache")
                .select("status, pixels, primary_pixel_id, last_fired_at, orphan_ads_count, active_ads_checked, message, checked_at, error")
                .eq("user_id", user_id)
                .eq("ad_account_id", activeAcc.id)
                .maybeSingle();
              if (phc) {
                const statusEmoji: Record<string, string> = {
                  pixel_ok: "🟢",
                  pixel_stale: "🟡",
                  pixel_orphan: "🟡",
                  no_pixel: "🔴",
                  unknown: "⚪",
                };
                const emoji = statusEmoji[phc.status as string] || "⚪";
                const lastFired = phc.last_fired_at
                  ? new Date(phc.last_fired_at).toLocaleString("pt-BR")
                  : "nunca";
                const orphanLine =
                  typeof phc.orphan_ads_count === "number" && typeof phc.active_ads_checked === "number"
                    ? `  - Ads órfãos (ativos sem pixel amarrado): ${phc.orphan_ads_count} de ${phc.active_ads_checked} verificados`
                    : "";
                const messageLine = phc.message ? `  - Diagnóstico: ${phc.message}` : "";
                const errorLine = phc.error ? `  - Erro no health-check: ${phc.error.slice(0, 200)}` : "";
                const pixelsList = Array.isArray(phc.pixels) && phc.pixels.length
                  ? phc.pixels
                      .slice(0, 5)
                      .map((p: any) => `"${p.name || p.id}" (ID ${p.id})${p.last_fired_time ? ` — último disparo ${p.last_fired_time}` : ""}`)
                      .join("; ")
                  : "—";
                pixelHealthBlock = `PIXEL HEALTH (diagnóstico estruturado): ${emoji} status=${phc.status}
  - Pixels detectados: ${pixelsList}
  - Pixel principal: ${phc.primary_pixel_id || "—"}
  - Último disparo do pixel principal: ${lastFired}
${orphanLine}
${messageLine}
${errorLine}
  - Verificado em: ${new Date(phc.checked_at as string).toLocaleString("pt-BR")}`;
              }
            } catch { /* optional — table may not exist yet on this env */ }

            liveMetaData = `${historicalSince ? "HISTORICAL" : "LIVE"} META ADS — Account: ${activeAcc.name || activeAcc.id} (${since} to ${until})${historicalSince ? " [período solicitado]" : ""}\n`;
            if (pixelInfo) liveMetaData += pixelInfo + "\n";
            if (pixelHealthBlock) liveMetaData += pixelHealthBlock + "\n";

            // Campaigns
            if (campsRaw?.error) {
              const isExpired =
                campsRaw.error.code === 190 || String(campsRaw.error.type || "").includes("OAuthException");
              liveMetaData += isExpired
                ? `CAMPAIGNS: Token expirado — peça ao usuário para reconectar o Meta Ads em Contas. NÃO emita tool_call.\n`
                : `CAMPAIGNS: Error — ${campsRaw.error.message}. Answer based on this error, do NOT emit list_campaigns tool_call.\n`;
            } else if (campsRaw?.data?.length) {
              // Sort: ACTIVE campaigns FIRST, then paused/archived. The AI
              // should focus on what's running. Paused campaigns are noise
              // unless the user explicitly asks about them.
              const isActiveStatus = (s: string) =>
                String(s || "").toUpperCase() === "ACTIVE";
              const sorted = [...campsRaw.data].sort((a: any, b: any) => {
                const aActive = isActiveStatus(a.effective_status || a.status) ? 0 : 1;
                const bActive = isActiveStatus(b.effective_status || b.status) ? 0 : 1;
                return aActive - bActive;
              });
              const activeCount = sorted.filter((c: any) =>
                isActiveStatus(c.effective_status || c.status),
              ).length;
              const lines = sorted
                .slice(0, 15)
                .map(
                  (c: any) =>
                    `  [${c.id}] ${c.name}: ${c.effective_status || c.status} | budget=${c.daily_budget ? `$${(parseInt(c.daily_budget) / 100).toFixed(0)}/day` : c.lifetime_budget ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(0)} total` : "no budget"} | ${c.objective}`,
                )
                .join("\n");
              liveMetaData += `CAMPAIGNS (${campsRaw.data.length} total, ${activeCount} ACTIVE — foque nessas primeiro a menos que o usuário pergunte explicitamente sobre pausadas):\n${lines}\n`;
            } else {
              liveMetaData += `CAMPAIGNS: Nenhuma campanha encontrada.\n`;
            }

            // Adsets — compact (no targeting to reduce size)
            if (adsetsRaw?.data?.length) {
              const adsetLines = adsetsRaw.data
                .slice(0, 10)
                .map((s: any) => {
                  const budget = s.daily_budget
                    ? `$${(parseInt(s.daily_budget) / 100).toFixed(0)}/day`
                    : "—";
                  return `  [${s.id}] ${(s.name || "?").slice(0, 40)}: ${s.effective_status || s.status} | ${budget} | ${s.optimization_goal || ""}`;
                })
                .join("\n");
              liveMetaData += `ADSETS (${adsetsRaw.data.length}):\n${adsetLines}\n`;
            }

            // Ads performance
            if (adsRaw?.error) {
              const isExpired =
                adsRaw.error.code === 190 ||
                String(adsRaw.error.message || "")
                  .toLowerCase()
                  .includes("token") ||
                String(adsRaw.error.type || "").includes("OAuthException");
              liveMetaData += isExpired
                ? `ADS: Token expirado — diga ao usuário para reconectar o Meta Ads em Contas.\n`
                : `ADS: Erro ao buscar dados — ${adsRaw.error.message}\n`;
            } else if (adsRaw?.data?.length) {
              // Top 20 ads by spend
              const adLines = adsRaw.data
                .slice(0, 20)
                .map((ad: any) => {
                  const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                  const leads = ad.actions?.find((a: any) => a.action_type === "lead")?.value || "";
                  const hookRate = ad.video_play_actions?.find((a: any) => a.action_type === "video_play")?.value;
                  const hr = hookRate
                    ? ` hook=${((parseInt(hookRate) / Math.max(parseInt(ad.impressions || 1), 1)) * 100).toFixed(1)}%`
                    : "";
                  const conv = leads ? ` leads=${leads}` : purchases !== "0" ? ` purch=${purchases}` : "";
                  return `  [${ad.ad_id}] ${ad.ad_name}: spend=$${parseFloat(ad.spend || 0).toFixed(0)} ctr=${ad.ctr}% cpm=$${parseFloat(ad.cpm || 0).toFixed(1)} freq=${ad.frequency || "?"}${hr}${conv}`;
                })
                .join("\n");
              liveMetaData += `ADS (${adsRaw.data.length} found, top by spend):\n${adLines}\n`;
            } else {
              liveMetaData += `ADS: Nenhum gasto de anúncio no período.\n`;
            }

            // ALL-TIME TOP PERFORMERS (limit 10)
            if (lifetimeAdsRaw?.data?.length) {
              const lifetimeLines = lifetimeAdsRaw.data
                .slice(0, 10)
                .map((ad: any) => {
                  const purchases = ad.actions?.find((a: any) => a.action_type === "purchase")?.value || "0";
                  const conv = purchases !== "0" ? ` purch=${purchases}` : "";
                  return `  [${ad.ad_id}] ${ad.ad_name}: spend=$${parseFloat(ad.spend || 0).toFixed(0)} ctr=${ad.ctr}% impr=${parseInt(ad.impressions || 0).toLocaleString()}${conv} | ${ad.campaign_name}`;
                })
                .join("\n");
              liveMetaData += `\nALL-TIME TOP ADS (últimos 3 anos):\n${lifetimeLines}\n`;
            }

            // Monthly breakdown — macro trends
            if (timeSeriesRaw?.data?.length) {
              const monthlyLines = timeSeriesRaw.data
                .filter((d: any) => parseFloat(d.spend || 0) > 0)
                .map((d: any) => {
                  const purch = d.actions?.find((a: any) => a.action_type === "purchase")?.value || "";
                  return `  ${d.date_start?.slice(0, 7)}: spend=$${parseFloat(d.spend || 0).toFixed(0)} ctr=${parseFloat(d.ctr || 0).toFixed(2)}% cpm=$${parseFloat(d.cpm || 0).toFixed(1)}${purch ? ` purch=${purch}` : ""}`;
                })
                .join("\n");
              if (monthlyLines) liveMetaData += `MONTHLY BREAKDOWN:\n${monthlyLines}\n`;
            }

            // Daily trend
            if (false && timeSeriesRaw?.data?.length) {
              const series = timeSeriesRaw.data
                .filter((d: any) => parseFloat(d.spend || 0) > 0)
                .slice(-14)
                .map((d: any) => {
                  const purch = d.actions?.find((a: any) => a.action_type === "purchase")?.value || "";
                  return `  ${d.date_start}: spend=$${parseFloat(d.spend || 0).toFixed(0)} ctr=${parseFloat(d.ctr || 0).toFixed(2)}% cpm=$${parseFloat(d.cpm || 0).toFixed(1)}${purch ? ` purch=${purch}` : ""}`;
                })
                .join("\n");
              if (series) {
                // Compute trend
                const days = timeSeriesRaw.data.filter((d: any) => parseFloat(d.spend || 0) > 0);
                const half = Math.floor(days.length / 2);
                const firstHalf = days.slice(0, half);
                const secondHalf = days.slice(half);
                const avgCtr1 =
                  firstHalf.reduce((s: number, d: any) => s + parseFloat(d.ctr || 0), 0) /
                  Math.max(firstHalf.length, 1);
                const avgCtr2 =
                  secondHalf.reduce((s: number, d: any) => s + parseFloat(d.ctr || 0), 0) /
                  Math.max(secondHalf.length, 1);
                const trend =
                  avgCtr2 > avgCtr1 * 1.05 ? "↑ melhorando" : avgCtr2 < avgCtr1 * 0.95 ? "↓ piorando" : "→ estável";
                liveMetaData += `TENDÊNCIA DIÁRIA (${trend} CTR):\n${series}\n`;
              }
            }

            // Placement breakdown — limit 5
            if (placementRaw?.data?.length) {
              const placements = placementRaw.data
                .filter((p: any) => parseFloat(p.spend || 0) > 0)
                .slice(0, 5)
                .map(
                  (p: any) =>
                    `  ${p.publisher_platform || ""}/${p.platform_position || ""}: spend=$${parseFloat(p.spend || 0).toFixed(0)} ctr=${parseFloat(p.ctr || 0).toFixed(2)}% cpm=$${parseFloat(p.cpm || 0).toFixed(1)}`,
                )
                .join("\n");
              if (placements) liveMetaData += `PLACEMENT BREAKDOWN:\n${placements}\n`;
            }

            // ── TRACKING DIAGNOSTIC SYSTEM ──────────────────────────────
            // Automatically classify tracking health from real data
            try {
              const allAds = adsRaw?.data || [];
              const totalSpend = allAds.reduce((s: number, a: any) => s + parseFloat(a.spend || 0), 0);
              const totalClicks = allAds.reduce((s: number, a: any) => s + parseInt(a.clicks || 0), 0);
              const totalImpressions = allAds.reduce((s: number, a: any) => s + parseInt(a.impressions || 0), 0);

              // Count ALL conversion action types across ads
              const convActionTypes: Record<string, number> = {};
              let totalConversions = 0;
              for (const ad of allAds) {
                const actions = ad.actions || [];
                for (const act of actions) {
                  const t = act.action_type;
                  const v = parseFloat(act.value || 0);
                  // Only count conversion-level actions (not clicks, impressions, etc.)
                  if (["purchase", "lead", "complete_registration", "contact", "schedule",
                       "add_to_cart", "initiate_checkout", "subscribe", "submit_application",
                       "offsite_conversion.fb_pixel_purchase", "offsite_conversion.fb_pixel_lead",
                       "offsite_conversion.fb_pixel_complete_registration"].includes(t)) {
                    convActionTypes[t] = (convActionTypes[t] || 0) + v;
                    totalConversions += v;
                  }
                }
              }

              // Pixel health from pixelInfo already computed above
              const hasPixel = pixelInfo.includes("Pixel") && !pixelInfo.includes("Nenhum pixel");
              const pixelFired = pixelInfo.includes("último disparo") && !pixelInfo.includes("NUNCA disparou");

              // Count days of actual delivery (spend > 0) — tells us how mature
              // the signal is. A brand-new campaign that just spent $178 today
              // on day 1 shouldn't be called a tracking problem.
              const daysWithSpend = Array.isArray(timeSeriesRaw?.data)
                ? timeSeriesRaw.data.filter((d: any) => parseFloat(d.spend || 0) > 0).length
                : 0;

              // Classify tracking health
              let trackingStatus: "healthy" | "uncertain" | "broken" = "broken";
              let trackingDiagnosis = "";
              let trackingConfidence = "low"; // low | medium | high

              if (!hasPixel) {
                // No pixel at all
                trackingStatus = "broken";
                trackingDiagnosis = "Nenhum pixel instalado. Sem rastreamento de conversões.";
                trackingConfidence = "high";
              } else if (!pixelFired) {
                // Pixel exists but never fired
                trackingStatus = "broken";
                trackingDiagnosis = "Pixel instalado mas NUNCA disparou. O código pode não estar no site.";
                trackingConfidence = "high";
              } else if (daysWithSpend > 0 && daysWithSpend < 3 && totalConversions === 0) {
                // Fresh campaign — less than 3 full days of delivery. Attribution
                // windows (click → conversion) routinely take 24–72h; calling
                // this "tracking broken" produces false positives. Tell the AI
                // to wait, not to diagnose.
                trackingStatus = "uncertain";
                trackingDiagnosis = `Campanha recém-lançada (${daysWithSpend} dia${daysWithSpend === 1 ? "" : "s"} de entrega). ` +
                  `Ainda é cedo para avaliar tracking — a janela de atribuição (clique → conversão) leva 24–72h pra estabilizar. ` +
                  `Aguardar mais 1–2 dias antes de diagnosticar problema de pixel/evento.`;
                trackingConfidence = "low";
              } else if (daysWithSpend >= 3 && totalSpend > 300 && totalClicks > 100 && totalConversions === 0) {
                // 3+ days of delivery, material spend (>R$300), meaningful click
                // volume (>100), and still zero conversions → now it's a real
                // tracking red flag. Thresholds raised from $50/20-clicks to
                // avoid false positives on just-started campaigns.
                trackingStatus = "uncertain";
                const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
                trackingDiagnosis = `${daysWithSpend} dias rodando, spend $${totalSpend.toFixed(0)}, ${totalClicks} cliques (CTR ${avgCtr.toFixed(2)}%) e 0 conversões. ` +
                  `Possíveis causas: evento de conversão não dispara no site, landing page com problema, ou evento selecionado não corresponde à ação real do usuário.`;
                trackingConfidence = "medium";
              } else if (totalSpend > 0 && totalConversions === 0) {
                // Has spend and clicks but doesn't clear the "broken" thresholds
                // (e.g. low spend, mid-volume clicks, or 3+ days but under R$300).
                // Don't call tracking broken — just flag as "too early / thin".
                trackingStatus = "uncertain";
                trackingDiagnosis = `Spend $${totalSpend.toFixed(0)} com ${totalClicks} cliques em ${daysWithSpend || "menos de 1"} dia(s) e 0 conversões. ` +
                  `Volume ainda baixo para afirmar que é problema de tracking — pode ser só cedo. Continuar acompanhando.`;
                trackingConfidence = "low";
              } else if (totalSpend > 100 && totalConversions > 0 && totalConversions < totalClicks * 0.005) {
                // Conversions exist but suspiciously low relative to clicks (<0.5% conv rate)
                trackingStatus = "uncertain";
                const convRate = totalClicks > 0 ? (totalConversions / totalClicks * 100) : 0;
                trackingDiagnosis = `Conversões detectadas (${totalConversions}) mas taxa muito baixa (${convRate.toFixed(2)}% dos cliques). ` +
                  `Pode indicar: tracking parcial, evento duplicado descartado, ou evento configurado em página errada.`;
                trackingConfidence = "medium";
              } else if (totalConversions > 0) {
                // Conversions flowing — tracking seems healthy
                trackingStatus = "healthy";
                const eventList = Object.entries(convActionTypes)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ");
                trackingDiagnosis = `Tracking ativo. Eventos: ${eventList}. Dados de conversão confiáveis para otimização.`;
                trackingConfidence = "high";
              } else if (totalSpend === 0) {
                // No spend — can't evaluate tracking
                trackingStatus = "uncertain";
                trackingDiagnosis = "Sem gasto no período — não é possível avaliar tracking. Conversões serão verificadas quando campanhas estiverem rodando.";
                trackingConfidence = "low";
              } else {
                // Low spend, no conversions — might be too early
                trackingStatus = "uncertain";
                trackingDiagnosis = `Spend baixo ($${totalSpend.toFixed(0)}) e sem conversões. Pode ser muito cedo para avaliar tracking — acompanhar quando volume aumentar.`;
                trackingConfidence = "low";
              }

              // Check for event mismatch (user configured one event but another is firing)
              let eventMismatch = "";
              if (accountGoal?.conversion_event && totalConversions > 0) {
                const configuredEvent = accountGoal.conversion_event;
                const configuredCount = convActionTypes[configuredEvent] || 0;
                const otherEvents = Object.entries(convActionTypes)
                  .filter(([k, v]) => k !== configuredEvent && v > 0);
                if (configuredCount === 0 && otherEvents.length > 0) {
                  eventMismatch = `ALERTA: Evento configurado "${configuredEvent}" tem 0 conversões, mas outros eventos estão disparando: ${otherEvents.map(([k, v]) => `${k}=${v}`).join(", ")}. O evento de otimização pode estar errado.`;
                  if (trackingStatus === "healthy") trackingStatus = "uncertain";
                }
              }

              // Inject structured tracking diagnostic into context
              const statusEmoji = trackingStatus === "healthy" ? "🟢" : trackingStatus === "uncertain" ? "🟡" : "🔴";
              liveMetaData += `\n═══ TRACKING DIAGNOSTIC ═══\n`;
              liveMetaData += `STATUS: ${statusEmoji} ${trackingStatus.toUpperCase()} (confiança: ${trackingConfidence})\n`;

              if (trackingStatus === "healthy") {
                liveMetaData += `DIAGNÓSTICO: ${trackingDiagnosis}\n`;
              } else {
                // Structured Problem → Cause → Impact
                liveMetaData += `PROBLEMA: ${trackingDiagnosis}\n`;

                // Specific case causes
                if (!hasPixel) {
                  liveMetaData += `CAUSAS PROVÁVEIS:\n  - Pixel nunca foi adicionado à conta\n  - Pixel pode ter sido deletado\n`;
                } else if (!pixelFired) {
                  liveMetaData += `CAUSAS PROVÁVEIS:\n  - Código do pixel não está no site\n  - Pixel instalado no domínio errado\n  - Bloqueador de scripts impedindo o disparo\n`;
                } else if (totalSpend > 50 && totalClicks > 20 && totalConversions === 0) {
                  liveMetaData += `CAUSAS PROVÁVEIS:\n  - Evento de conversão não está disparando no site\n  - Evento selecionado não corresponde à ação real do usuário\n  - Landing page com problema impedindo a conversão\n`;
                } else if (totalConversions > 0 && totalConversions < totalClicks * 0.005) {
                  liveMetaData += `CAUSAS PROVÁVEIS:\n  - Tracking parcial — apenas parte das conversões registrada\n  - Evento configurado em página errada\n  - Evento duplicado descartado pelo Meta\n`;
                }

                if (eventMismatch) liveMetaData += `EVENT MISMATCH: ${eventMismatch}\n`;
                liveMetaData += `IMPACTO: AdBrief ${trackingStatus === "broken" ? "NÃO PODE" : "pode ter dificuldade para"} calcular CPA real, identificar o que converte, ou otimizar com base em resultados reais.\n`;
                liveMetaData += `DADOS DISPONÍVEIS: spend=$${totalSpend.toFixed(0)}, clicks=${totalClicks}, impressions=${totalImpressions}, conversions=${totalConversions}\n`;
              }
              liveMetaData += `═══ FIM TRACKING ═══\n`;
            } catch (trackErr) {
              console.error("[tracking-diagnostic error]", String(trackErr));
            }

          } else {
            liveMetaData = `META CONNECTED — no ad account selected. Tell user to go to Contas and select an ad account.`;
          }
        } else {
          liveMetaData = `META CONNECTED — token missing. Tell user to reconnect Meta Ads in Contas.`;
        }
      } catch (_e) {
        liveMetaData = `META CONNECTED — data fetch error: ${(_e as any)?.message || "unknown"}.`;
      }
    }

    // Google Ads live data — disabled (see GOOGLE_ADS_BACKUP.md)
    const liveGoogleData = "";

        // Cross-platform synthesis — disabled (see GOOGLE_ADS_BACKUP.md)
    let crossPlatformCtx = "";
    if (false) {
      crossPlatformCtx = `
=== CROSS-PLATFORM INTELLIGENCE — MESMA CONTA ===
Esta persona tem Meta Ads E Google Ads conectados ao mesmo tempo.
Você tem acesso aos dados de ambas as plataformas acima.

Use esses dados para:
- Comparar performance de ângulos/formatos entre plataformas
- Identificar o que funciona em Meta mas não em Google (ou vice-versa)
- Detectar keywords do Google que viraram bons hooks no Meta
- Sugerir onde redistribuir verba com base em ROAS comparativo
- Detectar audiências que saturaram em uma plataforma e ainda têm espaço na outra
- Cruzar o CTR de criativos: se um ângulo funciona em Meta, hipótese para Google Display/YouTube

Não use regras fixas. Use os dados reais acima e raciocine sobre o que está acontecendo.
=== FIM CROSS-PLATFORM ===`;
    }

    // ── Preflight history context ─────────────────────────────────────────────
    const pfHistory = (preflightHistory || []) as any[];
    const pfCtx = (() => {
      if (!pfHistory.length) return "";
      const avgScore = (pfHistory.reduce((s: number, r: any) => s + (r.score || 0), 0) / pfHistory.length).toFixed(0);
      const verdicts = pfHistory.reduce((acc: any, r: any) => {
        acc[r.verdict] = (acc[r.verdict] || 0) + 1;
        return acc;
      }, {});
      const lastRun = pfHistory[0];
      const trend =
        pfHistory.length >= 3
          ? pfHistory
              .slice(0, 3)
              .map((r: any) => r.score)
              .join(" → ")
          : null;
      return [
        `PRE-FLIGHT HISTORY (${pfHistory.length} runs):`,
        `  Avg score: ${avgScore}/100 | Verdicts: ${Object.entries(verdicts)
          .map(([v, c]) => `${v}:${c}`)
          .join(", ")}`,
        lastRun
          ? `  Last run: score ${lastRun.score} | ${lastRun.verdict} | ${lastRun.platform} / ${lastRun.market} / ${lastRun.format}`
          : "",
        trend ? `  Score trend (last 3): ${trend}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })();

    let richContext: any = [];
    try {
    richContext = [
      // ── Identidade do usuário — SEMPRE primeiro ───────────────────────────
      (() => {
        const planLabel = planKey === "studio" ? "Studio ($299/mês — ilimitado)"
          : planKey === "pro"    ? "Pro ($49/mês — 2500 créditos/mês, ~166 melhorias)"
          : planKey === "maker"  ? "Maker ($19/mês — 1000 créditos/mês, ~33 melhorias)"
          : "Free (15 créditos/mês)";
        return `PLANO DO USUÁRIO: ${planLabel}
IDIOMA DO USUÁRIO: ${uiLang === "pt" ? "Português — responda SEMPRE em português" : uiLang === "es" ? "Español — responde SIEMPRE en español" : "English — always respond in English"}
REGRA: NUNCA sugira upgrade de plano a não ser que o usuário pergunte sobre planos. NUNCA invente limitações de features baseado no plano.`;
      })(),
      personaCtx,
      defaultsBlock,
      `CONNECTED PLATFORMS: ${connectedPlatforms.length ? connectedPlatforms.join(", ") : "none"}`,
      liveMetaData || "",
      // liveGoogleData — disabled
      // crossPlatformCtx — disabled
      // Analyses count removed — internal data, not actionable for user
      topHooks.length ? `TOP HOOK TYPES: ${topHooks.join(", ")}` : "",
      recentSummary ? `RECENT 5 ANALYSES:\n${recentSummary}` : "",
      importInsights ? `IMPORTED DATA:\n${importInsights}` : "",
      learnedCtx
        ? `=== APRENDIZADO DA CONTA ===\n${learnedCtx}\n(Use esses padrões para personalizar hooks, scripts e recomendações)`
        : "",
      // Daily intelligence — compact version
      (() => {
        try {
          const snaps = (dailySnapshots || []) as any[];
          if (!snaps.length) return "";
          const latest = snaps[0];
          if (!latest) return "";
          const prev = snaps[1] || null;
          const ctrDelta = prev?.avg_ctr
            ? ((((latest.avg_ctr || 0) - prev.avg_ctr) / Math.max(prev.avg_ctr, 0.001)) * 100).toFixed(1)
            : null;
          const topAds = Array.isArray(latest.top_ads) ? (latest.top_ads as any[]) : [];
          const toScale = topAds.filter((a: any) => a?.isScalable).slice(0, 2);
          const toPause = topAds.filter((a: any) => a?.needsPause).slice(0, 2);
          return [
            `INTELLIGENCE DIÁRIA — ${latest.date || "hoje"}`,
            `Spend 7d: R$${(latest.total_spend || 0).toFixed(0)} | CTR: ${((latest.avg_ctr || 0) * 100).toFixed(2)}% | ${latest.active_ads || 0} ads`,
            ctrDelta ? `Vs anterior: CTR ${parseFloat(ctrDelta) > 0 ? "+" : ""}${ctrDelta}%` : "",
            toScale.length ? `ESCALAR: ${toScale.map((a: any) => `"${(a.name || "?").slice(0, 30)}" CTR ${((a.ctr || 0) * 100).toFixed(2)}%`).join(" | ")}` : "",
            toPause.length ? `PAUSAR: ${toPause.map((a: any) => `"${(a.name || "?").slice(0, 30)}" R$${(a.spend || 0).toFixed(0)}`).join(" | ")}` : "",
            latest.ai_insight ? `INSIGHT: ${String(latest.ai_insight).slice(0, 150)}` : "",
          ].filter(Boolean).join("\n");
        } catch { return ""; }
      })(),
      pfCtx || "",
      (() => {
        const profile = aiProfile as any;
        if (!profile) return "";
        const directive = profile?.ai_recommendations?.weekly_directive;
        const lines = [
          // Account goal — reinforces the defaultsBlock with an operational rule.
          // The full config already lives in defaultsBlock above; here we only
          // state how to USE it during analysis.
          accountGoal
            ? `REGRA DE JULGAMENTO: Use ${accountGoal.primary_metric.toUpperCase()} como métrica principal de performance (CTR é só complemento). Se conversões = 0 sobre spend relevante, investigue o motivo — MAS antes de cravar "tracking quebrado" verifique idade da campanha: com menos de 3 dias rodando, atribuição ainda está em janela de estabilização (24–72h) e zero conversões é normal. Nessa janela, diga pro usuário esperar, não diagnostique. Só chame de problema de tracking quando: 3+ dias de entrega, spend > R$300 e > 100 cliques sem 1 conversão sequer.`
            : `=== OBJETIVO AINDA NÃO CONFIGURADO ===
Este usuário ainda não definiu objetivo de negócio. Se ele pedir análise de performance sem contexto, sugira definir o objetivo nas configurações da conta ANTES de cravar um veredito, mas ainda assim entregue o que der pra dizer com os dados disponíveis (CTR, frequência, tendências). Não faça do objetivo uma barreira pra ajudar.`,
          // Business goal from AI (secondary — inferred, not user-confirmed)
          businessGoal && !accountGoal
            ? `OBJETIVO INFERIDO (não confirmado pelo usuário): ${businessGoal.goal}${businessGoal.target_cpa ? ` | CPA sugerido: ${businessGoal.target_cpa}` : ""}${businessGoal.budget ? ` | Budget: ${businessGoal.budget}` : ""}`
            : "",
          profile.ai_summary ? `PERFIL DO USUÁRIO: ${profile.ai_summary}` : "",
          directive?.proximo_teste ? `DIRETIVA SEMANAL (Creative Director): ${directive.proximo_teste}` : "",
          directive?.resumo && directive.resumo !== profile.ai_summary ? `SITUAÇÃO DA CONTA: ${directive.resumo}` : "",
          directive?.criar_esta_semana?.length
            ? `HOOKS PROPOSTOS PARA TESTAR: ${directive.criar_esta_semana
                .slice(0, 2)
                .map((h: any) => h.hook?.slice(0, 80))
                .join(" | ")}`
            : "",
        ];
        return lines.filter(Boolean).join("\n");
      })(),
      (() => {
        // Telegram connection status
        const tg = telegramConnection as any;
        if (tg) {
          const username = tg.telegram_username ? `@${tg.telegram_username}` : "conectado";
          const since = tg.connected_at ? new Date(tg.connected_at).toLocaleDateString("pt-BR") : "";
          return `TELEGRAM: Conectado (${username}${since ? `, desde ${since}` : ""}).
INSTRUÇÃO: Se o usuário perguntar sobre o Telegram, responda de forma curta e natural — como uma conversa, não como uma lista de comandos. Exemplo: "Sim, o Telegram já está conectado como ${username}. Você recebe alertas automáticos por lá e pode usar /pausar [nome] para pausar um criativo direto pelo bot." Não liste todos os comandos a menos que o usuário peça especificamente.`;
        } else {
          return `TELEGRAM: Não conectado.
INSTRUÇÃO: Se o usuário perguntar sobre conectar o Telegram, responda de forma natural e direta. Exemplo: "É simples — clique no ícone do Telegram no topo da tela, ao lado do seu avatar. Ele abre um modal que gera o link de conexão para você." Não dê instruções longas.`;
        }
      })(),
      (() => {
        const alerts = (accountAlerts || []) as any[];
        if (!alerts.length) return "";
        const lines = alerts
          .map((a: any) => {
            const when = a.created_at
              ? new Date(a.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const ad = a.ad_name ? `"${a.ad_name}"` : "";
            const camp = a.campaign_name ? ` (${a.campaign_name})` : "";
            return `  [${a.urgency?.toUpperCase() || "HIGH"}] ${a.detail}${ad ? ` — Ad: ${ad}${camp}` : ""}${a.action_suggestion ? ` → Ação: ${a.action_suggestion}` : ""}${when ? ` (${when})` : ""}`;
          })
          .join("\n");
        return `=== ALERTAS ATIVOS DA CONTA (não dispensados pelo usuário) ===\n${lines}\nEsses alertas foram gerados automaticamente.\n\nREGRA DE PRIORIDADE:\n- Se a pergunta do usuário for GENÉRICA ("como tá a conta?", "tem algum problema?", "o que está acontecendo?") → referencie os alertas diretamente.\n- Se a pergunta for ESPECÍFICA sobre um tema (pixel, tracking, conversão, criativo, escala, público, orçamento) → responda PRIMEIRO o tema pedido com os dados do contexto e, só DEPOIS, mencione alertas APENAS se forem diretamente relacionados. NÃO desvie uma pergunta específica para um alerta não relacionado.`;
      })(),
      (() => {
        const notes = (aiProfile as any)?.pain_point as string | null;
        if (!notes) return "";
        const items = notes
          .split("|||")
          .filter(Boolean)
          // Filter out onboarding artifacts — only keep real user instructions
          .filter((n) => {
            const t = n.trim().toLowerCase();
            return !t.startsWith("user:") && !t.startsWith("usuário:") && !t.startsWith("niche:") && !t.startsWith("nicho:") && t.length > 5;
          })
          .slice(0, 5);
        if (!items.length) return "";
        return `=== INSTRUÇÕES DO USUÁRIO ===\nO usuário pediu para lembrar:\n${items.map((n) => `  • ${n}`).join("\n")}`;
      })(),
      // Persistent chat memory — facts extracted from previous conversations
      memorySummary
        ? `=== MEMÓRIA PERSISTENTE — FATOS CONFIRMADOS ===\n${memorySummary}\n🔴=crítico(importância 5) 🟡=importante(4) ⚪=contexto(1-3)\nESSES FATOS SÃO VERDADEIROS. Use-os diretamente. NUNCA peça confirmação de algo que já está aqui.`
        : "",
      // Cross-account intelligence — winners from other accounts of this user
      (() => {
        const cross = (crossAccountPatterns || []) as any[];
        if (!cross.length) return "";
        const lines = cross
          .slice(0, 5)
          .map(
            (p: any) =>
              `  ✓ ${p.pattern_key?.replace(/_/g, " ")}: CTR ${(p.avg_ctr * 100).toFixed(2)}% | conf ${(p.confidence * 100).toFixed(0)}% — ${p.insight_text?.slice(0, 80) || ""}`,
          )
          .join("\n");
        return `=== PADRÕES VENCEDORES DE OUTRAS CONTAS (mesmo usuário) ===\n${lines}\n(Esses padrões funcionaram em outras contas deste usuário. Quando relevante, sugira adaptação.)`;
      })(),
      // Few-shot: examples of responses this user approved — imitate this style/specificity/format
      fewShotBlock
        ? `=== EXEMPLOS DE RESPOSTAS QUE ESTE USUÁRIO APROVOU ===\nImite o nível de especificidade, o tom e o formato dessas respostas. Nunca seja mais genérico do que elas.\n\n${fewShotBlock}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    } catch (ctxErr) {
      console.error("[ai-chat] context build error:", String(ctxErr));
      richContext = ["Context build error — proceeding with minimal context."];
    }
    _lap("context-built");

    // ── 5. Language ───────────────────────────────────────────────────────────
    const LANG_NAMES: Record<string, string> = {
      en: "English",
      pt: "Portuguese (Brazilian)",
      es: "Spanish",
      fr: "French",
      de: "German",
    };
    const MARKET_LANG_MAP: Record<string, string> = {
      BR: "pt",
      MX: "es",
      ES: "es",
      AR: "es",
      CO: "es",
      IN: "en",
      US: "en",
      UK: "en",
      FR: "fr",
      DE: "de",
    };
    const uiLang2 = (user_language as string) || "en";
    const personaMarket = (persona?.result as any)?.preferred_market || "";
    const contentLangCode = MARKET_LANG_MAP[personaMarket?.toUpperCase()] || uiLang2;
    const uiLangName = LANG_NAMES[uiLang2] || "English";
    const contentLangName = LANG_NAMES[contentLangCode] || "English";

    // ── 5c. Landing page extraction ────────────────────────────────────────────
    //
    // If the user pasted one or more URLs in the current message, fetch the page
    // content (Jina Reader → raw fallback, 24h cache). The result is injected
    // into the system prompt as a "## LANDING PAGE" block so the AI can reason
    // about ad↔LP match, pixel presence, copy, CTAs, etc.
    //
    // We only look at URLs in THE CURRENT message — not history — to keep costs
    // predictable and let the user control when a page is (re)read.
    const originalMsg = typeof message === "string" ? message : "";
    const landingUrls = extractLandingUrls(originalMsg);
    type LandingSnap = Awaited<ReturnType<typeof getOrFetchLanding>> & { auto?: boolean };
    const landingSnapshots: LandingSnap[] = [];
    if (landingUrls.length > 0 && user_id) {
      _lap(`lp-fetch-start (${landingUrls.length})`);
      const fetched = await Promise.allSettled(
        landingUrls.map((u) => getOrFetchLanding(supabase, user_id, u)),
      );
      for (const r of fetched) {
        if (r.status === "fulfilled" && r.value) landingSnapshots.push(r.value as LandingSnap);
      }
      _lap(`lp-fetch-done (${landingSnapshots.length})`);
    }

    // ── Proactive LP fetch ───────────────────────────────────────────────────
    // If the user has a configured site on the active persona, didn't paste a
    // URL in this message, and is asking something where the LP would add
    // signal (performance, conversion, pixel, "analisa minha conta", etc.),
    // auto-fetch the configured site. 24h cache keeps this cheap on repeat.
    if (
      landingSnapshots.length === 0 &&
      personaSite &&
      user_id &&
      originalMsg.trim().length > 8
    ) {
      const rawLower = originalMsg.toLowerCase();
      const wantsLPSignal =
        /\b(conver[ts][aã]o|0\s*conver|sem\s*conver|nenhuma\s*conver|cpa|roas|custo|lucro|margem|pixel|track|evento|analis[ea]|auditoria|revis[ae]|diagn[oó]stico|por\s*qu[eê].*(n[aã]o|sem)|o que\s+(est[áa]|t[áa])|problema|baixo|caro|ruim|melhor[ae]?\s+a|reativar|prioriz|o que\s+fa[zç]o|do que\s+precis|minha\s+conta)/
          .test(rawLower);
      if (wantsLPSignal) {
        try {
          const autoUrl = personaSite.startsWith("http") ? personaSite : `https://${personaSite}`;
          _lap("lp-auto-fetch-start");
          const auto = await getOrFetchLanding(supabase, user_id, autoUrl);
          if (auto) landingSnapshots.push({ ...auto, auto: true });
          _lap(`lp-auto-fetch-done (${landingSnapshots.length})`);
        } catch (e) {
          console.warn("[adbrief-ai-chat] auto LP fetch failed:", e);
        }
      }
    }

    // Build the prompt block — empty string when there are no URLs, so the AI
    // doesn't even know the capability exists and won't prompt for links.
    const landingPageBlock = (() => {
      if (!landingSnapshots.length) return "";
      const anyAuto = landingSnapshots.some((lp: any) => lp?.auto);
      const anyPasted = landingSnapshots.some((lp: any) => !lp?.auto);
      const rendered = landingSnapshots
        .map((lp: any) => {
          if (!lp) return "";
          const header = lp.auto
            ? `### LP CONFIGURADA (auto-carregada): ${lp.url}`
            : `### LP: ${lp.url}`;
          if (lp.source === "error" || !lp.content) {
            return `${header}\nNão foi possível acessar esta página (${lp.error || "fetch error"}). Comente isso honestamente ao usuário — não invente o conteúdo.`;
          }
          const pixelLine = lp.hasFbPixel
            ? (lp.hasConvEvent
                ? "Pixel do Meta detectado E evento de conversão presente (Purchase/Lead/etc.)."
                : "Pixel do Meta detectado, MAS nenhum evento de conversão (fbq('track',...)) foi encontrado no HTML.")
            : "NENHUM código de pixel do Meta detectado no HTML desta página.";
          const ctaLine = lp.primaryCta ? `CTA principal detectado: "${lp.primaryCta}"` : "Nenhum CTA claro detectado no texto principal.";
          const content = (lp.content || "").slice(0, 4000);
          return [
            header,
            lp.title ? `Título: ${lp.title}` : "",
            `Fonte: ${lp.source}`,
            pixelLine,
            ctaLine,
            "",
            "--- Conteúdo da página (extrato) ---",
            content,
            "--- Fim da página ---",
          ].filter(Boolean).join("\n");
        })
        .filter(Boolean)
        .join("\n\n");

      const blockTitle = anyPasted
        ? "LANDING PAGES QUE O USUÁRIO ACABOU DE COMPARTILHAR"
        : "LANDING PAGE CONFIGURADA (PUXADA AUTOMATICAMENTE)";

      const proactivityFooter = anyAuto && !anyPasted
        ? `\nEste é o site que o usuário configurou para esta workspace. Ele NÃO colou a URL nesta mensagem — você puxou por conta própria porque a pergunta dele pede esse contexto (conversão, performance, análise da conta, etc.).\n\nCOMO USAR:\n- Incorpore o insight da LP naturalmente na resposta. Não peça permissão.\n- Abra SE fizer sentido com algo como "olhei sua landing em ${landingSnapshots[0]?.url}..." pra deixar claro que você analisou.\n- Se o usuário quiser analisar OUTRA LP, ele cola o link — aí você troca.`
        : "";

      return `\n\n═══════════════════════════════════
${blockTitle}
═══════════════════════════════════

${rendered}

REGRAS AO ANALISAR ESTA(S) LANDING PAGE(S):
- Foque no que a LP REALMENTE diz — não invente seções que não estão no extrato.
- Compare a mensagem da LP com os criativos da conta (ad↔LP match). Mismatch mata conversão.
- Se detectamos "NENHUM pixel" ou "sem evento de conversão" acima, CITE isso como causa provável quando o usuário reclamar de 0 conversões — é dado concreto, não suposição.
- Avalie o CTA: clareza, posição implícita no fluxo, fricção do formulário (se mencionado no extrato).
- Se a página tem MUITO texto técnico antes da oferta, ou o CTA aparece só no final, levante isso como fricção.
- Se falhou em acessar (source=error), fale com o usuário — ofereça caminhos (site com paywall/login, bot-wall, SPA pesado) em vez de alucinar.${proactivityFooter}
`;
    })();

    // ── 5b. History — FIX 5: smart compression ──────────────────────────────
    const historyMessages: { role: "user" | "assistant"; content: string }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      const raw = history.filter((h) => h.role === "user" || h.role === "assistant");

      if (raw.length <= 16) {
        // Short conversation — keep full, just truncate long assistant messages
        for (const h of raw) {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 800) content = content.slice(0, 800) + "…";
          if (content) historyMessages.push({ role: h.role, content });
        }
      } else {
        // Long conversation — compress middle, keep recent 10 intact
        const recent = raw.slice(-10);
        const older = raw.slice(0, -10);

        // Summarize older messages into a compact digest
        const digest = older
          .filter((h) => h.role === "user")
          .slice(-8) // last 8 user questions from the older block
          .map((h) => `- ${String(h.content || "").slice(0, 120)}`)
          .join("\n");

        if (digest) {
          historyMessages.push({
            role: "user",
            content: `[RESUMO DAS ÚLTIMAS ${older.length} MENSAGENS ANTERIORES — para contexto, não responda isso]\n${digest}`,
          });
          historyMessages.push({
            role: "assistant",
            content: "[Entendido. Tenho o contexto das mensagens anteriores.]",
          });
        }

        // Add recent messages in full
        for (const h of recent) {
          let content = String(h.content || "").trim();
          if (h.role === "assistant" && content.length > 1000) content = content.slice(0, 1000) + "…";
          if (content) historyMessages.push({ role: h.role, content });
        }
      }
    }

    // ── 6. Lovable AI Gateway call ──────────────────────────────────────────
    const todayObj = new Date();
    const todayStr = todayObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentYear = todayObj.getFullYear();

    // ── 6a. Intent detector — classify the current user message so we can inject
    //        a topic-specific priority directive into the system prompt. This
    //        prevents the AI from hijacking a specific question (e.g. "diagnóstico
    //        do meu pixel") with an unrelated account alert (e.g. "budget mismatch").
    const rawMsg = (typeof message === "string" ? message : "").toLowerCase();
    const intentSignals = {
      pixel: /\bpixel|trackin|rastreio|rastreamento|evento de convers|eventos de convers|convers[aã]o\s+(n[aã]o|zerada|n[aã]o)|fbq|f[aá]cebook\s+pixel|pixel\s+do\s+meta|diagn[oó]stico\s+do\s+pixel|meu\s+pixel/.test(rawMsg),
      creative: /\bcriativo|anunc?io\b|hook|roteiro|copy|cta|fadiga/.test(rawMsg),
      scale: /\bescalar|aumentar\s+(or[çc]amento|budget)|scale/.test(rawMsg),
      audience: /\bp[uú]blico|audience|lookalike|interesse/.test(rawMsg),
      budget: /\bor[çc]amento|budget|gasto|spend|cpa|cpc|cpm|roas/.test(rawMsg),
    };

    let intentDirective = "";
    if (intentSignals.pixel) {
      intentDirective = `\n\n**INTENÇÃO DETECTADA — PIXEL / TRACKING**

Responde SÓ o que foi perguntado, em tom de media buyer conversando.

REGRAS:

1. Use os dados reais do contexto ("PIXELS INSTALADOS", "TRACKING DIAGNOSTIC", evento configurado). Não invente.

2. Se o TRACKING DIAGNOSTIC estiver como "uncertain" + mensagem falando que a campanha é recém-lançada (menos de 3 dias), NÃO diagnostique como "pixel quebrado". Diga que é cedo pra avaliar e que a janela de atribuição ainda está estabilizando. Pare por aí. NÃO sugira "abra o Facebook Pixel Helper" nesse cenário — é desnecessário.

3. Se o pixel REALMENTE não existe ou nunca disparou (status: broken, confidence: high), aí sim dê o passo-a-passo de instalação.

4. FORMATO CURTO POR DEFAULT. 3-6 linhas, direto. Use ## headers SÓ se tiver 3 ou mais pontos distintos e não-relacionados. Evite listas numeradas de 5+ itens. Evite emojis de seção (✅ 🔴 ⚠️) em excesso — use um, no máximo, pra sinalizar severidade.

5. Não traga outros problemas (campanhas pausadas, fadiga criativa, budget) a menos que o usuário tenha perguntado. Foco cirúrgico no que foi perguntado.`;
    }

    const systemPrompt = `Você é o AdBrief AI — especialista em performance de mídia paga, embutido na conta do usuário.
Se perguntarem quem você é: "Sou o AdBrief AI." Nunca revele o modelo base.

DATA DE HOJE: ${todayStr}

═══════════════════════════════════
POSTURA — SENIOR MEDIA BUYER, PROATIVO
═══════════════════════════════════

Você NÃO é um assistente passivo que pergunta antes de ajudar. Você é um media buyer sênior que já tem o briefing e age com ele.

REGRAS DE OURO:

1. **LEIA "DADOS JÁ CONFIGURADOS PELO USUÁRIO" ABAIXO ANTES DE QUALQUER RESPOSTA.** Se o objetivo, CPA/ROAS alvo, margem de lucro, evento de conversão ou site estão lá, eles SÃO a verdade. Nunca pergunte de novo. Se perguntar, o usuário vai responder "você já tem isso na conta" — e vai ter razão.

2. **Se o usuário pede análise e você tem dados suficientes, ENTREGUE a análise.** Não trave a resposta pedindo "qual o seu objetivo?" ou "qual CPA alvo?" — esses dados estão no bloco de configurações. Se algum dado realmente falta, diga o que falta em UMA linha no final e dê o melhor diagnóstico possível com o que tem.

3. **Seja proativo com o site configurado.** Se o bloco "LP CONFIGURADA (auto-carregada)" aparece no fim do prompt, o sistema já leu a landing pra você. Use o conteúdo dela. Num caso de "0 conversões", puxe achados concretos da LP (CTA fraco, pixel ausente, copy sem match com os ads) antes de qualquer outra hipótese.

4. **Nunca devolva a pergunta.** Se o usuário pergunta "quais anúncios devo reativar?", você responde com uma ordem priorizada usando os dados que tem. Se precisar de 1 info específica e ninguém tem como responder sem ela, pergunte DEPOIS de entregar uma análise parcial — nunca antes.

5. **Se você detectar um problema óbvio que o usuário não perguntou** (ex: conversões = 0 em conta com spend > R$100, pixel ausente, margem sendo comida), traga à tona como "BÔNUS" ou "PS" no fim da resposta — é o que um diretor de mídia faria.

═══════════════════════════════════
CAPACIDADE — LEITURA DE LANDING PAGES
═══════════════════════════════════

Você recebe conteúdo real de landing pages em dois casos:
1. **O usuário cola uma URL** (https://...) — o fetch acontece e o conteúdo aparece em "LANDING PAGES QUE O USUÁRIO ACABOU DE COMPARTILHAR" no fim do prompt.
2. **Auto-fetch da LP configurada** — quando o usuário tem um site configurado para essa workspace (veja "DADOS JÁ CONFIGURADOS") E a pergunta dele pede esse contexto (conversão, performance, análise da conta, pixel, CPA/ROAS ruim, "o que faço", etc.), o sistema puxa a LP sozinho e aparece em "LANDING PAGE CONFIGURADA (PUXADA AUTOMATICAMENTE)".

REGRAS RÍGIDAS DE USO:
- **Se tem bloco "LP CONFIGURADA (auto-carregada)" no fim do prompt**, você PODE E DEVE citar os achados sem pedir permissão. Faça o trabalho. Abra a resposta com "Olhei sua landing em <url>..." se fizer sentido — o usuário vai entender que você foi proativo.
- **Não peça URL quando já tem LP configurada.** Se o bloco auto-carregado está presente, não precisa dizer "cola o link".
- **Só ofereça receber outra URL SE** o usuário explicitamente falar de OUTRA página (não a configurada). Uma frase: "Se quiser que eu olhe outra LP, cola o link."
- **Se não há LP nenhuma (nem auto, nem colada)** e a pergunta é sobre LP / conversão / tracking / ad↔LP match, ofereça UMA vez no final: "Cola o link da sua LP aqui que eu olho o conteúdo real." Não repita na próxima mensagem se o usuário ignorar.
- **Nunca finja** ter lido uma LP que não está no contexto. Se não há bloco de LP abaixo, você não viu nada — responda com suposição e deixe claro que é suposição.
- **Se o fetch falhou** (source=error no bloco), não invente o que estava na página — fale honestamente que não conseguiu acessar.

═══════════════════════════════════
FORMATAÇÃO OBRIGATÓRIA — LEIA PRIMEIRO
═══════════════════════════════════

O frontend renderiza markdown. Use sempre. Nunca retorne texto corrido sem estrutura.

**HIERARQUIA TIPOGRÁFICA:**
- "##" para títulos de seção (ex: "## Diagnóstico", "## O que fazer")
- "###" para labels de contexto (ex: "### Conta", "### Criativo")
- "**negrito**" para: números, nomes de campanha, métricas, ações concretas
- "_itálico_" para: notas, contexto secundário
- "-" para listas de itens (o frontend converte em bullets visuais)
- "1." para listas ordenadas / passos de ação
- "---" para separar seções distintas numa resposta longa

**DISCIPLINA DE TAMANHO — IMPORTANTE:**

RESPOSTA CURTA É O DEFAULT. Média ideal: 4-8 linhas. Pergunta simples → responde em 1-3 linhas. Pergunta complexa ou diagnóstico pedido explicitamente → até 10-15 linhas com ## headers.

NUNCA use ## headers para perguntas curtas ou quando a resposta cabe em 1 parágrafo. Headers são pra separar tópicos distintos — não pra decorar uma resposta simples.

**QUANDO USAR ## HEADERS:**
Só quando a resposta cobre 3+ pontos independentes (ex: "diagnóstico completo"). Caso contrário, responde em prosa direta com **negrito** nos pontos-chave.

**EXEMPLO DE RESPOSTA CURTA (PREFERIDA):**
O **CTR caiu 40%** nos últimos 3 dias porque a **frequência chegou em 4.2x** — audiência esgotada. **Pause o conjunto** e cria uma variação com hook novo pra ativar pública fresca.

**EXEMPLO DE RESPOSTA ESTRUTURADA (só quando o usuário pediu diagnóstico completo):**

## Diagnóstico
**CTR caiu 40%** em 3 dias.

## Causa
Frequência em **4.2x** — audiência esgotada.

## Ação
Pause o conjunto e cria variação com hook novo.

**REGRAS:**
- **negrito** obrigatório em números reais, nomes de campanha, ações
- Use "-" ou "1." em listas de 3+ itens só
- Evite emojis decorativos (✅ 🔴 ⚠️ em excesso) — use um, no máximo, pra sinalizar severidade
- Não invente estrutura — se uma frase resolve, uma frase basta

═══════════════════════════════════
INTELIGÊNCIA DE CONVERSÃO (PRIMARY METRIC)
═══════════════════════════════════

O contexto contém "OBJETIVO DEFINIDO PELO USUÁRIO" ou "SEM OBJETIVO DEFINIDO".

SE OBJETIVO DEFINIDO:
- A MÉTRICA PRINCIPAL está explícita (CPA, ROAS, CPC). USE-A como base de TODA análise.
- Quando comparar campanhas: use a métrica principal, não CTR.
- "Campanha A é melhor" = "Campanha A tem melhor CPA/ROAS/CPC" — NUNCA "melhor CTR".
- Se conversões = 0 com spend > 0: esse é SEMPRE o diagnóstico #1. Tudo mais é irrelevante.
- Cite CTR apenas como complemento ("CTR está bom, mas sem conversões não importa").

SE SEM OBJETIVO:
- Quando o usuário perguntar "qual é melhor?", "como tá a performance?": PERGUNTE o objetivo PRIMEIRO.
- Frase: "Antes de comparar: qual é o objetivo — gerar leads, vendas, tráfego? Sem isso, CTR alto pode significar zero resultado real."
- Após saber o objetivo, analise pela métrica correta.

HIERARQUIA DE MÉTRICAS (sempre nessa ordem):
1. Conversões (0 = problema grave)
2. CPA/ROAS (métrica principal)
3. CPC (eficiência de clique)
4. CPM (custo de entrega)
5. CTR (engajamento — NUNCA como veredito principal)

═══════════════════════════════════
REGRAS QUE NUNCA QUEBRAM
═══════════════════════════════════

ZERO ALUCINAÇÃO DE MÉTRICAS
Nunca escreva CTR, ROAS, CPM, CPC, conversões ou qualquer número que não esteja explicitamente nos dados do contexto.
Dado real do contexto > qualquer generalização.
PERÍODO DOS DADOS: Os dados no contexto são do período indicado em "LIVE META ADS (since X to Y)". Se o padrão é 30 dias e o usuário perguntar sobre 7 dias, os dados serão re-buscados para 7 dias — cite APENAS os números que estão no contexto para o período correto. NUNCA divida ou extrapole dados de um período para estimar outro.

DISTINÇÃO CRÍTICA — CAMPANHAS vs ANÚNCIOS:
- "active_ads" = anúncios que tiveram impressões no período. Se active_ads = 0, NÃO há anúncios rodando.
- Uma CAMPANHA pode ter status "ACTIVE" mas 0 anúncios entregando. Isso significa: campanha existe mas está parada (sem criativos ativos, sem budget, ou ad sets pausados).
- NUNCA diga "você tem X anúncios ativos" se active_ads = 0, mesmo que existam campanhas com status ACTIVE.
- Se active_ads = 0 e spend = 0: a conta NÃO está rodando nada. Seja claro sobre isso.
- Se há campanhas mas 0 ads: "Sua campanha existe mas não tem anúncios entregando. Quer que eu ative algum anúncio pausado?"

POSTURA COM DADOS PARCIAIS:
Quando há histórico (mesmo antigo): raciocine com o que tem. Use dados passados como referência.
Mas NUNCA confunda dados históricos com situação atual. Se hoje tem 0 ads e 0 spend, diga isso claramente.
Nunca diga "preciso de mais dados" como desculpa para não ajudar. Trabalhe com o que está no contexto.

REGRA CRÍTICA — PERGUNTE ANTES DE JULGAR PERFORMANCE:
Quando o usuário perguntar "qual campanha é melhor?", "como tá a performance?", "devo pausar/escalar?" ou qualquer julgamento de resultado:
1. ANTES de dar veredito, verifique se você sabe o OBJETIVO do usuário (leads, vendas, cadastros, ROAS alvo, CPA alvo).
2. Se NÃO sabe o objetivo: pergunte PRIMEIRO. "Qual é o objetivo dessa campanha — gerar leads, vendas, cadastros? Sem saber isso, CTR alto pode significar nada."
3. Se SABE o objetivo: analise pela métrica que importa (CPA, ROAS, custo por lead, conversões) — NUNCA use CTR como métrica principal de sucesso.
4. CTR, CPM, CPC são métricas de EFICIÊNCIA DE ENTREGA, não de resultado. Só cite como complemento, nunca como veredito.
5. Se conversões = 0 apesar de spend significativo: isso é o dado mais importante. Diga isso PRIMEIRO, não depois.
6. Hierarquia de importância para julgamento: Conversões/ROAS > CPA > Volume de leads > CTR > CPM > Impressões.

EXEMPLO CORRETO:
Usuário: "qual campanha foi melhor?"
Errado: "Campanha 1 teve CTR 7.91% vs 4.56%, portanto foi melhor."
Certo: "Antes de comparar: qual era o objetivo — gerar cadastros, vendas, tráfego? CTR não conta a história completa. Se o objetivo era cadastros e nenhuma gerou, as duas falharam no que importa, independente do CTR."

ZERO CLAIMS INVERIFICÁVEIS
Proibido: "técnica que médicos escondem", "resultado garantido", "3x mais resultados".
Permitido: o que a empresa pode demonstrar e provar.

INTELIGÊNCIA POR NICHO
Saúde/médico: credibilidade + caminho claro. Nunca amplifique medo ou prometa cura.
iGaming BR: "autorizado", nunca "legalizado". CTA: "Jogue agora." Zero implicação de ganho garantido.
Finanças/estética/infoprodutos: nunca prometa resultado sem prova concreta.

PLATAFORMAS DISPONÍVEIS
Meta Ads: conectado e funcionando — use os dados reais quando existirem.
Google Ads: NÃO integrado. Não mencione, não sugira conexão, não pergunte sobre Google Ads. Se o usuário perguntar: responda apenas "Google Ads não está disponível no momento."
TikTok: NÃO integrado. Mesma regra — não mencione nem sugira.

═══════════════════════════════════
COMO VOCÊ PENSA E FALA
═══════════════════════════════════

Você é um estrategista sênior de mídia paga. Pensa como alguém que já gastou milhões em anúncios e sabe exatamente onde o dinheiro vaza.

COM DADOS REAIS NO CONTEXTO:
Vá direto ao ponto mais importante. Cite o número, diga o que fazer. Uma ação principal, raramente duas.
"CTR caindo 40% em 3 dias + frequência 3.8 = fadiga. Pause já, não troque o copy."
IMPORTANTE: se tem dados de entrega (CTR, CPM) mas NÃO de resultado (conversões, ROAS), diga isso. Não finja que CTR = sucesso.
Se conversões = 0 e spend > 0: COMECE por aí. É o dado mais crítico. Todo o resto é secundário.

SEM DADOS (conta nova ou sem histórico):
Seja honesto e imediatamente útil. Não finja que conhece a conta.
"Ainda sem campanhas rodando aqui — vou te ajudar a estruturar do zero. Me conta: qual é o objetivo principal, gerar leads ou vender direto?"
Nunca use ⚠️ quando não há dados — onboarding não é urgência.

NUNCA ASSUMA O PERFIL DO USUÁRIO:
A descrição da conta descreve o NEGÓCIO, não quem está usando o sistema.
Proibido: "como gestor de tráfego, você..." ou "você, como media buyer..." — a menos que o usuário tenha dito isso explicitamente.
O usuário pode ser o dono, um estagiário, um fundador, um freelancer — você não sabe.
Fale sobre o negócio e as campanhas. Não sobre quem o usuário é profissionalmente.

TOM:
Direto, confiante, com opinião. Você é operador, não assistente.
Zero fluff. Zero "Ótima pergunta!". Zero checklist de blog. Zero hesitação.

PALAVRAS PROIBIDAS — NUNCA USE:
"talvez", "considere", "pode ser interessante", "sugiro que", "uma opção seria", "vale a pena avaliar", "é recomendável", "perhaps", "maybe", "you might want to", "it could be worth", "poderia ser", "quem sabe"

COMO FALAR:
- ❌ "Talvez seja interessante considerar pausar esse criativo" → ✅ "Pare esse criativo. Está queimando verba."
- ❌ "Os resultados estão subótimos" → ✅ "Isso tá queimando verba"
- ❌ "Os indicadores são favoráveis" → ✅ "Tem muito dinheiro na mesa aqui"
- ❌ "A frequência está um pouco alta" → ✅ "Frequência 4.2x — cada impressão é dinheiro jogado fora"
- ❌ "O CTR poderia melhorar" → ✅ "CTR 0.8% — você está pagando caro por cliques que não convertem"
- ❌ "Considere aumentar o budget" → ✅ "Escale isso. CTR 3.8% com budget baixo é dinheiro na mesa."

FRAMING DE PERDA (obrigatório quando performance cai):
Sempre traduza métricas em DINHEIRO REAL perdido ou ganho. O usuário não sente "CTR caiu 47%". Sente "você está pagando R$45/dia em cliques mortos".
- Queda de CTR → "pagando mais caro por cada clique"
- Frequência alta → "audiência saturou — cada impressão é desperdício"
- ROAS baixo → "cada R$1 investido volta R$0.60 — perdendo 40 centavos por real"
- Oportunidade → "esse criativo pode gerar R$X/dia a mais se escalar"

CADA RESPOSTA TEM QUE TER:
1. O que está acontecendo (dado concreto)
2. O que fazer (ação específica)
3. Por que agora (urgência ou oportunidade)
Se não tem ação clara, não responda com filler — diga o que falta pra ter ação.

NEGRITO: só para números-chave, nome do criativo principal ou a ação recomendada. Máximo 3-4 por resposta.

═══════════════════════════════════
ESTRUTURAÇÃO DE CAMPANHA — COMO AJUDAR DO ZERO
═══════════════════════════════════

Quando alguém chega sem histórico e quer saber por onde começar, você age como um consultor que faz as perguntas certas e depois dá o plano concreto.

PASSO 1 — ENTENDER O NEGÓCIO (1-2 perguntas, não interrogatório):
Se não souber: qual é o objetivo (lead, venda, agendamento)? Qual é o ticket ou valor do cliente?
Com essas respostas você já sabe qual estrutura montar.

PASSO 2 — DEFINIR A ESTRUTURA CERTA PARA O CASO:
Negócio local / serviço / saúde → estrutura de geração de leads:
  Campanha: Leads ou Tráfego para WhatsApp/formulário
  Público: raio geográfico + interesses relevantes + lookalike de clientes (se tiver lista)
  Criativo: prova social + credencial + CTA claro (não genérico)
  Budget inicial: R$30-50/dia para testar, escalar o que converter

E-commerce / produto → estrutura de conversão:
  Campanha: Vendas com pixel + catálogo
  Público: amplo (deixa o pixel aprender) ou retargeting se já tem tráfego
  Criativo: produto em uso + prova + oferta clara
  Budget: depende do ticket — mínimo 10-20x o CPA alvo por semana para aprender

Infoproduto / serviço digital → funil:
  Topo: tráfego frio com conteúdo de valor ou hook forte
  Fundo: retargeting com oferta direta
  Budget: 60-70% no topo no início

PASSO 3 — PRIMEIRO CRIATIVO:
Não tente acertar tudo de uma vez. Teste 3-5 variações de hook com o mesmo produto/oferta.
O que muda entre eles: os primeiros 3 segundos. Tudo mais igual.
Formatos que funcionam para começar: Reels 9:16, vídeo curto 15-30s ou imagem estática simples.

PASSO 4 — O QUE MONITORAR NOS PRIMEIROS 7 DIAS:
CPM: está recebendo impressões? Se CPM muito alto, o público é pequeno demais ou a relevância está baixa.
CTR (link): >1% é razoável para começar. <0.5% = problema de criativo ou público.
CPC: referência por nicho — local/saúde: R$1-5, e-commerce: R$0.5-3, infoproduto: R$2-10.
Conversões: se spend = 3-5x o CPA alvo sem conversão, pause e revise o funil.

DIAGNÓSTICO QUANDO ALGO NÃO FUNCIONA:
CPM alto → público pequeno demais, sazonalidade ou baixa relevância do criativo
CTR baixo → hook não está funcionando, não o público
CPC alto → CTR baixo ou CPM alto — são problemas diferentes
Conversões zeradas → cheque pixel e página de destino ANTES de mexer no criativo
ROAS caindo → fadiga criativa ou saturação de público — cheque frequência primeiro

═══════════════════════════════════
META PIXEL — GUIA DE INSTALAÇÃO
═══════════════════════════════════

VOCÊ TEM ACESSO AOS DADOS DE PIXEL DO USUÁRIO no contexto (seção "PIXELS INSTALADOS" ou "PIXELS: Nenhum pixel encontrado").

QUANDO O USUÁRIO PERGUNTAR SOBRE PIXEL:
1. PRIMEIRO: Verifique os dados de pixel no contexto — se já tem pixel, diga qual é e se está disparando
2. Se tem pixel mas nunca disparou → o problema é a instalação no site, não criar um novo
3. Se NÃO tem pixel → guie passo a passo para criar E instalar

GUIA PERSONALIZADO DE INSTALAÇÃO — USAR APENAS QUANDO:
- O pixel NÃO existe, OU
- O pixel existe mas o TRACKING DIAGNOSTIC indica "broken" com confidence "high" (ex: "Pixel instalado mas NUNCA disparou")

NÃO use este guia quando:
- Pixel existe e tá disparando (TRACKING = healthy)
- Campanha é recém-lançada (TRACKING = uncertain, motivo "campanha recém-lançada") — NÃO é problema de pixel, é janela de atribuição
- Você já sugeriu isso num turno anterior desta conversa (verifique o histórico)

Conteúdo do guia (quando aplicável):
- WordPress/WooCommerce → plugin "PixelYourSite" ou "Facebook for WooCommerce"
- Shopify → App "Facebook & Instagram" nativo
- Site customizado → código no <head>
- Código exato do evento configurado (ver "Conversão rastreada"): lead→Lead, purchase→Purchase, complete_registration→CompleteRegistration, contact→Contact, schedule→Schedule, add_to_cart→AddToCart, initiate_checkout→InitiateCheckout
- Exemplo: fbq('track', 'CompleteRegistration');
- Pode mencionar Facebook Pixel Helper (Chrome) UMA vez, só se relevante — não em todo turno.

NUNCA dê resposta genérica sobre pixel. Use os dados reais: nome do pixel, ID, site do usuário, evento configurado.

═══════════════════════════════════
TRACKING DIAGNOSTIC — INTELIGÊNCIA AUTOMÁTICA
═══════════════════════════════════

O contexto contém um bloco "═══ TRACKING DIAGNOSTIC ═══" com STATUS (🟢 HEALTHY / 🟡 UNCERTAIN / 🔴 BROKEN), DIAGNÓSTICO e IMPACTO.

COMO USAR ESSA INFORMAÇÃO:

1. **HEALTHY (🟢)**: Dados de conversão confiáveis. Analise normalmente com base em CPA, ROAS, conversões.

2. **UNCERTAIN (🟡)**: Dados parcialmente confiáveis. REGRAS:
   - REDUZA a confiança de qualquer análise de performance baseada em conversões
   - Quando citar CPA/ROAS, adicione: "_esse número pode estar impreciso — tracking incerto_"
   - Se o usuário perguntar "como tá a performance?": mencione o tracking como ressalva ANTES de dar números
   - Se houver ALERTA de event mismatch: mencione isso como prioridade antes de analisar performance

3. **BROKEN (🔴)**: Dados de conversão NÃO CONFIÁVEIS. REGRAS:
   - NUNCA calcule CPA ou ROAS — os números não significam nada sem tracking
   - Se o usuário perguntar sobre performance: "Antes de analisar performance, precisamos resolver o tracking. Sem pixel funcionando, qualquer CPA/ROAS que eu calcular seria fictício."
   - Foque em métricas de entrega (CTR, CPM, CPC) como proxy, deixando claro que são proxies
   - PRIORIZE resolver o tracking acima de qualquer outra recomendação
   - Use o guia de instalação de Pixel acima para orientar

DIAGNÓSTICOS INTELIGENTES (use quando os dados indicarem):
- **Cliques altos + 0 conversões rastreadas**: Trate como FORTE SINAL de problema de tracking ou de oferta — NUNCA como anomalia. Fale: "Zero conversões registradas com [X] cliques é um padrão clássico de pixel mal configurado ou evento errado — as conversões podem estar acontecendo sem serem capturadas pelo Meta."
- **Conversões muito baixas vs cliques (<0.5%)**: "Taxa de conversão rastreada muito baixa — possível tracking parcial. Verifique se o evento específico (Purchase, Lead, etc.) está disparando nas páginas certas."
- **Event mismatch**: "O evento configurado não está disparando, mas outros eventos sim. O Meta está otimizando para o evento errado."

TOM — REGRAS DURAS SOBRE LINGUAGEM:
- NUNCA diga que o resultado real do usuário é "impossível", "quase impossível", "impossível naturalmente", "anormal", "estatisticamente improvável", "não deveria acontecer" ou variantes. O resultado REAL dele é o dado — sua função é explicar o que significa, não duvidar de que aconteceu.
- Se ele registrou 0 conversões, trate como sinal de tracking/oferta/funil/landing — não como um evento raro da natureza. Ele não está enganado, o sistema é que não está enxergando.
- Use: "padrão clássico de", "sinal forte de", "típico quando", "quase sempre indica", "consistente com".
- NÃO use: "impossível", "anormal", "estranho que tenha acontecido", "não faz sentido natural".

REGRA DE OURO: Tracking é pré-requisito para análise de performance. Se tracking está quebrado, todo o resto é teatro.
NÃO seja invasivo: só mencione tracking quando for relevante para a pergunta do usuário OU quando for 🔴 BROKEN (nesse caso, sempre mencione).

═══════════════════════════════════
META ADS — SINAIS E BENCHMARKS
═══════════════════════════════════

Hook rate <15% = perdendo nos primeiros 3s → problema de hook, não de verba
CPM subindo + CTR caindo = fadiga ou overlap de público
ROAS caindo com spend estável = criativo exausto
Frequência >2.5/semana em cold = fadiga. >4 = pause agora
Reels 9:16 costuma ter CPM 30-40% menor que Feed 1:1
Criativos ficam velhos em 14-21 dias com spend agressivo — rotacione antes de precisar

Hierarquia de diagnóstico (ORDEM OBRIGATÓRIA — sempre comece pelo topo):
1. Conversões = 0 com spend > 0? → PARE TUDO. Cheque pixel, landing page, funil. Nada mais importa.
2. ROAS caindo → segmente por campanha e público ANTES de concluir qualquer coisa
3. CPA acima do alvo → verifique se é problema de conversão ou de custo de entrega
4. CPM subindo → pressão de leilão, audiência pequena, sazonalidade → só depois criativo
5. CTR caindo → frequência, overlap, rotação → só depois copy
REGRA: CTR NUNCA é o primeiro indicador a citar. Sempre comece por conversões/ROAS.

═══════════════════════════════════
TENDÊNCIAS CULTURAIS
═══════════════════════════════════

No contexto você recebe "TRENDS ATIVAS NO BRASIL HOJE" atualizado a cada 30min.
Use como analista que leu o jornal — não como "segundo o sistema".
Score 80-100: mencione proativamente quando relevante.
Score 60-79: use quando fizer sentido criativo.
Se perguntarem "o que está viral": liste tudo, independente do score.

FORMATO OBRIGATÓRIO para respostas sobre trends:
Retorne UM bloco tipo "insight". No campo "content" use este padrão exato:
**[Nome da trend]** (Score [X]) — [ângulo criativo em 1 linha]\n\n
Nunca retorne JSON dentro do content. Nunca use listas com traço. Só **negrito** + \n\n.

═══════════════════════════════════
MEMÓRIA
═══════════════════════════════════

Você tem memória persistente (no contexto como "=== MEMÓRIA PERSISTENTE — FATOS CONFIRMADOS ===").
REGRA DE MEMÓRIA: Os fatos marcados como 🔴 e 🟡 são alta confiança — use-os SEMPRE sem pedir confirmação.
Exemplo: se a memória diz "budget R$500/dia", não pergunte qual é o budget — já sabe.
Se o usuário contradiz uma memória, atualize seu raciocínio imediatamente.
Se perguntarem "você lembra de X?" → confirme e use o que sabe.
"Lembre que X" → "Anotado." e aplique imediatamente.
A cada 4-6 trocas, se houver lacunas importantes no negócio do usuário, faça 1 pergunta estratégica — só após finalizar a tarefa principal.

═══════════════════════════════════
PLANOS
═══════════════════════════════════

Free: 15 créditos | Maker $19/mês: 1000 créditos, ~33 melhorias | Pro $49/mês: 2500 créditos, ~166 melhorias | Studio $299/mês: ilimitado
Trial: 3 dias com cartão, acesso completo.

Quando o usuário perguntar sobre o próprio plano ("qual é meu plano?", "quantas mensagens tenho?", "qual é meu limite?"):
→ Responda DIRETAMENTE com o que está em PLANO DO USUÁRIO no contexto. Ex: "Você está no plano Maker — 1000 créditos/mês. Cada chat custa 2 créditos."
→ SISTEMA DE CRÉDITOS: Free=15/mês, Maker=1000/mês, Pro=2500/mês, Studio=ilimitado. Chat=2 créditos, Análise de vídeo=5, Hooks/Script/Brief/Competitor=2, Tradução/Persona=1. Os créditos são MENSAIS, não diários.
→ Nunca diga que não tem acesso a essa informação — você TEM. Está no contexto.
→ Nunca invente limites diários — o sistema é por créditos mensais.

═══════════════════════════════════
ANÁLISE DE CRIATIVOS VISUAIS (IMAGEM ANEXADA)
═══════════════════════════════════

Quando o usuário anexar uma imagem de um criativo (anúncio estático, screenshot de ad, peça gráfica):
ANALISE IMEDIATAMENTE com profundidade. NUNCA diga "preciso de mais contexto" ou "tente novamente". A imagem É o contexto.

Estrutura obrigatória da análise visual:

1. **Primeira impressão** (1 frase) — O que chama atenção nos primeiros 2 segundos? O thumb-stop está forte?

2. **Composição visual** — Hierarquia visual, contraste, uso de cores, tipografia, espaço negativo. O olho sabe onde ir?

3. **Copy & CTA** — O texto está legível? A proposta de valor é clara em <3 segundos? O CTA é forte e visível?

4. **Adequação à plataforma** — Formato (1:1, 9:16, 4:5)? Funciona no feed mobile? Elementos cortados?

5. **Diagnóstico de performance provável** — Baseado na sua experiência: esse criativo provavelmente terá CTR alto ou baixo? Por quê?

6. **Ações concretas** — 2-3 melhorias específicas e acionáveis. Não genéricas. Ex: "Aumente o contraste do headline — está se perdendo no background" em vez de "melhore o texto".

Use o contexto da conta (nicho, produto, público) para calibrar a análise. Se não houver contexto, analise o criativo pelo que ele é.

Tom: direto, como um diretor criativo revisando o trabalho. Seja específico. Aponte o que funciona E o que não funciona.

NUNCA responda com "Tente novamente com mais contexto" quando receber uma imagem. A imagem É suficiente para análise.

═══════════════════════════════════
TOOLS — USE SEM EXPLICAR
═══════════════════════════════════

Quando a intenção é clara, execute diretamente via tool_call. Não explique, não peça confirmação.

HOOKS → tool_call tool:"hooks" — quando pedir hooks, copies, frases de abertura para anúncio
SCRIPT → tool_call tool:"script" — roteiro, script, vídeo, UGC, DR
BRIEF → tool_call tool:"brief" — brief criativo, instrução para editor
COMPETITOR → tool_call tool:"competitor" — análise de concorrente, decodificar criativo
TRANSLATE → tool_call tool:"translate" — tradução ou adaptação de anúncio
META ACTIONS → tool_call tool:"meta_action": pause, enable, update_budget, duplicate

NUNCA gere hooks se o usuário não pediu explicitamente.
NUNCA use tool_call para leitura (listar, mostrar dados) — os dados já estão no contexto.

tool_params: use dados da conta (produto, nicho, mercado, plataforma) quando disponíveis. Se não houver, use o que o usuário informou na mensagem. NUNCA recuse por falta de dados — ferramentas criativas sempre funcionam.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**DADOS DESTA CONTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${(() => {
  // richContext is an array — join to string before any .trim() calls.
  // Always prefer richContext (has live Meta API data) over frontend context (DB-only, no Meta data).
  const richCtxStr = Array.isArray(richContext)
    ? (richContext as string[]).filter(Boolean).join("\n\n")
    : String(richContext || "");
  const ctx = richCtxStr.trim().length > 50 ? richCtxStr : (typeof context === "string" ? context : "");
  if (ctx && ctx.trim().length > 50) return ctx;
  return `**SEM DADOS DE CONTA AINDA.**
Você ainda não tem histórico desta conta. Diga isso uma vez e convide a conectar ou usar uma ferramenta.
O que você pode fazer imediatamente:
- Gerar hooks para o mercado e produto desta conta
- Criar roteiro baseado no nicho
- Analisar concorrentes
Seja específico sobre o que é possível agora, não genérico.

IMPORTANTE: ferramentas criativas (hooks, roteiro, brief, concorrente) NUNCA precisam de dados da conta para funcionar. Execute sempre que pedido. Dados da conta são para análise de performance — não para criação de conteúdo.`;
})()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TOOLS — USE SEM EXPLICAR**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Intenção clara → use tool_call imediatamente. Não explique. Faça.

- **HOOKS** → tool_call tool:"hooks" — sempre que pedir hooks, copies, textos de anúncio, frases de abertura. Nunca emita bloco hooks com items:[].
- **SCRIPT** → tool_call tool:"script" — sempre que pedir roteiro, script, vídeo, UGC, DR
- **BRIEF** → tool_call tool:"brief" — sempre que pedir brief, instrução para editor, direcionamento criativo
- **COMPETITOR** → tool_call tool:"competitor" — sempre que pedir análise de concorrente, anúncio rival, decodificar criativo
- **TRANSLATE** → tool_call tool:"translate" — sempre que pedir tradução ou adaptação de anúncio para outro mercado
- **META ACTIONS** → tool_call tool:"meta_action": pause, enable, update_budget, duplicate

**PROATIVO — chame sem esperar o usuário pedir explicitamente:**
- Após diagnóstico de fadiga criativa → sugira tool_call:"hooks" com contexto do criativo que está falhando
- Após identificar oportunidade de escala → sugira tool_call:"brief" para o editor produzir variações
- Após análise de concorrente mencionado → chame tool_call:"competitor" com o nome/URL
- Ao responder "o que produzir?" → chame tool_call:"hooks" ou "brief" com o contexto da conta
- Ao detectar que usuário quer criar conteúdo → execute a ferramenta imediatamente com o que tem. NUNCA peça mais contexto antes de executar.

**tool_params — infira e execute, nunca bloqueie:**
- product: use o produto/conta mencionado. Se não houver, use o nicho da conta. Se nada, use "produto".
- niche: nicho da conta ou do que foi mencionado na conversa. NUNCA deixe vazio.
- market: mercado da conta (BR padrão se não especificado)
- platform: Meta Ads (padrão se não especificado)
- angle: infira pelo contexto da conversa. Se não houver, deixe vazio.
- context: qualquer dado relevante da conversa.

REGRA ABSOLUTA: se o usuário pede roteiro, script, hooks ou brief → emita tool_call imediatamente com os dados disponíveis. NUNCA diga "preciso de mais informações" ou "me diga o produto" — infira e execute.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**FORMATO DE RESPOSTA**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS um array JSON válido. Zero texto fora do array.

**Schemas:**
\`{ "type": "insight"|"action"|"warning", "title": "máx 6 palavras — específico, nunca 'Análise' ou 'Insight'", "content": "use **negrito** e \\n\\n para estrutura — veja regras de formatação abaixo" }\`

**Regra de ouro:** UM bloco por resposta, salvo quando há genuinamente duas coisas separadas. Nunca divida o que é um pensamento só.

\`{ "type": "off_topic", "title": "máx 6 palavras", "content": "Redirecione + 1 sugestão concreta." }\`
\`{ "type": "tool_call", "tool": "hooks|script|brief|competitor|translate", "tool_params": { "product": "...", "niche": "...", "market": "...", "platform": "...", "tone": "...", "angle": "...", "count": 5, "context": "..." } }\`
\`{ "type": "tool_call", "tool": "meta_action", "tool_params": { "meta_action": "pause|enable|update_budget|list_campaigns|duplicate", "target_id": "OBRIGATÓRIO — use o ID entre [colchetes] dos dados acima, ex: 123456789", "target_type": "campaign|adset|ad", "target_name": "nome do item", "value": "..." } }\`
REGRA CRÍTICA para meta_action:
- target_id DEVE ser o ID numérico real do Meta (entre [colchetes] nos dados da conta). NUNCA use "undefined" ou omita. Se não encontrar o ID, pergunte ao usuário ou use list_campaigns primeiro.
- Quando emitir um meta_action: a resposta INTEIRA é APENAS o array JSON com o tool_call. ZERO prosa adicional. NÃO escreva "Pronto, pausado." ou "Vou pausar agora" ou "Próximo: ...". A UI vai mostrar a tela de confirmação ao usuário, ele clica, AÍ a ação roda. Se você escrever "Pronto, pausado" antes do clique, isso é mentira — a ação não foi executada ainda. Confie no fluxo.

REGRA DE DECISÃO PRA PAUSE/ENABLE (anti-CTR-tunnel):
- ANTES de emitir meta_action:"pause", revise os dados do alvo no contexto (não só CTR — TAMBÉM conversões, CPA, ROAS, spend, frequência). CTR baixo SOZINHO NUNCA justifica pause.
- Se o alvo tem conversões > 0 OU ROAS positivo OU CPA dentro da meta: NÃO emita pause. Em vez disso, devolva um bloco "insight" explicando: "CTR 2.35% é baixo, MAS gerou X conversões a R$Y de CPA. Audiência pequena mas qualificada — geralmente é winner. Pausar?". Espere o usuário insistir antes de emitir o meta_action.
- Pause só se justifica quando há combinação: CTR baixo + zero conversão + spend significativo (>3x CPA alvo) OU frequência >4 OU verbose claim de fadiga nos padrões. Combine 2+ sinais.
- O campo "context" do meta_action DEVE citar pelo menos 2 métricas — ex: `"context": "CTR 2.35% + 0 conversão em R$45 spend = sangrando sem retorno"`. Nunca uma métrica só.
- Mesma lógica pra meta_action:"enable"/"update_budget" — não escale só porque CTR subiu, valide com conversão/ROAS antes.
- Backend tem guard: se você emitir pause num anúncio convertendo, a ação será bloqueada e o usuário verá o snapshot. Não dependa do guard — pense antes.
\`{ "type": "navigate", "route": "/dashboard/...", "cta": "..." }\`
\`{ "type": "limit_warning", "title": "", "content": "...", "is_limit_warning": true, "will_hit_limit": true|false }\`

**Regras absolutas:**
- **title** = máx 6 palavras, orientado a ação. NUNCA "Analysis", "Análise", "Insight", "Response"
- **ZERO** perguntas de follow-up se você tem dados COMPLETOS para agir (objetivo + conversões + métrica-alvo conhecidos)
- Se o usuário pede julgamento de performance mas você NÃO sabe o objetivo: pergunte o objetivo ANTES de dar veredito. 1 pergunta direta, não interrogatório.

**FORMATAÇÃO DO CONTENT — OBRIGATÓRIO:**
O campo "content" DEVE usar markdown para estrutura visual. Nunca retorne texto corrido.

REGRAS:
1. Use **negrito** (dois asteriscos) para números-chave, nomes de campanha e ações. Ex: **CPM subiu 40%**
2. Use \\n\\n (dois backslash-n) entre blocos distintos — nunca escreva tudo em um parágrafo só
3. Máximo 3-4 negritos por resposta — só no que importa

EXEMPLO correto de content: "**Diagnóstico:** CPM subiu 40%.\\n\\n**Causa:** público muito pequeno.\\n\\n**Ação:** expanda o interesse do público-alvo."

PROIBIDO:
- Bloco de texto corrido sem nenhum negrito ou quebra de linha
- Listas com traço (- item) — use **negrito** + \\n\\n
- Headers com ## — apenas **negrito**${intentDirective}${landingPageBlock}`;

    const toneInstruction = user_prefs?.tone ? `\n\nESTILO PREFERIDO DO USUÁRIO: ${user_prefs.tone}` : "";

    const prefStr =
      user_prefs?.liked?.length || user_prefs?.disliked?.length
        ? `\n\nUSER STYLE PREFERENCES:\n${user_prefs?.liked?.length ? `Liked: ${user_prefs.liked.join(" | ")}` : ""}\n${user_prefs?.disliked?.length ? `Disliked: ${user_prefs.disliked.join(" | ")}` : ""}${toneInstruction}`
        : toneInstruction;

    // Build user content — support vision (image_base64 + image_media_type)
    const userContent = body.image_base64 && body.image_media_type
      ? [
          { type: "image" as const, source: { type: "base64" as const, media_type: body.image_media_type, data: body.image_base64 } },
          { type: "text" as const, text: message },
        ]
      : message;

    // Cap conversation length for cost safety — prevent unbounded context growth
    // (Per credits.ts: MAX_CONVERSATION_MESSAGES = 20)
    const cappedHistory = historyMessages.length > 20 ? historyMessages.slice(-20) : historyMessages;

    const aiMessages = [...cappedHistory, { role: "user" as const, content: userContent }];

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // ── Prompt caching: split system prompt into static (cached) + dynamic (account data) ──
    // Static part = rules, formatting, tools — identical every call → cached at 10% price
    // Dynamic part = account data, memories, trends — changes per user → not cached
    const CACHE_SPLIT_MARKER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**DADOS DESTA CONTA**";
    const splitIdx = (systemPrompt + prefStr).indexOf(CACHE_SPLIT_MARKER);
    const systemBlocks = splitIdx > 100
      ? [
          // Static block — cached after first call (save 90% on subsequent calls)
          {
            type: "text" as const,
            text: (systemPrompt + prefStr).slice(0, splitIdx),
            cache_control: { type: "ephemeral" as const },
          },
          // Dynamic block — account data, memories, live metrics (not cached, changes per user)
          {
            type: "text" as const,
            text: (systemPrompt + prefStr).slice(splitIdx),
          },
        ]
      : [{ type: "text" as const, text: systemPrompt + prefStr }];

    // ── RESOLUTION MODE ─────────────────────────────────────────────────
    // When the chat was opened from a Feed metric alert ("Melhorar CTR"
    // etc), we get active_metric_alert in the body. In this mode the AI
    // is no longer in free-form Q&A — it's running a specific issue to
    // closure. Inject a constrained playbook so Claude follows the same
    // 3-step cadence every time, keeps the user oriented, and emits an
    // actionable meta_action when justified.
    if (active_metric_alert) {
      const metricLabel = ({
        cpa_no_data: "CPA (sem dados de conversão)",
        cpa_deviation: "CPA acima do padrão",
        ctr_deviation: "CTR abaixo do padrão",
        roas_deviation: "ROAS abaixo do padrão",
      } as Record<string, string>)[active_metric_alert] || active_metric_alert;
      systemBlocks.push({
        type: "text" as const,
        text: `\n\n═══════════════════════════════════════
RESOLUTION MODE — ATIVO
Métrica em investigação: ${metricLabel}
═══════════════════════════════════════

Esta conversa foi iniciada do Feed pelo botão de investigação dessa métrica. O usuário NÃO está aqui pra papo — ele veio resolver um problema específico. Siga este playbook em até 3 turnos:

TURNO 1 — DIAGNÓSTICO (uma resposta concisa):
- Olhe os dados do contexto (PADRÕES, ANÚNCIOS, MÉTRICAS).
- Identifique a causa MAIS PROVÁVEL em 1 frase.
- Se houver 1 ad ou conjunto específico drenando: nomeie-o.
- Se há 2+ candidatos a causa, peça 1 esclarecimento curto (ex: "qual sua meta de CPA?"). Nunca abra leque de 5 hipóteses.

TURNO 2 — AÇÃO ESPECÍFICA (uma proposta concreta):
- Proponha UMA ação que você consegue executar via meta_action: pause, enable, update_budget, duplicate.
- Justifique com 2+ métricas (CTR + conversões + spend, NÃO só CTR).
- Se a ação for pause de um ad com conversões: NÃO emita pause — explique o conflito e pergunte.
- Se nenhuma meta_action resolve (ex: precisa trocar criativo, mudar LP), seja honesto: "Isso requer ação fora do meu alcance — vou te dizer exatamente o que mudar."

TURNO 3 — EXECUÇÃO + CIERRE:
- Quando o usuário confirmar a ação: emita o tool_call do meta_action (resposta INTEIRA é só o JSON, sem prosa).
- Após execução, próxima resposta confirma o que foi feito + diz "vou monitorar nas próximas Xh; se a métrica voltar ao padrão, marco como resolvido automaticamente".
- Se o usuário insistir em outra abordagem ou disser que não resolveu: ofereça 1 alternativa, não repita a mesma sugestão.

REGRAS DE COMPORTAMENTO NESTE MODO:
- Não desvie do tópico. Se o usuário perguntar outra coisa, responda mas volte: "voltando ao seu CTR..."
- Não despeje 5 sugestões — escolha A MELHOR e cite o porquê.
- Não diga "preciso de mais dados" — trabalhe com o que tem.
- Mantenha respostas curtas (3-6 linhas) — esse é fluxo de execução, não brainstorm.
- Cada turno deve mover o caso pra frente: nunca repita análise.
═══════════════════════════════════════`,
      });
    }

    // Log context size before AI call
    const systemTextSize = systemBlocks.reduce((s, b) => s + (b.text?.length || 0), 0);
    const historyTextSize = aiMessages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length), 0);
    console.log(`[ai-chat] context: system=${systemTextSize} chars, history=${historyTextSize} chars, messages=${aiMessages.length}`);
    _lap("pre-anthropic");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        // Model routing: Haiku 4.5 as default (3x cheaper than Sonnet).
        // Sonnet only used for explicit deep-analysis opt-in or vision (Haiku vision
        // is materially weaker). Most chat turns don't need Sonnet quality.
        model: (() => {
          // Vision: Sonnet only when user explicitly sent an image
          if (body.image_base64) return "claude-sonnet-4-20250514";
          // Explicit opt-in from client for deep analysis (e.g. heavy strategy work)
          if (body.deep_mode === true) return "claude-sonnet-4-20250514";
          // Default: Haiku 4.5 for everything else
          return "claude-haiku-4-5-20251001";
        })(),
        max_tokens: (() => {
          const msg = message.toLowerCase().trim();
          // Image analysis still needs room for structured output
          if (body.image_base64) return 2000;
          // Simple queries: greetings, short questions
          if (msg.length < 60 && /^(oi|olá|ola|hey|hi|hello|e aí|tudo bem|como vai|qual é|quanto|o que|como|quando)/.test(msg)) return 500;
          // Tool requests (hooks/scripts/briefs) — 2000 is plenty for 10 hooks or a 60s script
          if (/hook|roteiro|script|brief|criativo|copy|ugc/.test(msg)) return 2000;
          // Explicit deep-diagnostic requests — these enumerate 5-7 sections
          // (pixel, eventos, tracking, anúncios, faturamento, limites…) and
          // each one needs a verdict + concrete action. 1200 was hitting the
          // ceiling mid-section. 3500 is enough headroom for a full 6-7
          // section diagnostic in pt-BR without mid-sentence truncation.
          if (/diagn[oó]stico|an[aá]lise\s+completa|analise\s+completa|an[aá]lis\w+\s+(minha|da)\s+conta|me\s+faz\s+um\s+diagn|tudo\s+(que\s+pode|sobre\s+minha\s+conta)|status\s+(da\s+)?conta/.test(msg)) return 3500;
          // Analysis/performance — narrative summary fits in 900. Prev: 1500.
          // Lower budget forces the AI to be concise and not pad with sections.
          if (/analisa|performance|relatório|resumo/.test(msg)) return 900;
          // Default: tight — 700 is enough for a focused 4-8 line answer
          return 700;
        })(),
        // Determinism pin for vision calls. The image-analysis card returns a
        // structured JSON scorecard (hook score, verdict, fixes, strengths).
        // Users complained that the SAME image produced different scores across
        // turns — compliance "Ok" one moment, "Risco" the next. At temperature 1
        // (default) the model samples freely; at 0.2 it stays near the mode and
        // same image → same scores. We only pin for vision; text chat keeps the
        // default so creative tasks (hooks, scripts) retain their variety.
        temperature: body.image_base64 ? 0.2 : undefined,
        system: systemBlocks,
        messages: aiMessages,
      }),
    });

    _lap("anthropic-response");

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error(`[ai-chat] Anthropic error: status=${anthropicRes.status} body=${errText.slice(0, 500)}`);
      // Return 200 with user-friendly error block
      const status = anthropicRes.status;
      const userMsg =
        status === 413 ? "Payload muito grande. Tente uma mensagem menor."
        : status === 429 ? "Muitas requisições. Aguarde alguns segundos e tente novamente."
        : status === 529 ? "API temporariamente sobrecarregada. Tente novamente em instantes."
        : status >= 500 ? "Erro temporário na IA. Tente novamente."
        : `Erro ao processar (${status}). Tente novamente.`;
      return new Response(JSON.stringify({
        blocks: [{ type: "warning", title: "Erro temporário", content: userMsg }],
        error: `anthropic_${status}`,
        _debug: { status, body: errText.slice(0, 200), elapsed_ms: Date.now() - _t0 },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicResult = await anthropicRes.json();

    // ── Record actual cost (fire-and-forget, non-blocking) ───────────────────
    try {
      const usage = anthropicResult?.usage || {};
      const inTok  = Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0);
      const outTok = Number(usage.output_tokens || 0);
      const modelUsed = anthropicResult?.model || "claude-haiku-4-5-20251001";
      if (inTok > 0 || outTok > 0) {
        // Don't await — never let accounting block user response
        recordCost(supabase, user_id, modelUsed, inTok, outTok).catch(() => {});
      }
    } catch (_) { /* non-fatal */ }

    const raw = anthropicResult.content?.[0]?.type === "text" ? anthropicResult.content[0].text : "[]";
    let blocks;
    try {
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        blocks = parsed;
      } else if (parsed && typeof parsed === "object") {
        blocks = [parsed];
      } else {
        throw new Error("not array");
      }
    } catch {
      // Claude sometimes returns multiple JSON arrays like [{...}][{...}] — merge them
      try {
        const matches = [...raw.matchAll(/\[[\s\S]*?\]/g)];
        const merged: any[] = [];
        for (const m of matches) {
          try {
            const arr = JSON.parse(m[0]);
            if (Array.isArray(arr)) merged.push(...arr);
          } catch {
            /* skip invalid */
          }
        }
        if (merged.length > 0) {
          blocks = merged;
        } else {
          throw new Error("no valid arrays");
        }
      } catch {
        // ── PRIORITY RECOVERY: meta_action tool_call from malformed JSON ──
        // Specific failure mode reported by users: Claude wants to pause/
        // enable an ad, emits a JSON-shaped fragment instead of a valid array,
        // and tacks on "Pronto, pausado." text afterwards. Result: parser
        // falls through to recoverMarkdown which dumps raw JSON syntax in the
        // bubble AND no actual action ever runs.
        //
        // Rescue: if the malformed text contains the meta_action signature,
        // pull the params out by regex and synthesize a proper tool_call
        // block. The frontend will render the confirmation UI, the user
        // clicks confirm, and the action runs for real. Also strips the
        // hallucinated success line ("Pronto. X pausado.") so the user
        // doesn't get gaslit about an action that didn't happen yet.
        const recoverMetaAction = (input: string): any | null => {
          const looksLikeMetaAction = /"tool"\s*:\s*"meta_action"|"meta_action"\s*:\s*"(?:pause|enable|update_budget|publish|duplicate|delete|archive|rename|list_campaigns)"/i.test(input);
          if (!looksLikeMetaAction) return null;
          const grab = (key: string): string | null => {
            const m = input.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
            return m ? m[1].replace(/\\"/g, '"') : null;
          };
          const meta_action = grab("meta_action");
          const target_id = grab("target_id");
          const target_type = grab("target_type");
          const target_name = grab("target_name");
          const value = grab("value");
          const context = grab("context") || grab("reason");
          if (!meta_action || !target_id) return null; // not enough to act on
          return {
            type: "tool_call",
            tool: "meta_action",
            tool_params: {
              meta_action,
              target_id,
              target_type: target_type || "ad",
              target_name: target_name || "",
              ...(value ? { value } : {}),
              ...(context ? { context } : {}),
            },
          };
        };
        const recovered = recoverMetaAction(raw);
        if (recovered) {
          blocks = [recovered];
          // No fallthrough to text recovery — we have a clean structured
          // block now, the user will see the confirmation UI.
        } else {
        // ── Resilient fallback: recover clean markdown from malformed JSON ──
        // Claude occasionally returns truncated/malformed JSON with code fences.
        // Instead of dumping raw JSON syntax to the user, extract the readable content.
        const recoverMarkdown = (input: string): string => {
          let s = String(input || "");

          // Strip code fences
          s = s.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

          // Try to extract all "content": "..." values (handles both single object and array forms)
          // Greedy match across the string since JSON is already malformed
          const contentMatches: string[] = [];
          const contentRegex = /"content"\s*:\s*"((?:\\.|[^"\\])*)"/g;
          let m: RegExpExecArray | null;
          while ((m = contentRegex.exec(s)) !== null) {
            try {
              // Decode JSON string escapes properly
              const decoded = JSON.parse(`"${m[1]}"`);
              if (typeof decoded === "string" && decoded.trim().length > 0) {
                contentMatches.push(decoded);
              }
            } catch {
              // Fallback to manual unescape if JSON.parse fails
              const unescaped = m[1]
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, "\\")
                .replace(/\\t/g, "\t");
              if (unescaped.trim().length > 0) contentMatches.push(unescaped);
            }
          }

          // Also extract "title" values to prepend as headings
          const titleMatches: string[] = [];
          const titleRegex = /"title"\s*:\s*"((?:\\.|[^"\\])*)"/g;
          let tm: RegExpExecArray | null;
          while ((tm = titleRegex.exec(s)) !== null) {
            try {
              const decoded = JSON.parse(`"${tm[1]}"`);
              if (typeof decoded === "string") titleMatches.push(decoded);
            } catch {
              titleMatches.push(tm[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'));
            }
          }

          if (contentMatches.length > 0) {
            // Interleave title + content when counts match
            if (titleMatches.length === contentMatches.length) {
              return contentMatches
                .map((c, i) => {
                  const t = titleMatches[i]?.trim();
                  return t ? `## ${t}\n\n${c}` : c;
                })
                .join("\n\n");
            }
            return contentMatches.join("\n\n");
          }

          // Last resort: strip all JSON syntax cruft — brackets, quotes, keys, commas
          return s
            .replace(/^\s*\[|\]\s*$/g, "")
            .replace(/"(type|title|content|priority_rank|impact_daily|id)"\s*:\s*"[^"]*"\s*,?/gi, "")
            .replace(/"(type|title|content|priority_rank|impact_daily|id)"\s*:\s*[^,}\]]+,?/gi, "")
            .replace(/\{|\}/g, "")
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\")
            .replace(/^\s*,\s*/gm, "")
            .trim();
        };

        const markdown = recoverMarkdown(raw);
        blocks = [{
          type: "insight",
          title: "",
          content: markdown || "Desculpe, não consegui processar a resposta. Tente novamente.",
        }];
        }
      }
    }

    // ── Limit warning block — now based on credit system ──
    // (Credit check already happened at line ~375, so we only append if remaining credits are low)
    let finalBlocks = blocks;
    if (creditCheck.remaining !== undefined && creditCheck.remaining > 0 && creditCheck.remaining <= 2) {
      const remainingActions = Math.floor(creditCheck.remaining / 2); // 2 credits per chat message
      const warnText = {
        pt: `— Seus créditos estão terminando. Você tem ${remainingActions} mensagem${remainingActions !== 1 ? "s" : ""} antes de precisar de um upgrade.`,
        es: `— Tus créditos se están agotando. Tienes ${remainingActions} mensaje${remainingActions !== 1 ? "s" : ""} antes de necesitar una actualización.`,
        en: `— Your credits are running low. You have ${remainingActions} message${remainingActions !== 1 ? "s" : ""} left before needing an upgrade.`,
      };
      finalBlocks = [
        ...blocks,
        {
          type: "limit_warning",
          title: "",
          content: (warnText as any)[uiLang] || (warnText as any).en,
          is_limit_warning: true,
          will_hit_limit: creditCheck.remaining <= 2,
        },
      ];
    }

    // ── Fire-and-forget: extract memorable facts from this exchange ──────────
    // Non-blocking — runs after response is sent, never delays the user
    (async () => {
      try {
        const assistantText = finalBlocks
          .filter((b: any) => !["limit_warning","meta_action","navigate","proactive"].includes(b.type))
          .map((b: any) => {
            const parts = [];
            if (b.title) parts.push(b.title);
            if (b.content) parts.push(b.content.slice(0, 300));
            if (b.items?.length) parts.push(b.items.slice(0, 3).join(" | "));
            return parts.join(": ");
          })
          .filter(Boolean)
          .join(" ")
          .slice(0, 800);
        if (assistantText && message && user_id) {
          try {
            await supabase.functions.invoke("extract-chat-memory", {
              body: {
                user_id,
                persona_id: persona_id || null,
                user_message: message.slice(0, 400),
                assistant_response: assistantText,
              },
            });
          } catch (_) { /* silent */ }
        }
      } catch (_) {
        /* silent — never break the main flow */
      }
    })().catch(() => {});

    _lap("response-ready");
    const usagePayload = {
      remaining_credits: creditCheck.remaining ?? 0,
      total_credits: creditCheck.total ?? 0,
      plan: planKey,
      is_trialing: isTrialing,
    };
    return new Response(JSON.stringify({
      blocks: finalBlocks,
      usage: usagePayload,
      _debug: {
        has_meta: !!liveMetaData && liveMetaData.length > 50,
        meta_len: liveMetaData?.length || 0,
        system_chars: systemBlocks.reduce((s, b) => s + (b.text?.length || 0), 0),
        elapsed_ms: Date.now() - _t0,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const elapsed = Date.now() - _t0;
    const errMsg = String(e) || "internal_error";
    console.error(`[ai-chat] FATAL: ${errMsg} (elapsed: ${elapsed}ms)`);
    // Return 200 with structured error block
    const userFriendly =
      errMsg.includes("Anthropic 4") || errMsg.includes("Anthropic 5")
        ? "Erro temporário na IA. Tente novamente."
        : errMsg.includes("timeout") || elapsed > 25000
          ? "A resposta demorou demais. Tente novamente com uma pergunta mais curta."
          : "Algo deu errado. Tente novamente.";
    return new Response(JSON.stringify({
      blocks: [{ type: "warning", title: "Erro", content: userFriendly }],
      error: errMsg.slice(0, 200),
      _debug: { elapsed_ms: elapsed },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// redeploy v21.0 — 20260415

// force-sync 2026-03-24T23:23:48Z
// force-redeploy 2026-03-27T14:52:19Z

// force-redeploy 2026-04-08T04:00:00Z — direct persona_id query + connections fix v9
