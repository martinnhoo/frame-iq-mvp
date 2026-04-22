/**
 * Node-compatible smoke runner for detect-signals.ts.
 *
 * The canonical tests live in detect-signals.test.ts and run under `deno test`
 * in CI. This file mirrors the same assertions using Node's assert module so
 * we can verify changes without a Deno runtime. It imports ONLY pure helpers
 * from detect-signals.ts (which have no Deno-specific dependencies).
 *
 * Run: npx tsx supabase/functions/adbrief-ai-chat/detect-signals.node-smoke.ts
 */
import assert from "node:assert/strict";
import {
  detectStructuralSignals,
  extractLandingUrls,
  isPrivateIpv4,
  isPrivateIpv6,
  isReservedHost,
  normalizeUrl,
  stripHtmlToText,
} from "./detect-signals.ts";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    const err = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n      ${err}`);
  }
}

// ─── Pre-existing tests (mirror of detect-signals.test.ts) ─────────────────

const HTML_FULL_STACK = `
<!doctype html><html><head>
<title>Compre o Curso X</title>
<script>
!function(f,b,e,v,n,t,s){...}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1234567890');
fbq('track', 'PageView');
</script>
</head><body>
<h1>Curso X</h1>
<button>Comprar agora por R$497</button>
<script>fbq('track','Purchase',{value:497,currency:'BRL'});</script>
</body></html>`;

test("detects pixel + Purchase conversion + Portuguese CTA", () => {
  const s = detectStructuralSignals(HTML_FULL_STACK);
  assert.equal(s.hasFbPixel, true);
  assert.equal(s.hasConvEvent, true);
  assert.equal(s.primaryCta, "Comprar agora por R$497");
});

test("pixel but NO conversion when only PageView", () => {
  const html = `<script>fbq('init','9');fbq('track','PageView');fbq('track','ViewContent');</script>`;
  const s = detectStructuralSignals(html);
  assert.equal(s.hasFbPixel, true);
  assert.equal(s.hasConvEvent, false);
});

test("no pixel, no CTA", () => {
  const s = detectStructuralSignals(`<h1>Hello</h1>`);
  assert.equal(s.hasFbPixel, false);
  assert.equal(s.hasConvEvent, false);
  assert.equal(s.primaryCta, null);
});

test("stripHtmlToText extracts title and removes script/style", () => {
  const html = `<html><head><title>Hello</title><style>body{}</style></head><body><script>alert(1)</script><h1>Hi</h1></body></html>`;
  const { title, text } = stripHtmlToText(html);
  assert.equal(title, "Hello");
  assert.equal(text.includes("alert"), false);
  assert.equal(text.includes("Hi"), true);
});

test("extractLandingUrls picks https + skips social", () => {
  const urls = extractLandingUrls(`LP: https://meusite.com/oferta?utm_source=ig IG: https://instagram.com/foo`);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], "https://meusite.com/oferta");
});

test("normalizeUrl strips utm/fbclid + trailing slash", () => {
  assert.equal(
    normalizeUrl("https://Site.com/Path/?utm_source=fb&fbclid=abc&id=42"),
    "https://site.com/Path?id=42",
  );
});

test("normalizeUrl rejects non-http, social, and garbage", () => {
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("https://www.facebook.com/page"), null);
  assert.equal(normalizeUrl("https://wa.me/123"), null);
  assert.equal(normalizeUrl("not a url"), null);
});

// ─── SSRF — private/reserved hosts must be refused ─────────────────────────

test("SSRF: blocks AWS/GCP metadata IP (169.254.169.254)", () => {
  assert.equal(normalizeUrl("http://169.254.169.254/latest/meta-data/"), null);
  assert.equal(normalizeUrl("https://169.254.169.254/computeMetadata/v1/"), null);
});

test("SSRF: blocks loopback IPv4 (127/8)", () => {
  assert.equal(normalizeUrl("http://127.0.0.1/admin"), null);
  assert.equal(normalizeUrl("http://127.1.2.3/"), null);
});

test("SSRF: blocks RFC1918 private nets", () => {
  assert.equal(normalizeUrl("http://10.0.0.1/"), null);
  assert.equal(normalizeUrl("http://10.255.255.255/"), null);
  assert.equal(normalizeUrl("http://172.16.0.1/"), null);
  assert.equal(normalizeUrl("http://172.31.255.255/"), null);
  assert.equal(normalizeUrl("http://192.168.1.1/"), null);
});

test("SSRF: allows public 172 (outside 172.16/12)", () => {
  const out = normalizeUrl("https://172.217.0.1/");
  assert.notEqual(out, null);
});

test("SSRF: blocks 0.0.0.0, CGNAT 100.64/10, multicast 224+", () => {
  assert.equal(normalizeUrl("http://0.0.0.0/"), null);
  assert.equal(normalizeUrl("http://100.64.0.1/"), null);
  assert.equal(normalizeUrl("http://224.0.0.1/"), null);
  assert.equal(normalizeUrl("http://255.255.255.255/"), null);
});

test("SSRF: blocks IPv6 loopback, link-local, unique local, mapped", () => {
  assert.equal(normalizeUrl("http://[::1]/admin"), null);
  assert.equal(normalizeUrl("http://[fe80::1234]/"), null);
  assert.equal(normalizeUrl("http://[fc00::1]/"), null);
  assert.equal(normalizeUrl("http://[::ffff:127.0.0.1]/"), null);
});

test("SSRF: blocks 'localhost' and internal TLDs", () => {
  assert.equal(normalizeUrl("http://localhost/"), null);
  assert.equal(normalizeUrl("http://localhost:8888/admin"), null);
  assert.equal(normalizeUrl("http://foo.local/"), null);
  assert.equal(normalizeUrl("http://intranet.internal/"), null);
  assert.equal(normalizeUrl("http://server.lan/"), null);
  assert.equal(normalizeUrl("http://router.home.arpa/"), null);
});

test("SSRF: blocks embedded basic-auth credentials", () => {
  assert.equal(normalizeUrl("http://user@example.com/"), null);
  assert.equal(normalizeUrl("http://user:pass@example.com/"), null);
});

test("SSRF: extractLandingUrls drops SSRF attempts", () => {
  const msg = `LP https://meusite.com/oferta tb http://169.254.169.254/ e http://localhost:3000/`;
  const urls = extractLandingUrls(msg);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], "https://meusite.com/oferta");
});

test("helper: isPrivateIpv4 positives", () => {
  assert.equal(isPrivateIpv4("10.0.0.1"), true);
  assert.equal(isPrivateIpv4("169.254.169.254"), true);
  assert.equal(isPrivateIpv4("127.0.0.1"), true);
  assert.equal(isPrivateIpv4("172.16.0.1"), true);
  assert.equal(isPrivateIpv4("192.168.1.1"), true);
});

test("helper: isPrivateIpv4 negatives (public IPs)", () => {
  assert.equal(isPrivateIpv4("8.8.8.8"), false);
  assert.equal(isPrivateIpv4("1.1.1.1"), false);
  assert.equal(isPrivateIpv4("172.217.0.1"), false);
  assert.equal(isPrivateIpv4("not-an-ip"), false);
});

test("helper: isPrivateIpv6 positives", () => {
  assert.equal(isPrivateIpv6("::1"), true);
  assert.equal(isPrivateIpv6("fe80::1"), true);
  assert.equal(isPrivateIpv6("fc00::1"), true);
  assert.equal(isPrivateIpv6("::ffff:127.0.0.1"), true);
});

test("helper: isReservedHost", () => {
  assert.equal(isReservedHost("localhost"), true);
  assert.equal(isReservedHost("foo.local"), true);
  assert.equal(isReservedHost("bar.internal"), true);
  assert.equal(isReservedHost("adbrief.pro"), false);
  assert.equal(isReservedHost("www.google.com"), false);
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
