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

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (NON_LP_HOSTS.has(u.hostname.toLowerCase())) return null;
    const stripParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
                          "fbclid", "gclid", "ttclid", "mc_cid", "mc_eid", "_ga", "_gac", "ref", "referrer"];
    stripParams.forEach((p) => u.searchParams.delete(p));
    u.hash = "";
    const keys = [...u.searchParams.keys()].sort();
    const params = new URLSearchParams();
    for (const k of keys) params.append(k, u.searchParams.get(k) ?? "");
    u.search = params.toString() ? `?${params.toString()}` : "";
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
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
  const ctaMatch = content.match(/\b(Comprar|Comprar agora|Assinar|Começar|Começar agora|Cadastre-se|Cadastrar|Inscrever-se|Quero|Quero agora|Baixar|Baixe|Download|Sign up|Buy now|Get started|Start free|Start now|Subscribe|Join|Agendar|Falar com|WhatsApp)\b[^.\n]{0,40}/i);
  const primaryCta = ctaMatch ? ctaMatch[0].slice(0, 60).trim() : null;
  return { hasFbPixel, hasConvEvent, primaryCta };
}
