/**
 * Deterministic structural-signal detection for landing pages.
 *
 * Pure functions — no I/O, no env, fully testable. Used by the chat function
 * to give the AI structural facts about a landing page (pixel? conversion
 * event? primary CTA?) without depending on the LLM to "see" them.
 */

// Social / platform domains we never treat as landing pages
export const NON_LP_HOSTS = new Set([
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "instagram.com", "www.instagram.com",
  "twitter.com", "x.com", "www.x.com",
  "youtube.com", "www.youtube.com", "youtu.be",
  "tiktok.com", "www.tiktok.com",
  "linkedin.com", "www.linkedin.com",
  "whatsapp.com", "wa.me", "api.whatsapp.com",
  "t.me", "telegram.me",
  "google.com", "www.google.com",
  "github.com", "www.github.com",
  "docs.google.com", "drive.google.com",
  "adbrief.pro", "www.adbrief.pro",
]);

// ── SSRF guard ─────────────────────────────────────────────────────────────
// Reject URLs that would let the edge function hit internal/private infra.
// Main vectors we block:
//   • 127.0.0.0/8 loopback
//   • 10/8, 172.16/12, 192.168/16 private nets
//   • 169.254.0.0/16 link-local (AWS/GCP metadata lives at 169.254.169.254)
//   • 0.0.0.0, multicast, broadcast, CGNAT
//   • IPv6 loopback (::1), link-local (fe80::/10), unique local (fc00::/7)
//   • "localhost", *.local, *.internal, *.localhost, *.lan
//
// We only guard against explicit-IP entry + obvious hostnames. Full DNS
// rebinding defense would need a resolve-check at fetch time; out of scope
// for this guard (Supabase edge fn infra already drops most outbound private
// traffic, this is belt-and-suspenders).
export const RESERVED_HOSTS = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
  "ip6-allnodes",
  "ip6-allrouters",
]);

export function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if ([a, b, parseInt(m[3], 10), parseInt(m[4], 10)].some((n) => n < 0 || n > 255)) return true;
  if (a === 0) return true;                                   // 0.0.0.0/8
  if (a === 10) return true;                                   // 10/8
  if (a === 127) return true;                                  // loopback
  if (a === 169 && b === 254) return true;                     // link-local (AWS/GCP metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;            // 172.16/12
  if (a === 192 && b === 168) return true;                     // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true;           // CGNAT 100.64/10
  if (a >= 224) return true;                                   // multicast + reserved + broadcast
  return false;
}

export function isPrivateIpv6(host: string): boolean {
  if (!host.includes(":")) return false;
  const h = host.toLowerCase();
  if (h === "::1" || h === "::" || h === "0:0:0:0:0:0:0:1" || h === "0:0:0:0:0:0:0:0") return true;
  if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;               // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;              // fc00::/7 unique local
  // IPv4-mapped (`::ffff:…`) and IPv4-compatible (`::0.0.0.0`, deprecated)
  // addresses let an attacker tunnel an IPv4 target through an IPv6 literal.
  // Block all of them — legitimate LPs never use these notations.
  if (h.startsWith("::ffff:")) return true;
  if (h.startsWith("::") && /^::\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export function isReservedHost(host: string): boolean {
  // WHATWG URL parsers return IPv6 hosts wrapped in brackets (`[::1]`).
  // Strip them before the literal / range checks run.
  const h = host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (RESERVED_HOSTS.has(h)) return true;
  if (
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".localhost") ||
    h.endsWith(".lan") ||
    h.endsWith(".home.arpa") ||
    h.endsWith(".intranet")
  ) return true;
  if (isPrivateIpv4(h)) return true;
  if (isPrivateIpv6(h)) return true;
  return false;
}

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (NON_LP_HOSTS.has(host)) return null;
    // SSRF: block internal/private/reserved hosts before anything else touches them.
    if (isReservedHost(host)) return null;
    const stripParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
                          "fbclid", "gclid", "ttclid", "mc_cid", "mc_eid", "_ga", "_gac", "ref", "referrer"];
    stripParams.forEach((p) => u.searchParams.delete(p));
    u.hash = "";
    const keys = [...u.searchParams.keys()].sort();
    const params = new URLSearchParams();
    for (const k of keys) params.append(k, u.searchParams.get(k) ?? "");
    u.search = params.toString() ? `?${params.toString()}` : "";
    u.hostname = host;
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    // Block URLs that embed basic-auth credentials — they're often used to
    // smuggle attacker hostnames past visual inspection (http://trusted@evil.com/…).
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function extractLandingUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /\bhttps?:\/\/[^\s<>()"']{4,}/gi;
  const out = new Set<string>();
  const matches = text.match(urlRegex) || [];
  for (const m of matches) {
    const cleaned = m.replace(/[.,;:!?)]+$/, "");
    const norm = normalizeUrl(cleaned);
    if (norm) out.add(norm);
    if (out.size >= 2) break;
  }
  return [...out];
}

export function stripHtmlToText(html: string): { title: string; text: string } {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const titleMatch = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  h = h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  const text = h.replace(/\s+/g, " ").trim();
  return { title, text };
}

/**
 * Pattern set for Meta Pixel detection. Run as a disjunction — any match → true.
 *
 * Each pattern is documented with what variant it catches. Any pixel install
 * that doesn't trip at least one of these is either truly broken or doing
 * something exotic enough that it deserves a manual eyeball anyway.
 */
const PIXEL_PATTERNS: RegExp[] = [
  /fbq\s*\(\s*['"]init['"]/i,                          // fbq('init', ID) — most common
  /connect\.facebook\.net\/[^\/'"]+\/fbevents\.js/i,   // <script src=...fbevents.js>
  /\b_fbq\b/,                                          // _fbq global init pattern
  /facebook\.com\/tr\?id=\d+/i,                        // <noscript><img src="…fb tracking pixel"/>
  /<!--\s*Meta\s+Pixel\s+Code\s*-->/i,                 // standard "<!-- Meta Pixel Code -->" wrapper
  /facebook\s+pixel/i,                                 // text mention (lowest signal — last)
];

const CONV_EVENT_PATTERNS: RegExp[] = [
  /fbq\s*\(\s*['"]track['"]\s*,\s*['"](Purchase|Lead|CompleteRegistration|AddToCart|InitiateCheckout|Subscribe|StartTrial|Contact|SubmitApplication|Schedule|ViewContent|Search)['"]/i,
];

/** Where the inspected text came from. Affects how we interpret a NEGATIVE result. */
export type DetectionSource = "raw_html" | "extracted_text";

export interface StructuralSignals {
  hasFbPixel: boolean;
  hasConvEvent: boolean;
  primaryCta: string | null;
  /** Whether the input was raw HTML (script tags intact) or text extracted by
   *  a reader pipeline (Jina, stripHtmlToText) that drops <script>/<style>. */
  detectionSource: DetectionSource;
  /** "high" when the source can answer the question reliably; "low" when a
   *  negative result might just mean "we couldn't see the right tag". Logic:
   *    - Positive detection on either source → "high" (we found it for real)
   *    - Negative detection on raw_html that's NOT a SPA shell → "high"
   *    - Negative detection on raw_html that IS a SPA shell  → "low"
   *      (scripts were "seen" but most code lives in JS bundles the regex
   *      never inspected — claiming absence is a hallucination)
   *    - Negative detection on extracted_text → "low" (scripts were stripped)
   *  This lets the LLM downgrade phrasing from "no pixel detected" to
   *  "couldn't verify" when the source can't actually see scripts. */
  pixelConfidence: "high" | "low";
  conversionConfidence: "high" | "low";
  /** Whether the inspected page is a Single-Page App shell (React, Vue,
   *  Svelte, Next, Nuxt, etc.). These shells render almost everything from
   *  bundled JS — the raw HTML is just a mount-point div + module script.
   *  Pattern-matching for fbq('track', 'Lead') in such a shell will ALWAYS
   *  miss the call, even when it actually fires from the bundle. The LLM
   *  should never assert absence of conversion events on an SPA from the
   *  raw HTML alone. */
  isSpaShell: boolean;
}

/**
 * Heuristic SPA-shell detection. We accept a few false positives (rare
 * static pages that happen to use `<div id="root">`) in exchange for
 * eliminating the false-negative class where the AI confidently claims
 * "fbq('track', 'Lead') is missing" on a real React app where the call
 * lives in the bundled chunk. The signals are:
 *   • Mount-point div with a known SPA root id (root, app, __next, __nuxt, svelte).
 *   • Module-style script tag (Vite/ESM bundlers always emit this).
 *   • Sub-2KB visible body text after stripping (real content lives in JS).
 * Any TWO of the three trip the flag — keeps it robust to template variation.
 */
export function isSpaShell(html: string): boolean {
  if (!html) return false;
  const hasRootMount =
    /<div\s+id=["'](root|app|__next|__nuxt|svelte|app-root|q-app|main-app)["']/i.test(html);
  const hasModuleScript = /<script\s+type=["']module["']/i.test(html);
  const visibleText = stripHtmlToText(html).text;
  const tinyVisibleBody = visibleText.length < 2000;

  let signals = 0;
  if (hasRootMount) signals++;
  if (hasModuleScript) signals++;
  if (tinyVisibleBody) signals++;
  return signals >= 2;
}

export function detectStructuralSignals(
  content: string,
  source: DetectionSource = "extracted_text",
): StructuralSignals {
  const hasFbPixel = PIXEL_PATTERNS.some((p) => p.test(content));
  const hasConvEvent = CONV_EVENT_PATTERNS.some((p) => p.test(content));

  // SPA detection only meaningful when we actually have HTML to inspect.
  // For Jina-extracted text the source is already script-stripped — we don't
  // run isSpaShell there because the input doesn't have the structural tags
  // we're looking for. The downstream confidence rule for extracted_text
  // already handles that case (always "low" on negatives).
  const spa = source === "raw_html" ? isSpaShell(content) : false;

  // Pixel confidence: hasFbPixel positive → high. Negative on raw_html → high
  // EXCEPT when the page is an SPA shell, because the pixel init IS usually
  // inline in the index.html for SPAs (so a negative there really means
  // missing), but to be safe we keep it at high for SPAs too — the meta-
  // pixel snippet is a static <script> in <head>, exactly where regex sees it.
  const pixelConfidence: "high" | "low" =
    hasFbPixel || source === "raw_html" ? "high" : "low";

  // Conversion confidence: positive → high. Negative on raw_html → high ONLY
  // if NOT an SPA. SPA shells render fbq('track', ...) calls from the bundle,
  // not the HTML — claiming absence is a hallucination. This is the bug that
  // was telling AdBrief.pro users "your Lead event is missing" while the call
  // was actually firing in production from the bundled JS.
  const conversionConfidence: "high" | "low" =
    hasConvEvent
      ? "high"
      : source === "raw_html" && !spa
        ? "high"
        : "low";

  // Exclude `<` `>` so we don't capture trailing markup like `</button>` when
  // running CTA detection on raw HTML.
  const ctaMatch = content.match(
    /\b(Comprar|Comprar agora|Assinar|Começar|Começar agora|Cadastre-se|Cadastrar|Inscrever-se|Quero|Quero agora|Baixar|Baixe|Download|Sign up|Buy now|Get started|Start free|Start now|Subscribe|Join|Agendar|Falar com|WhatsApp)\b[^.\n<>]{0,40}/i,
  );
  const primaryCta = ctaMatch ? ctaMatch[0].slice(0, 60).trim() : null;
  return {
    hasFbPixel,
    hasConvEvent,
    primaryCta,
    detectionSource: source,
    pixelConfidence,
    conversionConfidence,
    isSpaShell: spa,
  };
}
