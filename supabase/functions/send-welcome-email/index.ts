// Email disabled — AdBrief virou portal interno invite-only, sem
// disparo de email. Stub mantido pra não quebrar callers existentes
// (retorna ok:true,disabled:true). Histórico real está no git se
// precisarmos reativar.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(
    JSON.stringify({ ok: true, disabled: true, reason: "email_pipeline_disabled" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
