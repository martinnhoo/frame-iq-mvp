/**
 * Guarda comum das edge functions do Creative Intelligence.
 *
 * Todas elas precisam da mesma sequência: CORS, verificar o JWT, checar se o
 * e-mail está na lista de acesso, e devolver um client com service role para
 * escrever. Repetir isso em cada função é como uma delas acaba sem a checagem.
 *
 * ── Por que duas instâncias do client ─────────────────────────────────────
 * A verificação de identidade usa a ANON key com o token do usuário: é o
 * caminho que valida a assinatura do JWT de verdade. A escrita usa a SERVICE
 * ROLE, que ignora RLS. Usar a service role para verificar identidade aceitaria
 * qualquer token; usar a anon para escrever esbarraria nas policies, que são
 * SELECT-only de propósito nas tabelas que a importação preenche.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function fail(code: string, message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ error: code, message, ...extra }, status);
}

export interface CiContext {
  userId: string;
  email: string;
  /** service role — ignora RLS. Nunca exposto ao cliente. */
  admin: SupabaseClient;
}

/**
 * Lista de acesso do módulo enquanto ele está em teste fechado.
 * Vazia = liberado para qualquer usuário autenticado.
 */
function allowedEmails(): string[] {
  return (Deno.env.get("CI_ALLOWED_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Devolve o contexto autenticado, ou uma Response de erro pronta para retornar.
 * O chamador faz: `const ctx = await requireCiAccess(req); if (ctx instanceof Response) return ctx;`
 */
export async function requireCiAccess(req: Request): Promise<CiContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return fail("unauthorized", "Faça login para usar o Creative Intelligence.", 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return fail("unauthorized", "Sessão inválida ou expirada.", 401);
  }

  const email = (user.email ?? "").toLowerCase();
  const allow = allowedEmails();
  if (allow.length > 0 && !allow.includes(email)) {
    // 404 e não 403: para quem não tem acesso, o módulo simplesmente não
    // existe. 403 confirmaria que existe algo ali.
    return fail("not_found", "Recurso não encontrado.", 404);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  return { userId: user.id, email, admin };
}

/**
 * Tetos do servidor. O cliente pode pedir MENOS, nunca mais — senão o limite
 * seria só uma sugestão no frontend, e um POST direto passaria por cima.
 */
export function serverCaps(): { maxAds: number; maxCredits: number } {
  const n = (name: string, fallback: number) => {
    const v = Number(Deno.env.get(name));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
  };
  return {
    maxAds: n("SPRESHAPP_MAX_ADS_PER_RUN", 20),
    maxCredits: n("SPRESHAPP_MAX_CREDITS_PER_RUN", 50),
  };
}

/** Grava um evento na trilha de auditoria. Nunca deve derrubar o fluxo. */
export async function logEvent(
  admin: SupabaseClient,
  row: {
    user_id: string;
    brand_id?: string | null;
    job_kind: "download" | "analysis" | "import" | "storage" | "concept";
    job_id?: string | null;
    level?: "debug" | "info" | "warn" | "error";
    stage?: string;
    message: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from("ci_job_events").insert({ level: "info", ...row });
  } catch (_) {
    // Falhar ao logar não pode falhar a importação.
  }
}
