/**
 * ci-brand-search — encontra as páginas do Facebook de uma marca.
 *
 * Primeiro passo do fluxo. Custa 5 créditos FIXOS por chamada, independente de
 * quantas páginas voltam — então não há teto por resultado aqui, só o do
 * orçamento geral.
 *
 * ── Por que o usuário escolhe a página ────────────────────────────────────
 * "Shapermint" devolveu 15 páginas: a oficial (BLUE_VERIFIED, 582 mil curtidas),
 * duas homônimas com 60 curtidas, três revendedores paquistaneses e páginas de
 * comunidade. Importar da errada gastaria crédito para trazer o catálogo de um
 * revendedor. O ranking sugere, o usuário confirma — e só quando a líder é
 * verificada E abre folga clara sobre a segunda é que marcamos
 * `is_likely_official`.
 *
 * Não seleciona nada sozinho: a seleção é um POST separado, deliberado.
 */
import { SpreshClient } from "../_shared/spreshapp/client.ts";
import { rankBrandPages } from "../_shared/spreshapp/normalize.ts";
import { SpreshError } from "../_shared/spreshapp/types.ts";
import { corsHeaders, fail, json, logEvent, requireCiAccess } from "../_shared/ci-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const ctx = await requireCiAccess(req);
  if (ctx instanceof Response) return ctx;
  const { userId, admin } = ctx;

  let body: { query?: string; brand_slug?: string; select_page_id?: string; brand_id?: string };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "Corpo da requisição precisa ser JSON.");
  }

  // ── Modo seleção: o usuário escolheu qual página é a oficial ──────────────
  // Não gasta crédito. É só marcar a escolha; o índice único parcial
  // uq_ci_brand_pages_one_selected garante que só uma fique marcada.
  if (body.select_page_id && body.brand_id) {
    const { data: brand } = await admin
      .from("ci_brands").select("id").eq("id", body.brand_id).eq("user_id", userId).maybeSingle();
    if (!brand) return fail("not_found", "Marca não encontrada.", 404);

    await admin.from("ci_brand_pages")
      .update({ is_selected: false }).eq("brand_id", body.brand_id).eq("is_selected", true);

    const { data: selected, error } = await admin.from("ci_brand_pages")
      .update({ is_selected: true })
      .eq("brand_id", body.brand_id).eq("page_id", body.select_page_id)
      .select().maybeSingle();

    if (error || !selected) return fail("not_found", "Página não encontrada para esta marca.", 404);

    await logEvent(admin, {
      user_id: userId, brand_id: body.brand_id, job_kind: "import", stage: "page_selected",
      message: `Página oficial definida: ${selected.page_name} (${selected.page_id})`,
      payload: { page_id: selected.page_id, page_name: selected.page_name },
    });

    return json({ ok: true, selected_page: selected });
  }

  // ── Modo busca ────────────────────────────────────────────────────────────
  const query = (body.query ?? "").trim();
  if (query.length < 2) {
    return fail("bad_request", "Informe ao menos 2 caracteres para buscar a marca.");
  }

  const apiKey = Deno.env.get("SPRESHAPP_API_KEY");
  if (!apiKey) {
    return fail("not_configured", "SPRESHAPP_API_KEY não está configurada nos secrets.", 503);
  }

  const client = new SpreshClient({
    apiKey,
    baseUrl: Deno.env.get("SPRESHAPP_BASE_URL") ?? undefined,
    // Log estruturado sem segredo — o redact do cliente já cobre o corpo,
    // e aqui nunca passamos a chave adiante.
    logger: (e) => console.log(JSON.stringify({ fn: "ci-brand-search", ...e })),
  });

  let pages;
  let creditsSpent = 0;
  try {
    const result = await client.searchBrandPages(query);
    pages = result.pages;
    creditsSpent = result.creditsSpent;
  } catch (err) {
    if (err instanceof SpreshError) {
      const status = err.code === "credits_exhausted" ? 429
        : err.code === "unauthorized" || err.code === "feature_not_available" ? 502
        : err.retryable ? 503 : 400;
      await logEvent(admin, {
        user_id: userId, job_kind: "import", level: "error", stage: "brand_search",
        message: `Busca de marca falhou: ${err.message}`,
        payload: { code: err.code, status: err.status, request_id: err.requestId },
      });
      return fail(err.code, err.message, status, { retryable: err.retryable });
    }
    throw err;
  }

  const ranked = rankBrandPages(pages, query);

  // A marca é criada agora, na primeira busca, com o dono certo. Seed cego numa
  // migration criaria linha órfã sem user_id.
  const slug = (body.brand_slug ?? query).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: brand, error: brandErr } = await admin
    .from("ci_brands")
    .upsert({ user_id: userId, slug, name: query }, { onConflict: "user_id,slug" })
    .select().single();

  if (brandErr || !brand) {
    return fail("db_error", `Não foi possível registrar a marca: ${brandErr?.message}`, 500);
  }

  // Guarda TODAS as páginas, não só a provável oficial. Se o ranking errar, o
  // usuário precisa ver as alternativas sem pagar outros 5 créditos.
  const rows = ranked.map((p) => ({
    brand_id: brand.id,
    user_id: userId,
    page_id: String(p.page_id),
    page_name: String(p.name ?? "sem nome"),
    category: p.category ?? null,
    likes: p.likes ?? null,
    verification: p.verification ?? null,
    ig_username: p.ig_username ?? null,
    ig_followers: p.ig_followers ?? null,
    page_alias: p.page_alias ?? null,
    image_uri: p.image_uri ?? null,
    raw_payload: p,
  }));

  const { error: pagesErr } = await admin
    .from("ci_brand_pages").upsert(rows, { onConflict: "brand_id,page_id" });
  if (pagesErr) {
    return fail("db_error", `Não foi possível salvar as páginas: ${pagesErr.message}`, 500);
  }

  await logEvent(admin, {
    user_id: userId, brand_id: brand.id, job_kind: "import", stage: "brand_search",
    message: `Busca por "${query}" devolveu ${ranked.length} páginas (${creditsSpent} créditos).`,
    payload: { query, pages: ranked.length, credits_spent: creditsSpent },
  });

  const likely = ranked.find((p) => p.isLikelyOfficial);

  return json({
    brand: { id: brand.id, slug: brand.slug, name: brand.name },
    pages: ranked.map((p) => ({
      page_id: p.page_id,
      name: p.name,
      category: p.category ?? null,
      likes: p.likes ?? null,
      verification: p.verification ?? null,
      ig_username: p.ig_username ?? null,
      ig_followers: p.ig_followers ?? null,
      image_uri: p.image_uri ?? null,
      official_score: p.officialScore,
      is_likely_official: p.isLikelyOfficial,
    })),
    // A UI usa isto para decidir entre "selecionamos esta, confirma?" e
    // "escolha uma destas". Sem folga clara, quem decide é o usuário.
    likely_official_page_id: likely?.page_id ?? null,
    requires_manual_choice: !likely,
    credits_spent: creditsSpent,
  });
});
