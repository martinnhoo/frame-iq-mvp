// admin-test-emails — One-shot: dispara TODOS os emails pre-feitos pro user
// admin pra QA visual. Verifica que o caller é martinho@adbrief.pro (hard-
// coded por enquanto — única razão da função existir é validação de templates),
// daí proxy-ia chamada server-to-server com service role pra cada send-*-email
// com o payload correto. Retorna agregado: quais saíram OK, quais falharam.
//
// Uso:
//   supabase.functions.invoke("admin-test-emails", {
//     body: { target_email: "martinho@adbrief.pro" }
//   })
//
// Auth:
//   • verify_jwt = true → caller precisa estar logado
//   • Email do JWT precisa bater com ADMIN_EMAILS allowlist
//
// Não inclui:
//   • send-confirmation-email — gera Supabase magic link real, exige user
//     novo no auth.users; pula pra não poluir tabela de auth
//   • send-credit-alert — exige user_id real + state da tabela usage_alert_flags
//   • email-lifecycle — drip runner, picks qual mandar baseado em state real
//   • send-daily-intelligence-email — multi-account, exige snapshots reais
//   • notify-usage-alert — alert interno, não customer-facing

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hard-coded allowlist. A função inteira só existe pra QA do dono — não há
// caso de uso onde outro user precisa disparar 6 emails de teste em si mesmo.
const ADMIN_EMAILS = new Set([
  "martinho@adbrief.pro",
  "martinhovff@gmail.com",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Validate caller's JWT and confirm admin
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const callerToken = authHeader.slice(7);
    const { data: { user }, error: userErr } = await sb.auth.getUser(callerToken);
    if (userErr || !user?.email || !ADMIN_EMAILS.has(user.email.toLowerCase())) {
      return new Response(JSON.stringify({
        error: "not_admin",
        hint: "this function is restricted to the AdBrief admin",
      }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const TARGET = body.target_email || user.email;
    const NAME = body.name || (user.user_metadata?.name as string) || "Martinho";
    const LANG = body.language || "pt";
    // Optional: restrict to a specific template (e.g. "send-activation-email").
    // When set, only that sender fires (instead of all 5). Useful for batch
    // sends where you want to push ONE email to a list of users.
    const TEMPLATE: string | null = body.template || null;
    // Optional: list of recipient emails. When set, the chosen template
    // fires once per email instead of once. Caller is still admin-only.
    const TARGETS: string[] = Array.isArray(body.targets) && body.targets.length
      ? body.targets.filter((t: unknown) => typeof t === "string" && t.includes("@"))
      : [TARGET];

    // Default test set (when no template specified) — fires all 5 to the
    // single TARGET as a QA sweep.
    const allTests = [
      { fn: "send-welcome-email",         body: { email: TARGET, name: NAME, language: LANG } },
      { fn: "send-activation-email",      body: { email: TARGET, name: NAME, language: LANG } },
      { fn: "send-trial-expiring-email",  body: { email: TARGET, name: NAME, language: LANG, days_left: 2 } },
      { fn: "send-reengagement-email",    body: { email: TARGET, name: NAME, language: LANG } },
      { fn: "send-demo-followup-email",   body: { email: TARGET, name: NAME, language: LANG, score: 65 } },
    ];

    // Build the actual test list. Two modes:
    //   • {template, targets} → fire that template once per target
    //   • default → fire all 5 templates to single TARGET (QA sweep)
    const tests = TEMPLATE
      ? TARGETS.map((email) => {
          const proto = allTests.find((t) => t.fn === TEMPLATE);
          if (!proto) return null;
          // Re-key the body's email field per target while keeping any
          // template-specific extras (days_left, score, etc).
          return { fn: proto.fn, body: { ...proto.body, email } };
        }).filter(Boolean) as { fn: string; body: Record<string, unknown> }[]
      : allTests;

    if (TEMPLATE && tests.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: "unknown_template",
        hint: `template must be one of: ${allTests.map((t) => t.fn).join(", ")}`,
      }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const results: Array<{ fn: string; email?: string; status: number | string; ok: boolean; response?: unknown }> = [];

    for (const t of tests) {
      try {
        // Service-role auth header — what every send-* function expects when
        // called by an internal trigger (cron / lifecycle / this admin shim).
        const res = await fetch(`${SUPABASE_URL}/functions/v1/${t.fn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify(t.body),
        });
        const text = await res.text();
        let parsed: unknown = null;
        try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 300); }
        results.push({
          fn: t.fn,
          email: (t.body as any).email as string,
          status: res.status,
          ok: res.ok,
          response: parsed,
        });
        // Brief pause to avoid Resend rate-limit on bursty calls
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        results.push({
          fn: t.fn,
          email: (t.body as any).email as string,
          status: "fetch_error",
          ok: false,
          response: String(e),
        });
      }
    }

    const sentCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({
      ok: true,
      target: TARGET,
      sent: sentCount,
      total: results.length,
      results,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
