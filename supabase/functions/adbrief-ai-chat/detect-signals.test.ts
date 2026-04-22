/**
 * Deterministic structural-signal test suite for adbrief-ai-chat.
 *
 * Feeds known landing-page HTML samples and verifies that pixel / conversion
 * event / CTA detection produce the correct structural signals.
 *
 * Run: deno test supabase/functions/adbrief-ai-chat/detect-signals.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectStructuralSignals,
  extractLandingUrls,
  normalizeUrl,
  stripHtmlToText,
} from "./detect-signals.ts";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const HTML_FULL_STACK = `
<!doctype html><html><head>
<title>Compre o Curso X — Resultados em 30 dias</title>
<script>
!function(f,b,e,v,n,t,s){...}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1234567890');
fbq('track', 'PageView');
</script>
</head><body>
<h1>Curso X</h1>
<p>O método que mudou tudo.</p>
<button>Comprar agora por R$497</button>
<script>
document.querySelector('button').addEventListener('click',()=>{
  fbq('track','Purchase',{value:497,currency:'BRL'});
});
</script>
</body></html>`;

const HTML_PIXEL_NO_CONVERSION = `
<!doctype html><html><head>
<title>Landing sem evento</title>
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script>fbq('init','999');fbq('track','PageView');</script>
</head><body>
<h1>Saiba mais</h1>
<a href="/contato">Falar com consultor</a>
</body></html>`;

const HTML_NO_PIXEL = `
<!doctype html><html><head>
<title>Página simples</title>
</head><body>
<h1>Bem-vindo</h1>
<p>Conteúdo institucional sem rastreamento.</p>
<a href="/sobre">Sobre nós</a>
</body></html>`;

const HTML_CONVERSION_LEAD_EN = `
<!doctype html><html><head>
<title>Get the Free Guide</title>
<script src="https://connect.facebook.net/en_US/fbevents.js"></script>
<script>fbq('init','42');fbq('track','PageView');</script>
</head><body>
<form id="lead">
  <input type="email" name="email" />
  <button type="submit">Sign up</button>
</form>
<script>
document.getElementById('lead').addEventListener('submit',()=>{
  fbq("track","Lead");
});
</script>
</body></html>`;

const HTML_INITIATE_CHECKOUT = `
<html><head><title>Checkout</title>
<script>fbq('init','7');fbq("track","InitiateCheckout",{value:99});</script>
</head><body><button>Buy now</button></body></html>`;

const HTML_FAKE_TRACK_NOT_CONVERSION = `
<html><head><title>Tracks PageView only</title>
<script>fbq('init','9');fbq('track','PageView');fbq('track','ViewContent');</script>
</head><body><h1>Hello</h1><a>Read more</a></body></html>`;

// ─── Pixel + conversion detection ───────────────────────────────────────────

Deno.test("detects pixel + Purchase conversion + Portuguese CTA", () => {
  const s = detectStructuralSignals(HTML_FULL_STACK);
  assertEquals(s.hasFbPixel, true);
  assertEquals(s.hasConvEvent, true);
  assertEquals(s.primaryCta, "Comprar agora por R$497");
});

Deno.test("detects pixel but NO conversion event when only PageView fires", () => {
  const s = detectStructuralSignals(HTML_PIXEL_NO_CONVERSION);
  assertEquals(s.hasFbPixel, true);
  assertEquals(s.hasConvEvent, false);
  assertEquals(s.primaryCta, "Falar com consultor");
});

Deno.test("returns all-false when no pixel and no CTA keywords present", () => {
  const s = detectStructuralSignals(HTML_NO_PIXEL);
  assertEquals(s.hasFbPixel, false);
  assertEquals(s.hasConvEvent, false);
  assertEquals(s.primaryCta, null);
});

Deno.test("detects Lead conversion event + English CTA 'Sign up'", () => {
  const s = detectStructuralSignals(HTML_CONVERSION_LEAD_EN);
  assertEquals(s.hasFbPixel, true);
  assertEquals(s.hasConvEvent, true);
  assertEquals(s.primaryCta, "Sign up");
});

Deno.test("detects InitiateCheckout as conversion event", () => {
  const s = detectStructuralSignals(HTML_INITIATE_CHECKOUT);
  assertEquals(s.hasFbPixel, true);
  assertEquals(s.hasConvEvent, true);
  assertEquals(s.primaryCta, "Buy now");
});

Deno.test("does NOT count PageView/ViewContent as conversion event", () => {
  const s = detectStructuralSignals(HTML_FAKE_TRACK_NOT_CONVERSION);
  assertEquals(s.hasFbPixel, true);
  assertEquals(s.hasConvEvent, false);
});

Deno.test("recognizes pixel via _fbp cookie reference even without fbq()", () => {
  const html = `<html><body><script>const x = document.cookie.match(/_fbp=([^;]+)/);</script></body></html>`;
  const s = detectStructuralSignals(html);
  assertEquals(s.hasFbPixel, true);
});

Deno.test("recognizes pixel via 'facebook pixel' textual mention", () => {
  const html = `<p>This site uses the Facebook Pixel for analytics.</p>`;
  const s = detectStructuralSignals(html);
  assertEquals(s.hasFbPixel, true);
});

// ─── CTA edge cases ─────────────────────────────────────────────────────────

Deno.test("CTA 'WhatsApp' is recognized", () => {
  const s = detectStructuralSignals(`<a>Falar via WhatsApp agora</a>`);
  assertEquals(s.primaryCta, "WhatsApp agora");
});

Deno.test("CTA detection picks the FIRST action verb in document order", () => {
  const html = `<button>Cadastre-se grátis</button> ... later ... <a>Comprar agora</a>`;
  const s = detectStructuralSignals(html);
  assertEquals(s.primaryCta?.startsWith("Cadastre-se"), true);
});

Deno.test("CTA truncates to 60 chars max", () => {
  const longTail = "x".repeat(200);
  const s = detectStructuralSignals(`<button>Comprar ${longTail}</button>`);
  assertEquals((s.primaryCta?.length ?? 0) <= 60, true);
});

// ─── HTML stripping ─────────────────────────────────────────────────────────

Deno.test("stripHtmlToText extracts title and removes script/style", () => {
  const html = `<html><head><title>Hello</title><style>body{}</style></head><body><script>alert(1)</script><h1>Hi</h1></body></html>`;
  const { title, text } = stripHtmlToText(html);
  assertEquals(title, "Hello");
  assertEquals(text.includes("alert"), false);
  assertEquals(text.includes("Hi"), true);
});

Deno.test("stripHtmlToText decodes basic HTML entities", () => {
  const { text } = stripHtmlToText(`<p>Tom&nbsp;&amp;&nbsp;Jerry</p>`);
  assertEquals(text, "Tom & Jerry");
});

// ─── URL extraction & normalization ─────────────────────────────────────────

Deno.test("extractLandingUrls picks https URLs and skips social hosts", () => {
  const msg = `Olha minha LP: https://meusite.com/oferta?utm_source=ig and my IG https://instagram.com/foo`;
  const urls = extractLandingUrls(msg);
  assertEquals(urls.length, 1);
  assertEquals(urls[0], "https://meusite.com/oferta");
});

Deno.test("extractLandingUrls caps at 2 candidate URLs", () => {
  const msg = `https://a.com https://b.com https://c.com https://d.com`;
  const urls = extractLandingUrls(msg);
  assertEquals(urls.length, 2);
});

Deno.test("normalizeUrl strips utm/fbclid params and trailing slash", () => {
  const out = normalizeUrl("https://Site.com/Path/?utm_source=fb&fbclid=abc&id=42");
  assertEquals(out, "https://site.com/Path?id=42");
});

Deno.test("normalizeUrl rejects non-http schemes and social hosts", () => {
  assertEquals(normalizeUrl("javascript:alert(1)"), null);
  assertEquals(normalizeUrl("https://www.facebook.com/page"), null);
  assertEquals(normalizeUrl("https://wa.me/123"), null);
  assertEquals(normalizeUrl("not a url"), null);
});

// ─── SSRF — private/reserved hosts must be refused ─────────────────────────

Deno.test("SSRF: blocks AWS/GCP metadata IP (169.254.169.254)", () => {
  assertEquals(normalizeUrl("http://169.254.169.254/latest/meta-data/"), null);
  assertEquals(normalizeUrl("https://169.254.169.254/computeMetadata/v1/"), null);
});

Deno.test("SSRF: blocks loopback IPv4 addresses (127/8)", () => {
  assertEquals(normalizeUrl("http://127.0.0.1/admin"), null);
  assertEquals(normalizeUrl("http://127.1.2.3/"), null);
});

Deno.test("SSRF: blocks RFC1918 private nets (10/8, 172.16/12, 192.168/16)", () => {
  assertEquals(normalizeUrl("http://10.0.0.1/"), null);
  assertEquals(normalizeUrl("http://10.255.255.255/"), null);
  assertEquals(normalizeUrl("http://172.16.0.1/"), null);
  assertEquals(normalizeUrl("http://172.31.255.255/"), null);
  assertEquals(normalizeUrl("http://192.168.1.1/"), null);
});

Deno.test("SSRF: allows public-range 172 addresses (outside 172.16/12)", () => {
  // 172.32+ is public; make sure we don't over-block the 172/8 range.
  const out = normalizeUrl("https://172.217.0.1/");
  assertEquals(out !== null, true);
});

Deno.test("SSRF: blocks 0.0.0.0, CGNAT (100.64/10), multicast (224+)", () => {
  assertEquals(normalizeUrl("http://0.0.0.0/"), null);
  assertEquals(normalizeUrl("http://100.64.0.1/"), null);
  assertEquals(normalizeUrl("http://224.0.0.1/"), null);
  assertEquals(normalizeUrl("http://255.255.255.255/"), null);
});

Deno.test("SSRF: blocks IPv6 loopback + link-local + unique-local", () => {
  assertEquals(normalizeUrl("http://[::1]/admin"), null);
  assertEquals(normalizeUrl("http://[fe80::1234]/"), null);
  assertEquals(normalizeUrl("http://[fc00::1]/"), null);
  assertEquals(normalizeUrl("http://[::ffff:127.0.0.1]/"), null);
});

Deno.test("SSRF: blocks 'localhost' and internal TLDs", () => {
  assertEquals(normalizeUrl("http://localhost/"), null);
  assertEquals(normalizeUrl("http://localhost:8888/admin"), null);
  assertEquals(normalizeUrl("http://foo.local/"), null);
  assertEquals(normalizeUrl("http://intranet.internal/"), null);
  assertEquals(normalizeUrl("http://server.lan/"), null);
  assertEquals(normalizeUrl("http://router.home.arpa/"), null);
});

Deno.test("SSRF: blocks URLs with embedded basic-auth credentials", () => {
  // Attackers use `http://trusted@evil.com/` to make malicious URLs look safe.
  assertEquals(normalizeUrl("http://user@example.com/"), null);
  assertEquals(normalizeUrl("http://user:pass@example.com/"), null);
});

Deno.test("SSRF: extractLandingUrls drops SSRF attempts from message", () => {
  const msg = `Minha LP é https://meusite.com/oferta mas testa tambem http://169.254.169.254/ e http://localhost:3000/`;
  const urls = extractLandingUrls(msg);
  assertEquals(urls.length, 1);
  assertEquals(urls[0], "https://meusite.com/oferta");
});

Deno.test("normalizeUrl produces stable hash-friendly param order", () => {
  const a = normalizeUrl("https://x.com/?b=2&a=1");
  const b = normalizeUrl("https://x.com/?a=1&b=2");
  assertEquals(a, b);
});

// ─── Integration: HTML → strip → detect ─────────────────────────────────────

Deno.test("integration: stripping then detecting still finds CTA but loses inline pixel scripts", () => {
  // Pixel detection MUST run on raw HTML (which is what the function does).
  // After stripping, the script tags are gone — this test documents that
  // contract so future refactors don't accidentally swap the order.
  const stripped = stripHtmlToText(HTML_FULL_STACK).text;
  const s = detectStructuralSignals(stripped);
  assertEquals(s.hasFbPixel, false, "pixel must be detected on raw HTML, not stripped text");
  assertEquals(s.hasConvEvent, false);
  assertEquals(s.primaryCta, "Comprar agora por R$497");
});
