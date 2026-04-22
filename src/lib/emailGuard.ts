// emailGuard — first-line filter for signup endpoints.
// Blocks disposable email domains (catch-all inboxes used by bots and probes)
// and obvious probe/scanner patterns in the local-part.
//
// Keep this list in sync with `supabase/functions/_shared/emailGuard.ts`.
// Client-side enforcement is a UX courtesy — the edge function is the real gate.

// ── Disposable domain blocklist ──
// Curated from observed signups + the top-used domains from
// https://github.com/disposable-email-domains/disposable-email-domains.
// Full list is ~3k entries; we ship the ~100 highest-volume here and can
// expand to a JSON blob served from Storage if needed later.
export const DISPOSABLE_DOMAINS = new Set<string>([
  // Observed in our own auth.users (confirmed as bot signups)
  "resend.app",
  "resend.dev",
  "mailinator.com",
  // Mailinator aliases
  "mailinator.net",
  "mailinator.org",
  "mailinater.com",
  "notmailinator.com",
  "reallymymail.com",
  "sogetthis.com",
  "spamherelots.com",
  "spamhereplease.com",
  "streetwisemail.com",
  "thisisnotmyrealemail.com",
  "tradermail.info",
  "veryrealemail.com",
  // Top disposable / temp-mail services
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minutemail.co.uk",
  "tempmail.com",
  "temp-mail.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempmail.net",
  "tempmail.plus",
  "tempmailo.com",
  "tempmailer.com",
  "tempmail.ninja",
  "throwawaymail.com",
  "throwaway.email",
  "throwam.com",
  "trashmail.com",
  "trashmail.net",
  "trashmail.io",
  "trashmail.de",
  "mytrashmail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.org",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "dispostable.com",
  "getairmail.com",
  "maildrop.cc",
  "mohmal.com",
  "fakeinbox.com",
  "mintemail.com",
  "tempr.email",
  "discard.email",
  "emailondeck.com",
  "moakt.com",
  "mailcatch.com",
  "mailnesia.com",
  "spambox.us",
  "spam.la",
  "spam4.me",
  "spamex.com",
  "mailnull.com",
  "linshiyouxiang.net",
  "burnermail.io",
  "getnada.com",
  "nada.email",
  "email-fake.com",
  "fakemail.net",
  "fakemailgenerator.com",
  "mailsac.com",
  "dropmail.me",
  "anonbox.net",
  "spamgourmet.com",
  "dodgit.com",
  "inboxbear.com",
  "duckmail.pro",
  "tmail.io",
  "anonaddy.me",
  "minutebox.com",
  "mail-temp.com",
  "inboxkitten.com",
  "mailpoof.com",
  "tempinbox.com",
  "tempemail.net",
  "tempemail.co",
  "tempail.com",
  "disposableemailaddresses.com",
  "getonemail.com",
  "dropjar.com",
  "boun.cr",
  "emlpro.com",
  "emlhub.com",
  "harakirimail.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
]);

// ── Probe/scanner patterns in the local-part ──
// Matches machine-generated bot emails like `probe-1776818934600@...`
// regardless of domain.
export const PROBE_PATTERNS: RegExp[] = [
  /^probe[-_]?\d{3,}@/i,
  /^test[-_]?\d{3,}@/i,
  /^user[-_]?\d{3,}@/i,
  /^bot[-_]?\d{3,}@/i,
  /^check[-_]?\d{3,}@/i,
  /^scan[-_]?\d{3,}@/i,
  /^crawl[-_]?\d{3,}@/i,
  /^spider[-_]?\d{3,}@/i,
  /^monitor[-_]?\d{3,}@/i,
  /^health[-_]?\d{3,}@/i,
  // very long numeric local-parts (8+ digits) — timestamp-like bot signatures
  /^[a-z]{0,8}\d{10,}@/i,
];

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: "invalid_format" | "disposable_domain" | "probe_pattern"; domain?: string };

// ── Main guard ──
export function validateEmailForSignup(raw: string): GuardResult {
  const email = (raw || "").trim().toLowerCase();

  // Basic shape: local@domain.tld
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "invalid_format" };
  }

  // Probe / scanner patterns — check before domain split so `probe-123@gmail.com` still fails.
  for (const re of PROBE_PATTERNS) {
    if (re.test(email)) {
      return { ok: false, reason: "probe_pattern" };
    }
  }

  // Disposable domain blocklist — match exact domain or any subdomain of it.
  const domain = email.slice(email.indexOf("@") + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "disposable_domain", domain };
  }
  // Subdomain check — e.g. `joriekol.resend.app` matches `resend.app`.
  for (const d of DISPOSABLE_DOMAINS) {
    if (domain.endsWith("." + d)) {
      return { ok: false, reason: "disposable_domain", domain };
    }
  }

  return { ok: true };
}

// Human-readable toast message per reason, per language.
export function guardMessage(
  reason: Exclude<GuardResult, { ok: true }>["reason"],
  lang: "pt" | "en" | "es",
): string {
  const M = {
    pt: {
      invalid_format: "Email inválido. Confere se digitou certo.",
      disposable_domain: "Esse domínio de email descartável não é aceito. Usa um email pessoal ou corporativo.",
      probe_pattern: "Esse email parece gerado automaticamente. Usa um email real pra criar sua conta.",
    },
    en: {
      invalid_format: "Invalid email address. Please double-check it.",
      disposable_domain: "Disposable email domains aren't accepted. Please use a personal or work email.",
      probe_pattern: "This email looks auto-generated. Please use a real email to sign up.",
    },
    es: {
      invalid_format: "Email inválido. Verifica que esté bien escrito.",
      disposable_domain: "No aceptamos dominios de email descartables. Usa un email personal o corporativo.",
      probe_pattern: "Este email parece generado automáticamente. Usa un email real para crear tu cuenta.",
    },
  } as const;
  return M[lang][reason];
}
