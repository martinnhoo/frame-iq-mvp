// bootstrap-key — One-shot patch pra reanimar todos os crons do AdBrief.
//
// Por quê: pg_cron jobs do `adbrief-*` foram criados em algum momento com
// strings placeholder no lugar da service_role key real (vimos `<SERVICE_
// ROLE_KEY>` 18 chars e `COLA_AQUI_A_SERVICE_ROLE_KEY` 28 chars embedadas).
// Resultado: cada cron tick → 401 → 11+ schedules silenciosos:
//   • check-critical-alerts (alertas Resend + Telegram + sininho)
//   • email-lifecycle, email-fast-activation, email-trial-expiring-cron,
//     email-demo-followup-cron (lifecycle de email todo)
//   • daily-intelligence, market-intelligence, weekly-report,
//     creative-director (intelligence pipeline)
//   • sync-ad-diary, trend-watcher (data refresh)
//
// Solução: este function tem acesso à SUPABASE_SERVICE_ROLE_KEY de verdade
// via Deno.env, conecta no DB direto via SUPABASE_DB_URL, e:
//   1) Roda UPDATE em cron.job substituindo qualquer "Bearer <stale>" pela
//      key real via regexp_replace
//   2) Salva a key no vault.secrets.adbrief_service_role_key (best-effort)
//   3) Devolve relatório do que mudou (snapshot before/after)
//
// Auth: ADMIN-ONLY. JWT do caller precisa bater com ADMIN_EMAILS allowlist.
// Não pode ser cron-protected (mesmo problema chicken-and-egg) nem público
// (vazaria operação destrutiva). User precisa estar logado como
// martinho@adbrief.pro / martinhovff@gmail.com.
//
// Idempotente: rodar 2x não quebra nada — segunda execução só substitui
// pela mesma key.
//
// Deploy: arquivo NOVO → Lovable auto-deploya no push (funcionou pra
// email-fast-activation, email-trial-expiring-cron, email-demo-followup-
// cron — só MOD não deploya).
//
// Uso (após deploy, do lado do user logado em adbrief.pro):
//   const { data: { session } } = await supabase.auth.getSession();
//   await fetch(`${SUPABASE_URL}/functions/v1/bootstrap-key`, {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${session.access_token}` },
//   }).then(r => r.json());

import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = new Set([
  "martinho@adbrief.pro",
  "martinhovff@gmail.com",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const DB_URL       = Deno.env.get("SUPABASE_DB_URL") ?? "";

    if (!SUPABASE_URL || !SERVICE_ROLE || !DB_URL) {
      return new Response(JSON.stringify({
        error: "server_misconfigured",
        has_url: !!SUPABASE_URL, has_role: !!SERVICE_ROLE, has_db: !!DB_URL,
      }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Sanity check da key — service_role keys são JWTs ~200+ chars começando
    // com "eyJ". Se vier curto ou outro formato, env tá quebrado e abort.
    if (SERVICE_ROLE.length < 100 || !SERVICE_ROLE.startsWith("eyJ")) {
      return new Response(JSON.stringify({
        error: "service_role_invalid",
        hint: "Deno.env SUPABASE_SERVICE_ROLE_KEY não é JWT — env quebrado",
        len: SERVICE_ROLE.length,
        prefix: SERVICE_ROLE.slice(0, 8),
      }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
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
        hint: "admin-only — login as martinho@adbrief.pro",
      }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── PATCH PIPELINE ──────────────────────────────────────────────────
    const dbsql = postgres(DB_URL, { max: 1, connect_timeout: 10 });

    try {
      // Snapshot pre-patch (pra reportar diff legível)
      const before = await dbsql`
        SELECT jobname, length(substring(command FROM 'Bearer ([^"]+)')) AS key_len
        FROM cron.job
        WHERE command LIKE '%Bearer %'
        ORDER BY jobname
      `;

      // Patch — substitui qualquer "Bearer xxx" por "Bearer <real>" em todos
      // os crons que tenham bearer no command. Bem amplo de propósito —
      // captura placeholders curtos e JWTs antigos rotacionados.
      const patchResult = await dbsql`
        UPDATE cron.job
        SET command = regexp_replace(command, 'Bearer [^"]+', ${'Bearer ' + SERVICE_ROLE}, 'g')
        WHERE command LIKE '%Bearer %'
        RETURNING jobname
      `;

      // Snapshot pos-patch
      const after = await dbsql`
        SELECT jobname, length(substring(command FROM 'Bearer ([^"]+)')) AS key_len
        FROM cron.job
        WHERE command LIKE '%Bearer %'
        ORDER BY jobname
      `;

      // Vault — best-effort. Se a entry existir, atualiza pra futuras
      // chamadas SQL puxarem a key direto sem precisar deste function.
      // pgsodium pode bloquear UPDATE direto — tenta vault.update_secret
      // primeiro, fallback pra UPDATE.
      let vaultUpdated = false;
      let vaultError: string | null = null;
      try {
        await dbsql`
          SELECT vault.update_secret(
            (SELECT id FROM vault.secrets WHERE name = 'adbrief_service_role_key'),
            ${SERVICE_ROLE}
          )
        `;
        vaultUpdated = true;
      } catch (e1) {
        try {
          await dbsql`
            UPDATE vault.secrets
            SET secret = ${SERVICE_ROLE}
            WHERE name = 'adbrief_service_role_key'
          `;
          vaultUpdated = true;
        } catch (e2) {
          vaultError = `update_secret: ${String(e1).slice(0, 100)} | direct: ${String(e2).slice(0, 100)}`;
        }
      }

      const report = {
        ok: true,
        patched_jobs: patchResult.length,
        jobs_patched: patchResult.map((r: any) => r.jobname),
        before: before.map((r: any) => ({ name: r.jobname, key_len: r.key_len })),
        after: after.map((r: any) => ({ name: r.jobname, key_len: r.key_len })),
        vault_updated: vaultUpdated,
        vault_error: vaultError,
        service_role_len: SERVICE_ROLE.length,
        note: "Crons rodam no próximo tick natural. Pra forçar agora, invoca cada function manualmente ou roda cron.alter_job(...).",
      };

      await dbsql.end();
      return new Response(JSON.stringify(report), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (e) {
      await dbsql.end().catch(() => {});
      return new Response(JSON.stringify({
        error: "patch_failed",
        details: String(e),
      }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
