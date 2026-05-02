// email-demo-followup-cron — daily scan dos demo_leads pra mandar followup.
//
// Rationale: usuário roda analyze-demo em /demo, opcionalmente fornece email.
// Hoje a gente armazena no demo_leads e nunca mais fala com a pessoa. O
// template send-demo-followup-email existe mas estava órfão.
//
// Esse cron roda DIARIAMENTE. Pega leads com:
//   • email IS NOT NULL (lead opt-in real)
//   • created_at entre 22h e 26h atrás (janela de "24h pós demo" com folga
//     se o cron pular um tick)
//   • followup_sent_at IS NULL (idempotência — não manda 2x)
//
// Pra cada lead: invoca send-demo-followup-email com {email, score, lang}
// e marca followup_sent_at = now().
//
// Não exige Meta connected nem signup — esse é exatamente o ponto: o lead
// rodou demo (comprova interesse), passou 24h sem cadastrar, e a gente
// devolve a análise dele com CTA pra trial. Zero followup era zero
// conversão de demo → signup; agora vira ponto de retorno.

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[DEMO-FOLLOWUP] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Window: 22-26h ago. Tighter than 0-26h to avoid catching demos run
    // moments before the cron tick — those need a full 24h to mature.
    const upper = new Date(Date.now() - 22 * 60 * 60_000).toISOString(); // <= 22h ago
    const lower = new Date(Date.now() - 26 * 60 * 60_000).toISOString(); // >= 26h ago

    const { data: leads, error: lErr } = await sb
      .from("demo_leads")
      .select("id, email, analysis_score, lang, created_at")
      .not("email", "is", null)
      .is("followup_sent_at", null)
      .gte("created_at", lower)
      .lte("created_at", upper);

    if (lErr) {
      log("query failed", lErr);
      return new Response(JSON.stringify({ error: "query_failed", details: lErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!leads?.length) {
      log("no leads in window");
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log(`found ${leads.length} leads to followup`);

    let sent = 0;
    const errors: string[] = [];

    for (const lead of leads as Array<{
      id: string;
      email: string;
      analysis_score: number | null;
      lang: string | null;
      created_at: string;
    }>) {
      try {
        // Skip leads that converted to a signed-up user — they're now in the
        // main lifecycle (welcome / activation / etc) and getting a demo
        // followup would step on those. Detected by checking if a profile
        // exists for the same email.
        // Note: profiles.email isn't guaranteed populated for every signup
        // (Google OAuth path stores it in auth.users only); this check is
        // best-effort and false-negatives just send a redundant email,
        // never a duplicate after followup_sent_at is set below.
        const { count: profileCount } = await sb
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("email", lead.email);
        if ((profileCount ?? 0) > 0) {
          // Mark as "sent" so we never check again — they're not a demo
          // lead anymore, they're a user.
          await sb.from("demo_leads")
            .update({ followup_sent_at: new Date().toISOString(), converted: true })
            .eq("id", lead.id);
          continue;
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-demo-followup-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            email: lead.email,
            // We don't store name in demo_leads (anonymous-by-default funnel).
            // send-demo-followup-email's i18n falls back gracefully to "gestor"
            // / "there" when name is empty.
            name: "",
            language: lead.lang || "pt",
            score: lead.analysis_score ?? 0,
          }),
        });
        if (!res.ok) {
          errors.push(`${lead.id}: send returned ${res.status}`);
          continue;
        }

        await sb.from("demo_leads")
          .update({ followup_sent_at: new Date().toISOString() })
          .eq("id", lead.id);
        sent++;
        log(`sent followup to lead ${lead.id} (score ${lead.analysis_score})`);
      } catch (e) {
        errors.push(`${lead.id}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({
      checked: leads.length,
      sent,
      errors: errors.length ? errors : undefined,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    log("unhandled error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
