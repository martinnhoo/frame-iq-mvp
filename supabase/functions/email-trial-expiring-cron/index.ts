// email-trial-expiring-cron — daily scan dos profiles com trial_end perto.
//
// Rationale: send-trial-expiring-email tem template completo dizendo "seu
// trial termina em {days_left} dias" mas estava órfão — sem trigger, sem
// cron. Resultado: usuários que iniciaram trial e não se converteram nunca
// recebem o aviso, descobrem só quando o acesso é cortado, e a janela
// crítica de conversão (2 dias antes) era 100% silêncio.
//
// Esse cron roda DIARIAMENTE. Pega usuários que:
//   • Têm subscription_status = 'trialing' (ou mesmo equivalência via
//     trial_end no futuro)
//   • Têm trial_end entre 1.5 dias e 2.5 dias do agora (janela do "2 dias
//     antes" com folga se cron pular um tick)
//   • Não receberam ainda o marker "trial-expiring-2d" no email_lifecycle_sent
//
// Pra cada user: invoca send-trial-expiring-email com days_left calculado
// dinamicamente (será 2 quase sempre, dado o filtro de janela).

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[TRIAL-EXPIRING] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

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

    // Window: 1.5d to 2.5d from now. Targets the "2 days before trial ends"
    // hit; if cron skips a day the user falls out of the window — we accept
    // that loss to avoid spamming twice if cron over-triggers.
    const upper = new Date(Date.now() + 2.5 * 86_400_000).toISOString();
    const lower = new Date(Date.now() + 1.5 * 86_400_000).toISOString();

    const { data: profiles, error: pErr } = await sb
      .from("profiles")
      .select("id, name, preferred_language, trial_end, email_lifecycle_sent")
      .gte("trial_end", lower)
      .lte("trial_end", upper);

    if (pErr) {
      log("query failed", pErr);
      return new Response(JSON.stringify({ error: "query_failed", details: pErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!profiles?.length) {
      log("no profiles in trial-expiring window");
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log(`found ${profiles.length} profiles in window`);

    let sent = 0;
    const errors: string[] = [];

    for (const p of profiles as Array<{
      id: string;
      name: string | null;
      preferred_language: string | null;
      trial_end: string;
      email_lifecycle_sent: string[] | null;
    }>) {
      try {
        const alreadySent = (p.email_lifecycle_sent || []) as string[];
        if (alreadySent.includes("trial-expiring-2d")) continue;

        // Email pulled from auth.users — profiles.email isn't always set
        // (Google OAuth path).
        const { data: authData } = await sb.auth.admin.getUserById(p.id);
        const email = authData?.user?.email;
        if (!email) {
          errors.push(`${p.id}: no email in auth.users`);
          continue;
        }

        // Compute days_left at send time (more accurate than the window
        // bounds — could be 2.0 or 1.7 depending on exact times).
        const msLeft = new Date(p.trial_end).getTime() - Date.now();
        const daysLeft = Math.max(1, Math.round(msLeft / 86_400_000));

        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-trial-expiring-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            email,
            name: p.name || "",
            language: p.preferred_language || "pt",
            days_left: daysLeft,
          }),
        });
        if (!res.ok) {
          errors.push(`${p.id}: send returned ${res.status}`);
          continue;
        }

        await sb.from("profiles")
          .update({ email_lifecycle_sent: [...alreadySent, "trial-expiring-2d"] })
          .eq("id", p.id);
        sent++;
        log(`sent trial-expiring (${daysLeft}d) to ${p.id}`);
      } catch (e) {
        errors.push(`${p.id}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({
      checked: profiles.length,
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
