// claim-invite-code — signup gate por código de convite.
//
// Fluxo (ordem invertida vs versão original):
//   1. Recebe { email, password, name, code }
//   2. Verifica se o código existe e está livre (SELECT) — fail-fast
//   3. Cria usuário via admin.createUser (email_confirm = true)
//   4. Reclama o código com o user_id REAL (UPDATE ... WHERE code AND used_by IS NULL)
//   5. Se UPDATE atualizou 0 linhas (race: outro user pegou primeiro),
//      deleta o user recém-criado e retorna invalid_code
//
// Por que invertemos a ordem? A versão anterior tentava "lockar" o código
// com um LOCK_UUID placeholder (00000000-...-001) antes de criar o user.
// Mas a coluna invite_codes.used_by tem FK pra auth.users(id) — o UUID
// fake não existia → FK violation → todos os signups falhavam com
// claim_failed. Agora usamos o user_id real direto, que sempre satisfaz
// a FK. A janela de race é mínima (entre createUser e UPDATE) e
// aceitável pra invite-only com 10 códigos.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  email?: string;
  password?: string;
  name?: string;
  code?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "server_misconfigured" }, 503);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const name = (body.name || "").trim();
    const code = (body.code || "").trim().toUpperCase();

    if (!email || !password || !name || !code) {
      return json({ error: "missing_fields", message: "email, password, name e code são obrigatórios." }, 400);
    }
    if (password.length < 8) {
      return json({ error: "weak_password", message: "Senha deve ter ao menos 8 caracteres." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Pre-check: código existe e está livre? Falha rápida sem criar user.
    const { data: codeRow, error: lookupErr } = await admin
      .from("invite_codes")
      .select("code, used_by")
      .eq("code", code)
      .maybeSingle();

    if (lookupErr) {
      console.error("[claim-invite] lookup error:", lookupErr);
      return json({ error: "lookup_failed", message: "Erro ao validar código." }, 500);
    }
    if (!codeRow) {
      return json({ error: "invalid_code", message: "Código de convite inválido ou já utilizado." }, 400);
    }
    if (codeRow.used_by) {
      return json({ error: "invalid_code", message: "Código de convite inválido ou já utilizado." }, 400);
    }

    // 2) Cria o user via admin API. email_confirm=true porque convite
    //    é prova suficiente de identidade — não precisa double opt-in.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, invite_code: code },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message || "Falha ao criar conta.";
      const isDup = /already (registered|exists)/i.test(msg);
      return json(
        { error: isDup ? "email_taken" : "create_failed", message: isDup ? "Este email já está cadastrado." : msg },
        isDup ? 409 : 500
      );
    }

    // 3) Reclama o código com user_id REAL. UPDATE ... WHERE used_by IS NULL
    //    é atômico — se outro request ganhou a corrida, retorna 0 linhas.
    const { data: claimed, error: claimErr } = await admin
      .from("invite_codes")
      .update({ used_by: created.user.id, used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_by", null)
      .select("code")
      .maybeSingle();

    if (claimErr || !claimed) {
      // Race lost ou erro inesperado — desfaz o user pra não deixar órfão.
      console.error("[claim-invite] claim race lost or error:", claimErr);
      try {
        await admin.auth.admin.deleteUser(created.user.id);
      } catch (delErr) {
        console.error("[claim-invite] failed to rollback user:", delErr);
      }
      return json(
        { error: "invalid_code", message: "Código de convite inválido ou já utilizado." },
        400,
      );
    }

    return json({ ok: true, user_id: created.user.id }, 200);
  } catch (e) {
    console.error("[claim-invite] unexpected:", e);
    return json({ error: "unexpected", message: String(e) }, 500);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
