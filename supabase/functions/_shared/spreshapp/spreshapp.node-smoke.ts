/**
 * Smoke test do cliente SpreshApp e do normalizador.
 *
 * Segue a convenção de supabase/functions/adbrief-ai-chat/detect-signals.node-smoke.ts:
 * os módulos aqui são puros (fetch é injetado), então rodam sob Node sem
 * runtime Deno.
 *
 *   npx tsx supabase/functions/_shared/spreshapp/spreshapp.node-smoke.ts
 *
 * A fixture de page-search é resposta REAL da API (HTTP 200, 06/08/2026), com
 * as querystrings assinadas do CDN da Meta removidas. As fixtures de anúncio
 * são derivadas da documentação oficial mais os casos degenerados que a
 * biblioteca da Meta produz na prática — anúncio sem data, sem mídia, com
 * carrossel, com epoch em milissegundos.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CreditBudget, redact, SpreshClient } from "./client.ts";
import { normalizeAd, normalizeAds, rankBrandPages, runningDays, toIso } from "./normalize.ts";
import { SpreshError } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date("2026-08-06T12:00:00.000Z");

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; console.log("PASS  " + name); })
    .catch((err) => {
      failures.push(name);
      console.log("FAIL  " + name);
      console.log("      " + (err instanceof Error ? err.message : String(err)).split("\n")[0]);
    });
}

/** fetch falso: devolve respostas roteirizadas e conta as chamadas. */
function stubFetch(script: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  let i = 0;
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const step = script[Math.min(i, script.length - 1)];
    i++;
    return new Response(
      typeof step.body === "string" ? step.body : JSON.stringify(step.body),
      { status: step.status, headers: step.headers },
    );
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

const noSleep = async () => {};

async function main() {
  // ══ Normalizador: datas ═══════════════════════════════════════════════════

  await test("epoch em segundos vira ISO correto", () => {
    assert.equal(toIso(1714521600), "2026-05-01T00:00:00.000Z".replace("2026", "2024"));
  });

  await test("epoch em milissegundos não vira ano 56000", () => {
    // Se tratássemos ms como s, a data cairia muito além de 2100 e seria
    // descartada. O corte em 1e11 é o que impede isso.
    const iso = toIso(1714521600000);
    assert.ok(iso, "deveria normalizar epoch em ms");
    assert.equal(new Date(iso!).getUTCFullYear(), 2024);
  });

  await test("data absurda é rejeitada em vez de virar 1970", () => {
    assert.equal(toIso(0), null);
    assert.equal(toIso(-5), null);
    assert.equal(toIso("não é data"), null);
  });

  await test("string ISO passa direto", () => {
    assert.equal(toIso("2026-03-01T00:00:00Z"), "2026-03-01T00:00:00.000Z");
  });

  // ══ Normalizador: running_days ════════════════════════════════════════════

  await test("running_days conta até hoje quando o anúncio está ativo", () => {
    assert.equal(runningDays("2026-08-01T00:00:00Z", null, true, NOW), 6);
  });

  await test("running_days é null sem data de início — não 0", () => {
    // 0 afirmaria "rodou zero dias". null diz "não sabemos". A diferença
    // aparece direto no gráfico de longevidade e no Scale Signal.
    assert.equal(runningDays(null, null, true, NOW), null);
  });

  await test("running_days é null para inativo sem data de fim", () => {
    assert.equal(runningDays("2026-01-01T00:00:00Z", null, false, NOW), null);
  });

  await test("running_days usa a data de fim quando ela existe", () => {
    assert.equal(runningDays("2026-08-01T00:00:00Z", "2026-08-03T00:00:00Z", false, NOW), 3);
  });

  // ══ Normalizador: mídia e formato ═════════════════════════════════════════

  await test("anúncio de vídeo: capa não vira criativo", () => {
    const n = normalizeAd({
      ad_archive_id: "1", display_format: "VIDEO",
      video_url: "https://cdn/a.mp4",
      video_preview_image_url: "https://cdn/a.jpg",
      image_url: "https://cdn/capa.jpg",
    }, NOW);
    assert.equal(n.media.length, 1, "só o vídeo deveria virar mídia baixável");
    assert.equal(n.media[0].kind, "video");
    assert.equal(n.media[0].thumbnail_url, "https://cdn/a.jpg");
    assert.equal(n.media_type, "video");
  });

  await test("carrossel coleta todos os cards em ordem", () => {
    const n = normalizeAd({
      ad_archive_id: "2", display_format: "CAROUSEL",
      cards: [
        { image_url: "https://cdn/1.jpg" },
        { video_url: "https://cdn/2.mp4", image_url: "https://cdn/2.jpg" },
        { image_url: "https://cdn/3.jpg" },
      ],
    }, NOW);
    assert.equal(n.media.length, 3);
    assert.deepEqual(n.media.map((m) => m.kind), ["image", "video", "image"]);
    assert.deepEqual(n.media.map((m) => m.sort_order), [0, 1, 2]);
    assert.equal(n.media_type, "carousel");
  });

  await test("URL repetida no mesmo anúncio não gera dois downloads", () => {
    const n = normalizeAd({
      ad_archive_id: "3", video_url: "https://cdn/x.mp4",
      cards: [{ video_url: "https://cdn/x.mp4" }, { video_url: "https://cdn/y.mp4" }],
    }, NOW);
    assert.equal(n.media.length, 2);
  });

  await test("URL relativa ou lixo é ignorada", () => {
    const n = normalizeAd({ ad_archive_id: "4", video_url: "/relativo.mp4", image_url: "javascript:alert(1)" }, NOW);
    assert.equal(n.media.length, 0);
    assert.equal(n.media_type, "unknown");
  });

  await test("anúncio sem ad_archive_id é recusado, não gravado", () => {
    assert.throws(() => normalizeAd({ ad_archive_id: "" } as never, NOW), /idempot/i);
  });

  await test("payload original é preservado inteiro", () => {
    const raw = { ad_archive_id: "5", campo_desconhecido: { aninhado: true } };
    assert.deepEqual(normalizeAd(raw as never, NOW).raw_payload, raw);
  });

  await test("countries aceita array e string separada por vírgula", () => {
    assert.deepEqual(normalizeAd({ ad_archive_id: "6", countries: ["US", "GB"] }, NOW).countries, ["US", "GB"]);
    assert.deepEqual(normalizeAd({ ad_archive_id: "7", countries: "US,GB" as never }, NOW).countries, ["US", "GB"]);
  });

  // ══ Normalizador: lote ════════════════════════════════════════════════════

  await test("lote separa aceitos de recusados sem descartar em silêncio", () => {
    const r = normalizeAds([
      { ad_archive_id: "a" },
      { ad_archive_id: "" } as never,
      { ad_archive_id: "a" },   // repetido entre páginas
      { ad_archive_id: "b" },
    ], NOW);
    assert.equal(r.ads.length, 2);
    assert.equal(r.rejected.length, 2);
    assert.match(r.rejected[1].reason, /duplicado/);
  });

  // ══ Brand pages: fixture REAL ═════════════════════════════════════════════

  await test("fixture real: Shapermint oficial é identificada sem ambiguidade", () => {
    const fixture = JSON.parse(
      readFileSync(join(HERE, "fixtures", "brand_page-search__shapermint.json"), "utf-8"),
    );
    const ranked = rankBrandPages(fixture.response.pages, "Shapermint");
    assert.equal(ranked[0].page_id, "606426623024865");
    assert.equal(ranked[0].isLikelyOfficial, true);
    // As outras 14 são fakes, revendedores e páginas de comunidade.
    assert.equal(ranked.slice(1).filter((p) => p.isLikelyOfficial).length, 0);
  });

  await test("sem verificação azul, nenhuma página é declarada oficial", () => {
    const ranked = rankBrandPages(
      [{ name: "Marca X", verification: "NOT_VERIFIED", likes: 900000 },
       { name: "Marca X Store", verification: "NOT_VERIFIED", likes: 10 }],
      "Marca X",
    );
    assert.equal(ranked.filter((p) => p.isLikelyOfficial).length, 0,
      "sem sinal forte, quem decide é o usuário");
  });

  // ══ Orçamento de créditos ═════════════════════════════════════════════════

  await test("orçamento recusa ANTES de tocar na rede", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { pages: [] } }]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(3), fetchImpl: impl, sleepImpl: noSleep,
    });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "budget_exceeded");
    assert.equal(calls.length, 0, "não pode haver requisição quando o teto bloqueia");
  });

  await test("page-search cobra exatamente 5 créditos", async () => {
    const { impl } = stubFetch([{ status: 200, body: { pages: [{ page_id: "1", name: "X" }] } }]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.searchBrandPages("Shapermint");
    assert.equal(r.creditsSpent, 5);
    assert.equal(client.budget.used, 5);
  });

  await test("créditos cobrados por anúncio retornado, não por chamada", async () => {
    const ads = Array.from({ length: 12 }, (_, i) => ({ ad_archive_id: `a${i}` }));
    const { impl } = stubFetch([{ status: 200, body: { ads, has_more: false } }]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.getBrandAdsPage({ page_id: "606426623024865" });
    assert.equal(r.creditsSpent, 12);
    assert.equal(client.budget.used, 12);
  });

  await test("falha da API não consome crédito", async () => {
    const { impl } = stubFetch([{ status: 401, body: { error: "Unauthorized" } }]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    await assert.rejects(() => client.searchBrandPages("Shapermint"));
    assert.equal(client.budget.used, 0, "reserva precisa ser liberada quando nada é retornado");
  });

  await test("ad-details fora de região com transparência custa 0", async () => {
    const { impl } = stubFetch([{ status: 200, body: {} }]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.getAdDetails("123");
    assert.equal(r.creditsSpent, 0);
  });

  // ══ Erros e retry ═════════════════════════════════════════════════════════

  await test("401 não é retentado — repetir chave inválida não a valida", async () => {
    const { impl, calls } = stubFetch([{ status: 401, body: { error: "Unauthorized" } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep, maxRetries: 3 });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "unauthorized");
    assert.equal(calls.length, 1);
  });

  await test("403 vira feature_not_available, sem retry", async () => {
    const { impl, calls } = stubFetch([{ status: 403, body: { error: "feature_not_available" } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep, maxRetries: 3 });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "feature_not_available");
    assert.equal(calls.length, 1);
  });

  await test("créditos esgotados não é retentado — só reseta dia 1", async () => {
    const { impl, calls } = stubFetch([{ status: 429, body: { error: "credits_exhausted", reset_at: "2026-09-01" } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep, maxRetries: 3 });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "credits_exhausted");
    assert.equal(calls.length, 1, "retentar não devolve crédito");
  });

  await test("rate limit É retentado", async () => {
    const { impl, calls } = stubFetch([
      { status: 429, body: { error: "too many requests" }, headers: { "retry-after": "0" } },
      { status: 200, body: { pages: [] } },
    ]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep, maxRetries: 3 });
    await client.searchBrandPages("Shapermint");
    assert.equal(calls.length, 2);
  });

  await test("5xx é retentado e desiste no limite", async () => {
    const { impl, calls } = stubFetch([{ status: 503, body: { error: "upstream" } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep, maxRetries: 2 });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "server_error");
    assert.equal(calls.length, 3, "1 tentativa + 2 retries");
  });

  await test("200 com corpo não-JSON vira invalid_response", async () => {
    const { impl } = stubFetch([{ status: 200, body: "<html>manutenção</html>" }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "invalid_response");
  });

  await test("200 sem o array esperado vira invalid_response", async () => {
    const { impl } = stubFetch([{ status: 200, body: { resultado: [] } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep });
    await assert.rejects(() => client.searchBrandPages("Shapermint"), (e: SpreshError) => e.code === "invalid_response");
  });

  // ══ Segredo nunca vaza ════════════════════════════════════════════════════

  await test("chave é redigida em mensagem de erro do servidor", async () => {
    // Valor sintético. Nunca derivar fixture de uma chave real, nem pelo
    // prefixo: os primeiros caracteres já reduzem o espaço de busca de quem
    // encontrar o repositório.
    const key = "sk_sprs_TEST0000000000000000000000000000";
    const { impl } = stubFetch([{ status: 400, body: { error: `token inválido: ${key}` } }]);
    const client = new SpreshClient({ apiKey: key, fetchImpl: impl, sleepImpl: noSleep });
    try {
      await client.searchBrandPages("Shapermint");
      assert.fail("deveria lançar");
    } catch (err) {
      const dump = JSON.stringify({ m: (err as SpreshError).message, d: (err as SpreshError).detail });
      assert.ok(!dump.includes(key), "a chave não pode aparecer no erro");
      assert.ok(dump.includes("sk_sprs_***"));
    }
  });

  await test("logger nunca recebe a chave", async () => {
    const key = "sk_sprs_outraChaveSecreta";
    const entries: unknown[] = [];
    const { impl } = stubFetch([{ status: 500, body: `falhou com ${key}` }]);
    const client = new SpreshClient({
      apiKey: key, fetchImpl: impl, sleepImpl: noSleep, maxRetries: 0,
      logger: (e) => entries.push(e),
    });
    await assert.rejects(() => client.searchBrandPages("Shapermint"));
    assert.ok(!JSON.stringify(entries).includes(key));
  });

  await test("redact cobre Bearer solto", () => {
    assert.equal(redact("Authorization: Bearer abc.def-123"), "Authorization: Bearer ***");
  });

  // ══ Paginação ═════════════════════════════════════════════════════════════

  await test("paginação para no teto de anúncios", async () => {
    const page = (n: number, cursor: string | null) => ({
      status: 200,
      body: { ads: Array.from({ length: n }, (_, i) => ({ ad_archive_id: `${cursor}-${i}` })), next_cursor: cursor, has_more: Boolean(cursor) },
    });
    const { impl, calls } = stubFetch([page(8, "c1"), page(8, "c2"), page(8, "c3")]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(500), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 20 });
    assert.equal(r.stopReason, "max_ads");
    assert.equal(calls.length, 3);
    // 3 páginas de 8 = 24. Os 24 foram COBRADOS, então os 24 são devolvidos.
    // Descartar os 4 excedentes faria pagar de novo para reimportá-los.
    assert.equal(r.ads.length, 24);
    assert.equal(r.overFetched, 4);
    assert.equal(r.creditsSpent, 24);
  });

  await test("cursor repetido encerra o laço em vez de rodar para sempre", async () => {
    const { impl, calls } = stubFetch([
      { status: 200, body: { ads: [{ ad_archive_id: "x" }], next_cursor: "MESMO", has_more: true } },
    ]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(500), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 1000 });
    assert.equal(r.stopReason, "cursor_loop");
    assert.ok(calls.length <= 3, `parou em ${calls.length} chamadas`);
  });

  await test("paginação para quando o orçamento não cobre a próxima página", async () => {
    const { impl } = stubFetch([
      { status: 200, body: { ads: Array.from({ length: 40 }, (_, i) => ({ ad_archive_id: `a${i}` })), next_cursor: "c2", has_more: true } },
    ]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 1000 });
    assert.equal(r.stopReason, "budget");
    assert.ok(client.budget.used <= 50, `gastou ${client.budget.used}, teto 50`);
  });

  // REGRESSÃO — BUG-03. Com o teto padrão de 50 créditos, a segunda página
  // NUNCA era buscada, qualquer que fosse a marca.
  //
  // A causa era `Math.max(observado, assumido)`: a estimativa pessimista de 50
  // sobrevivia à primeira resposta, então mesmo depois de a API dizer "minha
  // página tem 12", o laço reservava 50 para a próxima — e 50 nunca cabia no
  // que sobrava. A execução parava com stopReason "budget" e era reportada
  // como concluída, então o usuário lia "essa marca tem 12 anúncios" quando o
  // certo era "paramos no nosso próprio teto".
  //
  // O teste acima ("orçamento não cobre a próxima página") passava com o bug
  // presente: ele usa páginas de 40, onde o pessimismo e a realidade quase
  // coincidem. O caso que pega é o de página PEQUENA.
  await test("REGRESSÃO: página pequena não é confundida com fim do orçamento", async () => {
    const pagina = (n: number, cursor: string | null) => ({
      status: 200,
      body: {
        ads: Array.from({ length: n }, (_, i) => ({ ad_archive_id: `${cursor}-${i}` })),
        next_cursor: cursor, has_more: cursor !== null,
      },
    });
    // Três páginas de 8 anúncios = 24 no total, 24 créditos. Cabe folgado nos
    // 50 do teto. Com o bug, parava na primeira e devolvia 8.
    const { impl } = stubFetch([pagina(8, "c2"), pagina(8, "c3"), pagina(8, null)]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 20 });

    assert.ok(r.ads.length >= 16,
      `paginou só ${r.ads.length} anúncio(s) — com páginas de 8 e teto de 50, ` +
      `parar na primeira significa que a estimativa pessimista não foi corrigida`);
    assert.notEqual(r.stopReason, "budget",
      "parou por orçamento com 24 créditos usados de um teto de 50");
    assert.ok(client.budget.used <= 50, `gastou ${client.budget.used}, teto 50`);
  });

  // REGRESSÃO — BUG-01. A versão anterior devolvia `null` aqui, porque usava a
  // variável do cursor da requisição em curso em vez do cursor da resposta.
  // Retomar a importação recomeçaria da primeira página e repagaria tudo.
  // O teste que deveria pegar isso era `assert.equal(x, x)` e passava com
  // qualquer valor — por isso o bug sobreviveu à suíte inteira.
  await test("REGRESSÃO: cursor de retomada é o da resposta, não null", async () => {
    const { impl } = stubFetch([
      { status: 200, body: { ads: Array.from({ length: 20 }, (_, i) => ({ ad_archive_id: `a${i}` })), next_cursor: "CURSOR_PAGINA_2", has_more: true } },
    ]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(500), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 20 });
    assert.equal(r.stopReason, "max_ads");
    assert.equal(r.nextCursor, "CURSOR_PAGINA_2");
  });

  await test("sem mais páginas, o cursor de retomada é null", async () => {
    const { impl } = stubFetch([
      { status: 200, body: { ads: [{ ad_archive_id: "a" }], next_cursor: "IGNORAR", has_more: false } },
    ]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(500), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 20 });
    assert.equal(r.stopReason, "no_more_pages");
    assert.equal(r.nextCursor, null, "has_more:false significa fim, mesmo com cursor no corpo");
  });

  // REGRESSÃO — BUG-03. A API não tem parâmetro de tamanho de página, então o
  // servidor pode devolver mais do que a reserva previu e o crédito já sai
  // gasto. Não dá para impedir; dá para não esconder.
  await test("REGRESSÃO: estouro de teto é contabilizado, não silencioso", async () => {
    const { impl } = stubFetch([
      { status: 200, body: { ads: Array.from({ length: 300 }, (_, i) => ({ ad_archive_id: `a${i}` })), has_more: false } },
    ]);
    const client = new SpreshClient({
      apiKey: "sk_sprs_fake", budget: new CreditBudget(50), fetchImpl: impl, sleepImpl: noSleep,
    });
    const r = await client.collectBrandAds({ page_id: "p", maxAds: 20 });
    assert.equal(r.creditsSpent, 300);
    assert.equal(r.overspentCredits, 250, "300 gastos num teto de 50 = 250 de estouro");
    assert.equal(client.budget.overspent, 250);
    // E o orçamento fecha: nenhuma chamada nova passa depois disso.
    assert.equal(client.budget.available, 0);
  });

  await test("release duplo não devolve crédito duas vezes", async () => {
    const budget = new CreditBudget(100);
    const reserva = budget.reserve(40);
    assert.equal(budget.available, 60);
    budget.release(reserva);
    budget.release(reserva);
    assert.equal(budget.available, 100, "a segunda liberação precisa ser no-op");
    // E settle depois de release também não pode cobrar.
    budget.settle(reserva, 40);
    assert.equal(budget.used, 0);
  });

  // ══ Requisição bem formada ════════════════════════════════════════════════

  await test("brand ads monta a URL documentada com os filtros do teste", async () => {
    const { impl, calls } = stubFetch([{ status: 200, body: { ads: [], has_more: false } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep });
    await client.getBrandAdsPage({ page_id: "606426623024865", display_format: "VIDEO", country: "US", sort: "longest_running" });
    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/v1/brand/606426623024865");
    assert.equal(url.searchParams.get("display_format"), "VIDEO");
    assert.equal(url.searchParams.get("country"), "US");
    assert.equal(calls[0].method, "GET");
  });

  await test("ad-search usa POST com corpo JSON — não GET com query", async () => {
    // O adapter antigo fazia POST /v1/ads/search com {page_id, limit}. Nada
    // disso existe. Este teste trava o contrato correto.
    const { impl, calls } = stubFetch([{ status: 200, body: { ads: [] } }]);
    const client = new SpreshClient({ apiKey: "sk_sprs_fake", fetchImpl: impl, sleepImpl: noSleep });
    await client.searchAdsPage({ query: "shapewear", media_type: "VIDEO", countries: ["US"], content_languages: ["en"] });
    assert.equal(new URL(calls[0].url).pathname, "/v1/ad-search");
    assert.equal(calls[0].method, "POST");
    const body = JSON.parse(calls[0].body!);
    assert.equal(body.query, "shapewear");
    assert.deepEqual(body.countries, ["US"]);
    assert.equal(body.limit, undefined, "a API não tem parâmetro limit");
  });

  await test("estimativa é conservadora e explicada", () => {
    const client = new SpreshClient({ apiKey: "sk_sprs_fake" });
    const e = client.estimateCredits({ includePageSearch: true, maxAds: 20 });
    assert.equal(e.min, 5);
    assert.equal(e.max, 25);
    assert.match(e.explanation, /busca de marca/);
  });

  console.log();
  if (failures.length) {
    console.log(`FALHAS (${failures.length}/${passed + failures.length}): ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`TODOS OS ${passed} TESTES PASSARAM`);
}

main();
