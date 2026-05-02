// email-fast-activation — captura usuário antes de esfriar.
//
// Rationale: o lifecycle email diário (email-lifecycle) só roda às 10:00 UTC
// e o "Day 1 activation" exige >= 24h desde signup. Pra usuário que cadastra
// às 14h e fica sem conectar Meta, isso é 20h de silêncio — janela enorme
// onde ele cai pra desinteresse, esquece, ou abre 5 ferramentas concorrentes.
//
// Esse cron roda HORÁRIO. Pega quem:
//   • Cadastrou >= 1 hora atrás
//   • Ainda não conectou Meta
//   • Ainda não recebeu fast-activation OU day1-activation (evita duplicar)
//
// Reusa o template send-activation-email existente — mesma copy
// "você criou a conta mas não conectou Meta" funciona pras duas janelas
// temporais; o que muda é só o timing.
//
// Side-effect: ao mandar, marca "fast-activation" em
// profiles.email_lifecycle_sent. O email-lifecycle daily depois vê esse
// marker e pula o "day1-activation" (evita 2 emails idênticos).

import { createClient } from "npm:@supabase/supabase-js@2";
import { isCronAuthorized, unauthorizedResponse } from "../_shared/cron-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, d?: unknown) =>
  console.log(`[FAST-ACTIVATION] ${step}${d ? ` — ${JSON.stringify(d)}` : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!isCronAuthorized(req)) return unauthorizedResponse(cors);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Free users created at least 1h ago, less than 7 days ago. The 7d cap
    // avoids scanning the entire user base every hour — fast-activation is
    // explicitly an "early window" play, not a weeks-later reminder.
    const { data: candidates, error: cErr } = await sb
      .from("profiles")
      .select("id, name, preferred_language, email_lifecycle_sent, created_at")
      .or("plan.eq.free,plan.is.null")
      .gte("created_at", sevenDaysAgo)
      .lte("created_at", oneHourAgo);

    if (cErr) {
      log("query failed", cErr);
      return new Response(JSON.stringify({ error: "query_failed", details: cErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!candidates?.length) {
      log("no candidates");
      return new Response(JSON.stringify({ checked: 0, sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    log(`checking ${candidates.length} candidates`);

    let sent = 0;
    const errors: string[] = [];
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

    for (const p of candidates as Array<{
      id: string;
      name: string | null;
      preferred_language: string | null;
      email_lifecycle_sent: string[] | null;
      created_at: string;
    }>) {
      try {
        const alreadySent = (p.email_lifecycle_sent || []) as string[];
        // Idempotent: skip if either fast-activation OR day1-activation marker
        // is already present — avoids double-sending the same email if the
        // user was eligible during a daily run that fired before this cron.
        if (alreadySent.includes("fast-activation") || alreadySent.includes("day1-activation")) {
          continue;
        }

        // Has Meta connected? If yes, skip — activation email no longer
        // relevant.
        const { count: metaCount } = await sb
          .from("platform_connections")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.id)
          .eq("platform", "meta");
        if ((metaCount ?? 0) > 0) {
          // Mark as sent (skipped path) so we never check this user again
          // for fast-activation. Saves work on subsequent hourly runs.
          await sb
            .from("profiles")
            .update({ email_lifecycle_sent: [...alreadySent, "fast-activation"] })
            .eq("id", p.id);
          continue;
        }

        // Need email — pull from auth.users (profiles row may not have it).
        const { data: authData } = await sb.auth.admin.getUserById(p.id);
        const email = authData?.user?.email;
        if (!email) {
          errors.push(`${p.id}: no email in auth.users`);
          continue;
        }

        // Fire send-activation-email server-to-server with service role auth
        // (matches the auth gate inside that sender).
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-activation-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE}`,
          },
          body: JSON.stringify({
            email,
            name: p.name || "",
            language: p.preferred_language || "pt",
          }),
        });
        if (!res.ok) {
          errors.push(`${p.id}: send-activation-email returned ${res.status}`);
          continue;
        }

        // Mark as sent so we don't double-fire (and the daily lifecycle skips
        // its own day1 step too).
        await sb
          .from("profiles")
          .update({ email_lifecycle_sent: [...alreadySent, "fast-activation"] })
          .eq("id", p.id);
        sent++;
        log(`sent fast-activation to ${p.id}`);
      } catch (e) {
        errors.push(`${p.id}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({
      checked: candidates.length,
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
