// send-confirmation-email v1 — branded email confirmation with magic link
// Called after signup to send a professional verification email
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Email guard (authoritative server-side copy) ───────────────────────────────
// Keep in sync with src/lib/emailGuard.ts. Client-side check is UX courtesy;
// this is the real gate — a blocked signup here means no confirmation email
// gets sent, and since we require email confirmation for non-Google signups,
// the user can never log in.
const DISPOSABLE_DOMAINS = new Set<string>([
  "resend.app",
  "resend.dev",
  "mailinator.com",
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

const PROBE_PATTERNS: RegExp[] = [
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
  /^[a-z]{0,8}\d{10,}@/i,
];

type GuardBlock = {
  ok: false;
  reason: "invalid_format" | "disposable_domain" | "probe_pattern";
  domain?: string;
};

function guardEmail(raw: string): { ok: true } | GuardBlock {
  const email = (raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "invalid_format" };
  }
  for (const re of PROBE_PATTERNS) {
    if (re.test(email)) return { ok: false, reason: "probe_pattern" };
  }
  const domain = email.slice(email.indexOf("@") + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "disposable_domain", domain };
  }
  for (const d of DISPOSABLE_DOMAINS) {
    if (domain.endsWith("." + d)) {
      return { ok: false, reason: "disposable_domain", domain };
    }
  }
  return { ok: true };
}

type Lang = "en" | "pt" | "es";

const T: Record<Lang, {
  subject: string; preheader: string; greeting: string;
  headline: string; body: string; cta: string;
  expire_note: string; footer: string; ignore: string;
}> = {
  pt: {
    subject: "Confirme seu email — AdBrief",
    preheader: "Um clique para ativar sua conta no AdBrief.",
    greeting: "Oi",
    headline: "Confirme seu email.",
    body: "Você criou uma conta no AdBrief. Clique no botão abaixo para verificar seu email e ativar sua conta.",
    cta: "Confirmar meu email →",
    expire_note: "Este link expira em 24 horas.",
    footer: "Você se cadastrou em adbrief.pro",
    ignore: "Se você não criou esta conta, ignore este email.",
  },
  en: {
    subject: "Confirm your email — AdBrief",
    preheader: "One click to activate your AdBrief account.",
    greeting: "Hey",
    headline: "Confirm your email.",
    body: "You created an AdBrief account. Click the button below to verify your email and activate your account.",
    cta: "Confirm my email →",
    expire_note: "This link expires in 24 hours.",
    footer: "You signed up at adbrief.pro",
    ignore: "If you didn't create this account, you can ignore this email.",
  },
  es: {
    subject: "Confirma tu email — AdBrief",
    preheader: "Un clic para activar tu cuenta en AdBrief.",
    greeting: "Hola",
    headline: "Confirma tu email.",
    body: "Creaste una cuenta en AdBrief. Haz clic en el botón para verificar tu email y activar tu cuenta.",
    cta: "Confirmar mi email →",
    expire_note: "Este enlace expira en 24 horas.",
    footer: "Te registraste en adbrief.pro",
    ignore: "Si no creaste esta cuenta, puedes ignorar este email.",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, confirmUrl: string): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark"/><title>${t.subject}</title></head>
<body style="margin:0;padding:0;background:#050508;-webkit-font-smoothing:antialiased;">
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t.preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050508;">
<tr><td align="center" style="padding:48px 16px 56px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <!-- LOGO -->
  <tr><td style="padding-bottom:36px;" align="center">
    <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.05em;font-family:${F};">ad</span><span style="font-size:22px;font-weight:800;color:#6366f1;letter-spacing:-0.05em;font-family:${F};">brief</span>
  </td></tr>

  <!-- MAIN CARD -->
  <tr><td style="border-radius:20px;overflow:hidden;background:rgba(255,255,255,0.03);border:1px solid rgba(99,102,241,0.15);">
    <!-- accent bar -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa);"></td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:40px 40px 0;">
      <p style="margin:0 0 6px;font-size:14px;color:rgba(255,255,255,0.4);font-family:${F};">${t.greeting} ${firstName},</p>
      <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.035em;line-height:1.2;font-family:${F};">${t.headline}</h1>
      <p style="margin:0 0 32px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.7;font-family:${F};">${t.body}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:0 40px 12px;" align="center">
      <a href="${confirmUrl}" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:14px;font-family:${F};box-shadow:0 8px 32px rgba(99,102,241,0.35);">${t.cta}</a>
    </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:16px 40px 36px;" align="center">
      <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.25);font-family:${F};">${t.expire_note}</p>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);font-family:${F};">${t.ignore}</p>
    </td></tr>
    </table>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:24px 8px 0;" align="center">
    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);font-family:${F};">${t.footer} · <a href="https://adbrief.pro" style="color:rgba(99,102,241,0.5);text-decoration:none;">adbrief.pro</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";
    const APP = Deno.env.get("APP_URL") ?? "https://adbrief.pro";

    if (!RESEND) {
      return new Response(JSON.stringify({ ok: false, error: "missing_resend_key" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = body.email;
    const name = body.name || "";
    const language = body.language || "en";
    // Always redirect to the dedicated confirmation success page
    const redirectPath = "/email-confirmed";

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "missing_email" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Server-side guard — authoritative. Blocks disposable domains + probe patterns
    // even if the client was bypassed (e.g. direct curl to the edge function).
    const guard = guardEmail(email);
    if (!guard.ok) {
      console.warn("[CONFIRM-EMAIL] Blocked signup:", email, "reason:", guard.reason, guard.domain ?? "");
      return new Response(
        JSON.stringify({ ok: false, error: "email_blocked", reason: guard.reason, domain: guard.domain }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0] || (lang === "pt" || lang === "es" ? "gestor" : "there");

    // Generate a magic link for email confirmation using Supabase Admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${APP}${redirectPath}`,
      },
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[CONFIRM-EMAIL] Link generation error:", linkError);
      // Fallback: use a simple link to the confirm page
      const fallbackUrl = `${APP}/confirm-email?email=${encodeURIComponent(email)}`;
      const html = buildHtml(t, firstName, fallbackUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [email], subject: t.subject, html }),
      });

      const data = await res.json();
      return new Response(JSON.stringify({ ok: res.ok, fallback: true, ...data }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Build the confirmation URL from the generated link
    const confirmUrl = linkData.properties.action_link || `${APP}/confirm-email?email=${encodeURIComponent(email)}`;
    const html = buildHtml(t, firstName, confirmUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: t.subject, html }),
    });

    const data = await res.json();
    console.log("[CONFIRM-EMAIL] Sent to", email, "ok:", res.ok);

    return new Response(JSON.stringify({ ok: res.ok, ...data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[CONFIRM-EMAIL] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
