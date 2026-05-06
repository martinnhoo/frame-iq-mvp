// get-workflow-run — endpoint de polling pra status de execução de workflow.
//
// Frontend chama a cada 2-3s enquanto status ∈ {pending, running} pra
// pegar progresso (outputs vão aparecendo conforme níveis completam).
//
// RLS já garante user só vê próprios runs; ainda fazemos eq("user_id")
// como defense-in-depth.

const FN_VERSION = "v1-2026-05-06";

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

console.log(`[get-workflow-run] boot ${FN_VERSION}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(authHeader.slice(7));
    const authUser = userData?.user;
    if (!authUser) return jsonResponse({ _v: FN_VERSION, ok: false, error: "unauthorized" }, 401);

    // Aceita run_id via query string (GET) OU body JSON (POST)
    let runId: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      runId = url.searchParams.get("run_id");
    } else {
      try {
        const body = await req.json();
        runId = body?.run_id || null;
      } catch { /* ignore */ }
    }
    if (!runId) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "missing_run_id" }, 400);
    }

    const { data, error } = await sb
      .from("hub_workflow_runs")
      .select("id, workflow_id, status, inputs, outputs, error, started_at, ended_at, created_at")
      .eq("id", runId)
      .eq("user_id", authUser.id)
      .single();
    if (error || !data) {
      return jsonResponse({ _v: FN_VERSION, ok: false, error: "run_not_found" }, 404);
    }

    // Calcula progress simples (nodes_done / nodes_total). Total não é
    // armazenado diretamente — frontend infere pelo workflow.graph se
    // precisar. Aqui retornamos só o que tem.
    const outputs = (data.outputs || {}) as Record<string, unknown>;
    const errorsRaw = data.error ? safeParseJson(data.error as string) : null;
    const errors = (errorsRaw && typeof errorsRaw === "object") ? errorsRaw as Record<string, string> : null;

    return jsonResponse({
      _v: FN_VERSION,
      ok: true,
      run: {
        id: data.id,
        workflow_id: data.workflow_id,
        status: data.status,
        outputs,
        errors,
        nodes_done: Object.keys(outputs).length,
        nodes_failed: errors ? Object.keys(errors).length : 0,
        started_at: data.started_at,
        ended_at: data.ended_at,
        created_at: data.created_at,
      },
    }, 200);

  } catch (e) {
    console.error("[get-workflow-run] unexpected:", e);
    return jsonResponse({
      _v: FN_VERSION, ok: false, error: "internal_error",
      message: String(e).slice(0, 300),
    }, 500);
  }
});

function safeParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
