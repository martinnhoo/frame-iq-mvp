// email-lifecycle v1 — progressive 6-email drip sequence
// Runs daily via pg_cron. For each free user, determines which email to send
// based on days since signup, Meta connection status, and engagement.
//
// Sequence:
//   Day 0  → welcome          (send-welcome-email — triggered on signup, not here)
//   Day 1  → activation       (connect Meta Ads)
//   Day 3  → value-reminder   (show what AI found / re-nudge)
//   Day 5  → social-proof     (other users' results)
//   Day 7  → re-engagement    (urgency — budget burning)
//   Day 14 → last-chance      (final pitch before going quiet)
//
// Paid users and users who already received a given step are skipped.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[EMAIL-LIFECYCLE] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

type Lang = "en" | "pt" | "es";

function detectLang(raw?: string | null): Lang {
  if (!raw) return "en";
  const c = raw.toLowerCase().slice(0, 2);
  if (c === "pt") return "pt";
  if (c === "es") return "es";
  return "en";
}

// ── Email Templates ──────────────────────────────────────────────────────────

const TEMPLATES: Record<string, Record<Lang, {
  subject: string; preheader: string; headline: string;
  body: string; cta: string; ctaUrl: string; ps: string;
}>> = {
  "day3-value": {
    pt: {
      subject: "A IA já encontrou algo na sua conta.",
      preheader: "Seus dados estão prontos. A IA tem insights esperando por você.",
      headline: "A IA já analisou seus dados.",
      body: "Desde que você conectou, o AdBrief identificou padrões nos seus criativos — quais estão performando, quais estão em fadiga, e onde seu orçamento está sendo desperdiçado. Não perca tempo checando manualmente.",
      cta: "Ver insights da minha conta →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Tudo isso em 60 segundos. Sem tocar nas suas campanhas.",
    },
    en: {
      subject: "The AI already found something in your account.",
      preheader: "Your data is ready. The AI has insights waiting for you.",
      headline: "The AI already analyzed your data.",
      body: "Since you connected, AdBrief identified patterns in your creatives — which ones are performing, which are fatigued, and where your budget is being wasted. Stop checking manually.",
      cta: "See my account insights →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "All in 60 seconds. Without touching your campaigns.",
    },
    es: {
      subject: "La IA ya encontró algo en tu cuenta.",
      preheader: "Tus datos están listos. La IA tiene insights esperándote.",
      headline: "La IA ya analizó tus datos.",
      body: "Desde que conectaste, AdBrief identificó patrones en tus creativos — cuáles están performando, cuáles están en fatiga, y dónde tu presupuesto se está desperdiciando. Deja de revisar manualmente.",
      cta: "Ver insights de mi cuenta →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Todo en 60 segundos. Sin tocar tus campañas.",
    },
  },
  "day3-nudge": {
    pt: {
      subject: "Você está usando o AdBrief no modo genérico.",
      preheader: "Sem Meta Ads conectado, as respostas são 80% menos úteis.",
      headline: "Seus resultados vão mudar com uma conexão.",
      body: "Você usou o chat — e isso é ótimo. Mas sem seus dados reais, a IA responde como qualquer chatbot genérico. Conecte o Meta Ads e veja a diferença: ROAS em tempo real, fadiga criativa, hooks baseados no que funciona na SUA conta.",
      cta: "Conectar Meta Ads em 60s →",
      ctaUrl: "https://adbrief.pro/dashboard/accounts",
      ps: "Acesso somente leitura. Nunca tocamos nas suas campanhas.",
    },
    en: {
      subject: "You're using AdBrief in generic mode.",
      preheader: "Without Meta Ads connected, answers are 80% less useful.",
      headline: "Your results will change with one connection.",
      body: "You used the chat — and that's great. But without your real data, the AI responds like any generic chatbot. Connect Meta Ads and see the difference: real-time ROAS, creative fatigue, hooks based on what works in YOUR account.",
      cta: "Connect Meta Ads in 60s →",
      ctaUrl: "https://adbrief.pro/dashboard/accounts",
      ps: "Read-only access. We never touch your campaigns.",
    },
    es: {
      subject: "Estás usando AdBrief en modo genérico.",
      preheader: "Sin Meta Ads conectado, las respuestas son 80% menos útiles.",
      headline: "Tus resultados van a cambiar con una conexión.",
      body: "Usaste el chat — y eso es genial. Pero sin tus datos reales, la IA responde como cualquier chatbot genérico. Conecta Meta Ads y ve la diferencia: ROAS en tiempo real, fatiga creativa, hooks basados en lo que funciona en TU cuenta.",
      cta: "Conectar Meta Ads en 60s →",
      ctaUrl: "https://adbrief.pro/dashboard/accounts",
      ps: "Acceso solo lectura. Nunca tocamos tus campañas.",
    },
  },
  "day5-social-proof": {
    pt: {
      subject: "Gestor encontrou R$ 4.200/mês em desperdício usando o AdBrief.",
      preheader: "Resultados reais de quem usa a IA conectada com Meta Ads.",
      headline: "O que outros gestores estão fazendo.",
      body: "Nas últimas semanas, gestores usando AdBrief identificaram criativos em fadiga antes de perder 30-40% do orçamento, geraram hooks que aumentaram CTR em até 2.3x, e descobriram que estavam gastando em públicos saturados. A diferença? Dados reais conectados + IA que sabe interpretar.",
      cta: "Experimentar com minha conta →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Tudo isso dentro do plano que você já tem. Comece agora.",
    },
    en: {
      subject: "Manager found $840/mo in wasted spend using AdBrief.",
      preheader: "Real results from teams using the AI connected to Meta Ads.",
      headline: "What other managers are doing.",
      body: "In the past weeks, managers using AdBrief caught creative fatigue before losing 30-40% of their budget, generated hooks that boosted CTR by up to 2.3x, and discovered they were spending on saturated audiences. The difference? Real data connected + AI that knows how to interpret it.",
      cta: "Try with my account →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "All of this within your current plan. Start now.",
    },
    es: {
      subject: "Gestor encontró $840/mes en gasto desperdiciado usando AdBrief.",
      preheader: "Resultados reales de equipos usando la IA conectada con Meta Ads.",
      headline: "Lo que otros gestores están haciendo.",
      body: "En las últimas semanas, gestores usando AdBrief detectaron fatiga creativa antes de perder 30-40% del presupuesto, generaron hooks que aumentaron CTR hasta 2.3x, y descubrieron que estaban gastando en audiencias saturadas. La diferencia? Datos reales conectados + IA que sabe interpretar.",
      cta: "Probar con mi cuenta →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Todo esto dentro de tu plan actual. Empieza ahora.",
    },
  },
  "day14-last-chance": {
    pt: {
      subject: "Última mensagem antes de silenciar.",
      preheader: "Não vamos mais mandar emails. Mas sua conta continua pronta.",
      headline: "Vamos parar de mandar emails.",
      body: "Essa é a última mensagem da nossa sequência. Não queremos ser spam. Mas antes de ir: sua conta no AdBrief continua ativa e pronta. A IA sabe quem você é e o que faz. Quando precisar identificar fadiga criativa, gerar hooks, ou entender por que o ROAS caiu — estamos aqui. Basta voltar.",
      cta: "Manter minha conta ativa →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Se quiser, pode desconectar o Meta Ads nas configurações a qualquer momento.",
    },
    en: {
      subject: "Last message before we go quiet.",
      preheader: "We won't email you again. But your account stays ready.",
      headline: "We're going to stop emailing.",
      body: "This is the last email in our sequence. We don't want to be spam. But before we go: your AdBrief account is still active and ready. The AI knows who you are and what you do. When you need to spot creative fatigue, generate hooks, or understand why ROAS dropped — we're here. Just come back.",
      cta: "Keep my account active →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "You can disconnect Meta Ads in settings anytime.",
    },
    es: {
      subject: "Último mensaje antes de silenciarnos.",
      preheader: "No te enviaremos más emails. Pero tu cuenta sigue lista.",
      headline: "Vamos a dejar de enviar emails.",
      body: "Este es el último email de nuestra secuencia. No queremos ser spam. Pero antes de irnos: tu cuenta en AdBrief sigue activa y lista. La IA sabe quién eres y qué haces. Cuando necesites detectar fatiga creativa, generar hooks, o entender por qué bajó el ROAS — estamos aquí. Solo vuelve.",
      cta: "Mantener mi cuenta activa →",
      ctaUrl: "https://adbrief.pro/dashboard",
      ps: "Puedes desconectar Meta Ads en configuración cuando quieras.",
    },
  },
};

// ── HTML Builder (matches existing email style) ────────────────────────────

function buildHtml(
  t: { subject: string; headline: string; body: string; cta: string; ctaUrl: string; ps: string },
  firstName: string,
): string {
  const F = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0e14;font-family:${F};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e14;"><tr><td align="center" style="padding:40px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:16px;">
    <tr><td style="padding:36px 32px 0;">
      <img src="https://adbrief.pro/logo-email.png" alt="AdBrief" width="90" style="display:block;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:14px;color:rgba(200,210,230,0.5);font-family:${F};">Hey${firstName ? ` ${firstName}` : ""},</p>
      <h1 style="margin:0 0 20px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.04em;line-height:1.2;font-family:${F};">${t.headline}</h1>
      <p style="margin:0 0 28px;font-size:14px;color:rgba(200,210,230,0.55);line-height:1.7;font-family:${F};">${t.body}</p>
      <table cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:12px;background:linear-gradient(135deg,#0ea5e9,#06b6d4);">
        <a href="${t.ctaUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#000;text-decoration:none;font-family:${F};letter-spacing:-0.02em;">${t.cta}</a>
      </td></tr></table>
      <p style="margin:24px 0 0;font-size:12px;color:rgba(200,210,230,0.3);line-height:1.6;font-family:${F};font-style:italic;">P.S. ${t.ps}</p>
    </td></tr>
    <tr><td style="padding:28px 32px;border-top:1px solid rgba(255,255,255,0.04);">
      <p style="margin:0;font-size:11px;color:rgba(200,210,230,0.2);font-family:${F};text-align:center;">adbrief.pro · Unsubscribe by replying "stop"</p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// ── Lifecycle Steps ──────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  raw_user_meta_data: Record<string, unknown>;
  created_at: string;
}

interface LifecycleStep {
  day: number;
  key: string;
  templateFn: (user: UserRow, hasMetaConnection: boolean, lang: Lang) => {
    template: string;
    skip: boolean;
  };
}

const STEPS: LifecycleStep[] = [
  // Day 0: welcome — handled by send-welcome-email on signup trigger, skip here
  {
    day: 1,
    key: "day1-activation",
    templateFn: (_u, hasMeta) => ({
      template: "", // delegates to existing send-activation-email
      skip: hasMeta, // skip if already connected
    }),
  },
  {
    day: 3,
    key: "day3",
    templateFn: (_u, hasMeta) => ({
      template: hasMeta ? "day3-value" : "day3-nudge",
      skip: false,
    }),
  },
  {
    day: 5,
    key: "day5-social-proof",
    templateFn: () => ({
      template: "day5-social-proof",
      skip: false,
    }),
  },
  // Day 7: re-engagement — handled by send-reengagement-email, skip here
  {
    day: 14,
    key: "day14-last-chance",
    templateFn: () => ({
      template: "day14-last-chance",
      skip: false,
    }),
  },
];

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    log("Starting lifecycle check");

    const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "AdBrief <hello@adbrief.pro>";

    if (!RESEND) {
      log("RESEND_API_KEY not set — exiting");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get all free users who signed up in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, plan, preferred_language, created_at, name, email_lifecycle_sent")
      .or("plan.eq.free,plan.is.null")
      .gte("created_at", thirtyDaysAgo);

    if (pErr) throw new Error(JSON.stringify(pErr));
    if (!profiles?.length) {
      log("No eligible users found");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log(`Found ${profiles.length} free users to check`);

    // Get auth users for emails
    let sent = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
      try {
        const daysSinceSignup = Math.floor(
          (Date.now() - new Date(profile.created_at).getTime()) / 86400000,
        );

        // Track which emails were already sent (stored as JSON array of step keys)
        const alreadySent: string[] = profile.email_lifecycle_sent || [];

        // Check if user has Meta connection
        const { count: metaCount } = await supabase
          .from("platform_connections")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("platform", "meta");
        const hasMetaConnection = (metaCount ?? 0) > 0;

        const lang = detectLang(profile.preferred_language);

        // Find the right step for this user
        for (const step of STEPS) {
          if (daysSinceSignup < step.day) continue; // not time yet
          if (alreadySent.includes(step.key)) continue; // already sent

          const { template, skip } = step.templateFn(
            { id: profile.id, email: "", raw_user_meta_data: {}, created_at: profile.created_at },
            hasMetaConnection,
            lang,
          );

          if (skip) {
            // Mark as sent (skipped) so we don't check again
            alreadySent.push(step.key);
            continue;
          }

          // Day 1 activation — delegate to existing function.
          // Skip if email-fast-activation (hourly cron) already fired the
          // same activation copy in the early window. Without this guard
          // a user signing up at 14h would get the activation email at
          // ~15h (fast cron) AND again at 10h next day (this daily cron).
          if (step.key === "day1-activation") {
            if (alreadySent.includes("fast-activation")) {
              alreadySent.push(step.key);
              continue;
            }
            try {
              await supabase.functions.invoke("send-activation-email", {
                body: { user_id: profile.id },
              });
              alreadySent.push(step.key);
              sent++;
              log(`Sent day1-activation to ${profile.id}`);
            } catch (e) {
              errors.push(`day1-activation ${profile.id}: ${e}`);
            }
            break; // only send one email per user per day
          }

          // Custom templates
          const tmpl = TEMPLATES[template]?.[lang] || TEMPLATES[template]?.en;
          if (!tmpl) {
            log(`Template not found: ${template}`);
            continue;
          }

          // Get user email from auth
          const { data: authData } = await supabase.auth.admin.getUserById(profile.id);
          const email = authData?.user?.email;
          if (!email) continue;

          const firstName = (profile.name || authData?.user?.user_metadata?.full_name || "")
            .split(" ")[0] || "";

          const html = buildHtml(tmpl, firstName);

          // Send via Resend
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM,
              to: [email],
              subject: tmpl.subject,
              html,
              headers: { "X-Entity-Ref-ID": `lifecycle-${step.key}-${profile.id}` },
            }),
          });

          if (res.ok) {
            alreadySent.push(step.key);
            sent++;
            log(`Sent ${step.key} to ${profile.id} (${email})`);
          } else {
            const errText = await res.text();
            errors.push(`${step.key} ${profile.id}: ${res.status} ${errText}`);
          }

          break; // only send one email per user per day
        }

        // Update lifecycle tracking
        if (alreadySent.length > (profile.email_lifecycle_sent?.length ?? 0)) {
          await supabase
            .from("profiles")
            .update({ email_lifecycle_sent: alreadySent })
            .eq("id", profile.id);
        }
      } catch (e) {
        errors.push(`user ${profile.id}: ${e}`);
      }
    }

    log(`Done. Sent: ${sent}, Errors: ${errors.length}`);

    return new Response(JSON.stringify({ sent, errors: errors.slice(0, 10) }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERROR", { error: String(e) });
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
