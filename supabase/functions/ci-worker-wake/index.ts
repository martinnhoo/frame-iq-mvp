/**
 * ci-worker-wake — liga a máquina do Fly quando há trabalho na fila.
 *
 * ── O problema que isto resolve ──────────────────────────────────────────
 * O worker não atende requisição: ele lê a fila do Postgres. Quando o Fly
 * desliga a máquina — por ociosidade, por deploy, por reciclagem do host —
 * nada a religa, e os jobs ficam parados com a tela dizendo "na fila" sem sair
 * do lugar. Em 07/08 isso aconteceu seis vezes num dia, e todas as vezes a
 * solução foi um humano rodar `fly machine start` na mão.
 *
 * Um sistema que depende de alguém olhando não está pronto.
 *
 * ── Como é chamada ───────────────────────────────────────────────────────
 * Por pg_cron, a cada 2 minutos, via pg_net. Autentica pelo mesmo segredo
 * compartilhado do ci-worker-write — um segredo a menos para girar depois.
 *
 * ── Por que ela consulta a fila antes de ligar ───────────────────────────
 * Ligar a máquina a cada 2 minutos custaria dinheiro 24 horas por dia. A
 * função só liga quando existe job esperando de verdade, e devolve o que viu
 * para o log do cron poder ser lido depois.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ci-worker-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Comparação em tempo constante: evita distinguir segredos por tempo de resposta. */
function segredoConfere(recebido: string, esperado: string): boolean {
  if (!esperado || recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const esperado = Deno.env.get("CI_WORKER_SECRET") ?? "";
  const recebido = req.headers.get("x-ci-worker-secret") ?? "";
  if (!esperado) return json({ error: "not_configured", message: "CI_WORKER_SECRET ausente" }, 503);
  if (!segredoConfere(recebido, esperado)) return json({ error: "unauthorized" }, 401);

  const flyToken = Deno.env.get("FLY_API_TOKEN") ?? "";
  const flyApp = Deno.env.get("FLY_APP_NAME") ?? "adbrief-ci-worker";
  if (!flyToken) {
    return json({ error: "not_configured", message: "FLY_API_TOKEN ausente nos secrets" }, 503);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ── Há trabalho? ─────────────────────────────────────────────────────────
  // 'retrying' entra na conta: é job esperando o backoff vencer, e sem a
  // máquina de pé ele nunca vence de verdade — a espera passa, mas ninguém
  // pega. Ignorá-lo faria a fila travar no caso mais comum, que é depois de
  // uma queda.
  const pendentes = ["queued", "retrying", "running"];
  const [dl, an] = await Promise.all([
    admin.from("ci_download_jobs").select("id", { count: "exact", head: true }).in("status", pendentes),
    admin.from("ci_analysis_jobs").select("id", { count: "exact", head: true }).in("status", pendentes),
  ]);
  const fila = (dl.count ?? 0) + (an.count ?? 0);

  if (fila === 0) {
    // Sem trabalho, não liga. Máquina parada não custa nada, e o objetivo aqui
    // nunca foi mantê-la de pé — foi não deixar job esperando humano.
    return json({ ok: true, fila: 0, acao: "nada_a_fazer" });
  }

  // ── Estado das máquinas ──────────────────────────────────────────────────
  const flyBase = `https://api.machines.dev/v1/apps/${encodeURIComponent(flyApp)}/machines`;
  const cabecalho = { Authorization: `Bearer ${flyToken}`, "Content-Type": "application/json" };

  const lista = await fetch(flyBase, { headers: cabecalho });
  if (!lista.ok) {
    const corpo = await lista.text();
    return json({
      error: "fly_error", status: lista.status,
      // O corpo pode conter detalhe da conta; 300 caracteres bastam para
      // diagnosticar sem despejar mais do que o necessário no log do cron.
      message: corpo.slice(0, 300),
    }, 502);
  }

  const maquinas: Array<{ id: string; state: string }> = await lista.json();
  const paradas = maquinas.filter((m) => m.state !== "started" && m.state !== "starting");

  if (paradas.length === 0) {
    return json({ ok: true, fila, acao: "ja_rodando", maquinas: maquinas.length });
  }

  // ── Liga ─────────────────────────────────────────────────────────────────
  const ligadas: string[] = [];
  const falhas: Array<{ id: string; status: number }> = [];
  for (const m of paradas) {
    const r = await fetch(`${flyBase}/${m.id}/start`, { method: "POST", headers: cabecalho });
    if (r.ok) ligadas.push(m.id);
    else falhas.push({ id: m.id, status: r.status });
  }

  // Sem gravar em ci_job_events de propósito: aquela tabela exige user_id e
  // só aceita job_kind de job real. Este evento não pertence a nenhum usuário
  // nem a nenhum job — é do sistema. Distorcer o schema para caber seria pior
  // que não registrar, e o pg_cron já guarda o retorno em cron.job_run_details.
  return json({ ok: falhas.length === 0, fila, acao: "ligou", ligadas, falhas });
});
