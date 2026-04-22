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

export interface StructuralSignals {
  hasFbPixel: boolean;
  hasConvEvent: boolean;
  primaryCta: string | null;
}

export function detectStructuralSignals(content: string): StructuralSignals {
  const hasFbPixel = /fbq\(\s*['"]init['"]|connect\.facebook\.net\/.*\/fbevents\.js|_fbp\b|facebook\s+pixel/i.test(content);
  const hasConvEvent = /fbq\(\s*['"]track['"]\s*,\s*['"](Purchase|Lead|CompleteRegistration|AddToCart|InitiateCheckout|Subscribe|StartTrial)['"]/i.test(content);
  // Exclude `<` `>` so we don't capture trailing markup like `</button>` when
  // running CTA detection on raw HTML.
  const ctaMatch = content.match(/\b(Comprar|Comprar agora|Assinar|Começar|Começar agora|Cadastre-se|Cadastrar|Inscrever-se|Quero|Quero agora|Baixar|Baixe|Download|Sign up|Buy now|Get started|Start free|Start now|Subscribe|Join|Agendar|Falar com|WhatsApp)\b[^.\n<>]{0,40}/i);
  const primaryCta = ctaMatch ? ctaMatch[0].slice(0, 60).trim() : null;
  return { hasFbPixel, hasConvEvent, primaryCta };
}
