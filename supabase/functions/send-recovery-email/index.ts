// send-recovery-email — one-off apology + "come back" CTA for a user who
// hit a bug that broke their session. Internal-only (service-role gated).
//
// Invoke:
//   supabase.functions.invoke("send-recovery-email", {
//     body: { email, name?, language? /* pt|en|es */ }
//   })
//
// Or via curl with SERVICE_ROLE bearer token.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildEmailHtml } from "../_shared/email-layout.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Lang = "en" | "pt" | "es";

const T: Record<Lang, {
  subject: string; preheader: string; salut: string; headline: string;
  body1: string; body2: string; body3: string; cta: string; ps: string;
  sig: string; footer: string;
}> = {
  pt: {
    subject: "Desculpa pelo erro de ontem — já corrigi",
    preheader: "Era um bug chato no meu código. Tá arrumado. Volta que agora passa direto.",
    salut: "Oi",
    headline: "Vim te pedir desculpa.",
    body1: "Você tentou usar o AdBrief ontem e pegou um erro quando abriu a tela de upgrade — um bug meu no código que travou a sessão.",
    body2: "Já corrigi (ontem à noite). Quem entra agora passa direto: conecta a conta do Meta em 1 minuto, a IA começa a te avisar no Telegram quando algo precisa de atenção, e o teste é grátis sem cartão.",
    body3: "Se quiser voltar, é só clicar aqui embaixo. Se preferir, me responde esse email direto — eu sou o Martinho, founder. Leio todos.",
    cta: "Voltar pro AdBrief →",
    ps: "PS: se pegar outro erro, me manda print. Corrijo na hora.",
    sig: "Martinho",
    footer: "Você se cadastrou em adbrief.pro",
  },
  en: {
    subject: "Sorry about yesterday's error — I fixed it",
    preheader: "It was a dumb bug in my code. It's fixed now. Come back and try again.",
    salut: "Hey",
    headline: "I owe you an apology.",
    body1: "You tried using AdBrief yesterday and hit an error when the upgrade screen opened — a bug in my code that broke the session.",
    body2: "I already fixed it (last night). Now you can connect your Meta account in 1 minute, the AI starts alerting you on Telegram when something needs attention, and the trial is free, no card required.",
    body3: "If you want to come back, just click below. Or reply to this email directly — I'm Martinho, the founder. I read every one.",
    cta: "Come back to AdBrief →",
    ps: "PS: if you hit another error, send me a screenshot. I'll fix it on the spot.",
    sig: "Martinho",
    footer: "You signed up at adbrief.pro",
  },
  es: {
    subject: "Perdón por el error de ayer — ya lo arreglé",
    preheader: "Era un bug tonto en mi código. Está arreglado. Vuelve y prueba de nuevo.",
    salut: "Hola",
    headline: "Te debo una disculpa.",
    body1: "Ayer intentaste usar AdBrief y chocaste con un error cuando se abrió la pantalla de upgrade — un bug en mi código que rompió la sesión.",
    body2: "Ya lo arreglé (anoche). Ahora puedes conectar tu cuenta de Meta en 1 minuto, la IA empieza a avisarte por Telegram cuando algo necesita atención, y la prueba es gratis, sin tarjeta.",
    body3: "Si quieres volver, sólo haz clic abajo. O respóndeme este email directo — soy Martinho, el founder. Los leo todos.",
    cta: "Volver a AdBrief →",
    ps: "PD: si ves otro error, mándame un screenshot. Lo arreglo al momento.",
    sig: "Martinho",
    footer: "Te registraste en adbrief.pro",
  },
};

function detectLang(raw?: string | null): Lang {
  if (!raw) return "pt"; // default PT since most users are BR
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

function buildHtml(t: typeof T["pt"], firstName: string, appUrl: string): string {
  // Body has 3 paragraphs in the i18n strings; concatenate with line breaks
  // and append a signature line — the recovery email has a personal voice
  // ("— Martinho, founder") that the layout shows under body via simple
  // double-line-break followed by italic-styled inline HTML.
  const body = [
    t.body1,
    t.body2,
    t.body3,
    `<br/><span style="color:rgba(240,246,252,0.55);font-style:italic;">— ${t.sig}, founder</span>`,
  ].join("<br/><br/>");
  return buildEmailHtml({
    subject: t.subject,
    preheader: t.preheader,
    appUrl,
    greeting: `${t.salut} ${firstName},`,
    headline: t.headline,
    body,
    ctaLabel: t.cta,
    ctaUrl: `${appUrl}/dashboard/accounts`,
    ps: t.ps,
    footerLine: t.footer,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    // Internal only — must present service-role bearer
    const authH = req.headers.get("Authorization") ?? "";
    if (authH !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM   = Deno.env.get("RESEND_FROM_EMAIL") ?? "Martinho from AdBrief <hello@adbrief.pro>";
    const REPLY  = Deno.env.get("RESEND_REPLY_TO") ?? "martinhovff@gmail.com";
    const APP    = Deno.env.get("APP_URL") ?? "https://adbrief.pro";

    const body = await req.json().catch(() => ({}));
    const { email, name, language } = body as { email?: string; name?: string; language?: string };

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "missing_email" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const lang = detectLang(language);
    const t = T[lang];
    const firstName = (name || "").split(" ")[0]
      || (lang === "pt" ? "gestor" : lang === "es" ? "gestor" : "there");
    const html = buildHtml(t, firstName, APP);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: REPLY,
        subject: t.subject,
        html,
      }),
    });
    const data = await res.json();
    return new Response(
      JSON.stringify({ ok: res.ok, resend: data }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
