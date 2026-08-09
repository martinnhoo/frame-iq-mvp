/**
 * ci-requeue-analysis — recoloca na fila os anúncios analisados com prompt antigo.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * Toda vez que o prompt mudava, eu entregava um SQL para o Martinho colar no
 * Lovable. Isso estava errado por desenho: reanalisar é uma AÇÃO DE PRODUTO,
 * não uma tarefa de banco. Ação de produto é botão.
 *
 * O SQL manual também era perigoso de um jeito silencioso — bastava colar meio
 * bloco, ou colar antes do deploy do worker, para pagar Gemini de novo pelo
 * mesmo resultado errado. Aqui a condição é uma só, escrita uma vez, testada.
 *
 * ── O que garante que não custa caro à toa ────────────────────────────────
 * Só volta para a fila quem NÃO está na versão atual do prompt. Chamar duas
 * vezes seguidas: a segunda não faz nada. `dry_run` responde quantos seriam
 * afetados sem mexer em nada — a UI usa isso para escrever o número no botão
 * antes de o usuário clicar.
 *
 * ── Estágios que voltam ───────────────────────────────────────────────────
 * Só os três finais. Download, cenas, keyframes, transcrição e OCR continuam
 * marcados como concluídos e são pulados pelo checkpoint: os JPEGs são
 * rebaixados do bucket, o Whisper não roda de novo. Reanálise custa Gemini,
 * não custa o pipeline inteiro.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * ⚠ TEM QUE SER IGUAL a PROMPT_VERSION em ci-worker/worker/semantic.py.
 *
 * Duplicar uma constante entre dois runtimes é feio, e a alternativa — o worker
 * publicar a versão numa tabela — é uma indireção a mais para resolver algo que
 * um teste resolve. Existe um teste que lê os dois arquivos e falha se
 * divergirem, então a duplicação é verificada, não confiada.
 */
const PROMPT_VERSION_ATUAL = "semantic/v6";

/** Os estágios refeitos. O resto é pulado pelo checkpoint do worker. */
const ESTAGIOS_A_REFAZER = ["semantic_analysis", "normalization", "persistence"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const comUsuario = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: erroUser } = await comUsuario.auth.getUser();
  if (erroUser || !user) return json({ error: "unauthorized" }, 401);

  let body: { brand_id?: string; dry_run?: boolean; limite?: number };
  try { body = await req.json(); } catch { body = {}; }

  const brandId = body.brand_id;
  if (!brandId) return json({ error: "bad_request", message: "informe brand_id" }, 400);

  const admin = createClient(url, service);

  // A marca é de quem está pedindo? Mesma verificação do ci-sign-media: o id
  // do usuário vem do JWT, nunca do corpo da requisição.
  const { data: marca } = await admin
    .from("ci_brands").select("id,name").eq("id", brandId).eq("user_id", user.id).maybeSingle();
  if (!marca) return json({ error: "forbidden", message: "esta marca não é sua" }, 403);

  // ── Quem está desatualizado ─────────────────────────────────────────────
  // Duas consultas em vez de um join: o PostgREST não faz anti-join de forma
  // legível, e com dezenas de milhares de assets isto ainda é barato porque
  // ambas são filtradas por brand_id com índice.
  const { data: jobs, error: erroJobs } = await admin
    .from("ci_analysis_jobs")
    .select("id,asset_id,completed_stages,status")
    .eq("brand_id", brandId);
  if (erroJobs) return json({ error: "db_error", message: erroJobs.message }, 500);

  const { data: resultados, error: erroRes } = await admin
    .from("ci_analysis_results")
    .select("asset_id,prompt_version")
    .eq("brand_id", brandId)
    .eq("kind", "semantic");
  if (erroRes) return json({ error: "db_error", message: erroRes.message }, 500);

  const naVersaoAtual = new Set(
    (resultados ?? [])
      .filter((r: { prompt_version: string }) => r.prompt_version === PROMPT_VERSION_ATUAL)
      .map((r: { asset_id: string }) => r.asset_id),
  );

  const desatualizados = (jobs ?? []).filter((j: any) =>
    // Já analisado alguma vez...
    (j.completed_stages ?? []).includes("semantic_analysis") &&
    // ...mas não com o prompt atual.
    !naVersaoAtual.has(j.asset_id)
  );

  // ── `limite`: validar barato antes de refazer tudo ──────────────────────
  // O prompt foi de v2 a v6 num dia. Cada versão nasceu de um defeito visto
  // DEPOIS de reanalisar quarenta anúncios — um deploy e uma rodada paga por
  // iteração. Isso não é iterar, é rodar em círculo.
  //
  // Com limite, verificar uma mudança custa o preço de três anúncios. Só
  // depois de olhar o resultado é que se refaz o resto.
  const limite = typeof body.limite === "number" && body.limite > 0
    ? Math.floor(body.limite)
    : null;
  const alvos = limite ? desatualizados.slice(0, limite) : desatualizados;

  // Quem nunca foi analisado não entra na conta de "refazer": ele não está
  // desatualizado, está pendente. Misturar os dois faria o botão prometer um
  // trabalho que a fila já ia fazer sozinha.
  const pendentes = (jobs ?? []).filter((j: any) =>
    !(j.completed_stages ?? []).includes("semantic_analysis") &&
    ["queued", "running", "retrying"].includes(j.status)
  ).length;

  const resposta = {
    versao_atual: PROMPT_VERSION_ATUAL,
    marca: marca.name,
    total_jobs: (jobs ?? []).length,
    ja_na_versao_atual: naVersaoAtual.size,
    // Quantos estão desatualizados no total, e quantos serão feitos AGORA.
    // Mostrar só o recorte esconderia o tamanho do trabalho pendente.
    a_refazer: desatualizados.length,
    sera_feito_agora: alvos.length,
    pendentes_na_fila: pendentes,
  };

  if (body.dry_run) return json({ ...resposta, aplicado: false });
  if (alvos.length === 0) return json({ ...resposta, aplicado: true, atualizados: 0 });

  // ── Recoloca na fila ────────────────────────────────────────────────────
  // Em lotes: um `in` com milhares de uuids estoura o limite da URL do
  // PostgREST, e falhar no meio deixaria metade da fila num estado que ninguém
  // pediu. 200 por vez é conservador e cabe com folga.
  let atualizados = 0;
  const LOTE = 200;
  for (let i = 0; i < alvos.length; i += LOTE) {
    const fatia = alvos.slice(i, i + LOTE);
    for (const job of fatia) {
      const restantes = (job.completed_stages ?? [])
        .filter((e: string) => !ESTAGIOS_A_REFAZER.includes(e));
      const { error } = await admin
        .from("ci_analysis_jobs")
        .update({
          completed_stages: restantes,
          status: "queued", stage: "queued", progress: 0,
          error: null, error_code: null, attempts: 0, next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      if (!error) atualizados++;
    }
  }

  // Acorda a máquina do Fly. Sem isto o usuário clica, vê "40 na fila" e não
  // acontece nada por até dois minutos — e dois minutos de silêncio depois de
  // um clique é indistinguível de botão quebrado.
  try {
    await admin.rpc("ci_wake_worker_tick");
  } catch { /* o cron religa em até 2 min de qualquer forma */ }

  return json({ ...resposta, aplicado: true, atualizados });
});
