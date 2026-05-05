// claim-invite-code — signup gate por código de convite.
//
// Fluxo atômico:
//   1. Recebe { email, password, name, code }
//   2. Tenta marcar o código como reclamado (UPDATE ... WHERE used_by IS NULL)
//      — se 0 linhas atualizadas, código inválido ou já usado, retorna 400
//   3. Cria usuário via admin.createUser (email_confirm = true; convite
//      implica trust, não precisa de double opt-in)
//   4. Se criação falhar, rollback do código (libera de novo)
//   5. Atualiza invite_codes.used_by com o user_id real
//
// Frontend (Signup.tsx) chama esta function ao invés de auth.signUp
// direto. Sem código válido, conta não é criada.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Placeholder usado pra "lock" o código atomicamente antes de criar o
// user. Se a criação falhar, revertemos. Se der certo, atualizamos com
// o uuid real do user.
const LOCK_UUID = "00000000-0000-0000-0000-000000000001";

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

    // 1) Reivindica o código atomicamente. Se 0 linhas atualizadas,
    //    código inválido ou já consumido — abortar antes de criar user.
    const { data: claimed, error: claimErr } = await admin
      .from("invite_codes")
      .update({ used_by: LOCK_UUID, used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_by", null)
      .select("code")
      .maybeSingle();

    if (claimErr) {
      console.error("[claim-invite] update error:", claimErr);
      return json({ error: "claim_failed", message: "Erro ao validar código." }, 500);
    }
    if (!claimed) {
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
      // Rollback: libera o código de novo.
      await admin
        .from("invite_codes")
        .update({ used_by: null, used_at: null })
        .eq("code", code);

      const msg = createErr?.message || "Falha ao criar conta.";
      const isDup = /already (registered|exists)/i.test(msg);
      return json(
        { error: isDup ? "email_taken" : "create_failed", message: isDup ? "Este email já está cadastrado." : msg },
        isDup ? 409 : 500
      );
    }

    // 3) Atualiza o claim com o user_id real.
    await admin
      .from("invite_codes")
      .update({ used_by: created.user.id })
      .eq("code", code);

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
