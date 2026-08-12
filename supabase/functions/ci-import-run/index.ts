/**
 * ci-import-run — importa os anúncios da página escolhida.
 *
 * É a única função que gasta crédito em volume, então concentra as travas:
 *
 * 1. `dry_run` devolve a estimativa SEM tocar na API. A UI mostra o custo antes
 *    e só chama de verdade depois da confirmação.
 * 2. Os tetos vêm do servidor (SPRESHAPP_MAX_ADS_PER_RUN / _MAX_CREDITS_PER_RUN).
 *    O cliente pode pedir menos, nunca mais — senão o limite seria só uma
 *    sugestão do frontend e um POST direto passaria por cima.
 * 3. O CreditBudget recusa antes de qualquer I/O quando o pior caso não cabe.
 * 4. `next_cursor` fica gravado na run, para continuar depois sem repagar o
 *    que já veio.
 *
 * ── Sobre "não cobrar de novo por anúncio já importado" ───────────────────
 * A API não aceita lista de exclusão: não dá para dizer "traga tudo menos
 * estes 20". O crédito é cobrado por anúncio RETORNADO, então reimportar a
 * mesma página cobra de novo pelos mesmos anúncios. O que dá para fazer — e é
 * o que fazemos — é (a) não duplicar linha no banco, (b) contar quantos já
 * conhecíamos e reportar em `ads_skipped_known`, e (c) guardar o cursor para
 * que continuar de onde parou não repita nada. A UI mostra o número de
 * repetidos para o usuário perceber quando está pagando por nada.
 */
import { CreditBudget, SpreshClient } from "../_shared/spreshapp/client.ts";
import { normalizeAds } from "../_shared/spreshapp/normalize.ts";
import { CREDIT_COST, SpreshError } from "../_shared/spreshapp/types.ts";
import { corsHeaders, fail, json, logEvent, requireCiAccess, serverCaps } from "../_shared/ci-guard.ts";

interface ImportBody {
  brand_id?: string;
  max_ads?: number;
  dry_run?: boolean;
  resume_run_id?: string;
  filters?: {
    display_format?: "ALL" | "VIDEO" | "IMAGE";
    country?: string;
    sort?: "longest_running" | "newest";
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const ctx = await requireCiAccess(req);
  if (ctx instanceof Response) return ctx;
  const { userId, admin } = ctx;

  let body: ImportBody;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "Corpo da requisição precisa ser JSON.");
  }

  if (!body.brand_id) return fail("bad_request", "Informe brand_id.");

  const caps = serverCaps();
  const maxAds = Math.min(
    Math.max(1, Math.floor(body.max_ads ?? caps.maxAds)),
    caps.maxAds,
  );
  const maxCredits = caps.maxCredits;

  const filters = {
    display_format: body.filters?.display_format ?? "VIDEO" as const,
    country: body.filters?.country ?? "US",
    sort: body.filters?.sort ?? "longest_running" as const,
  };

  // ── Marca e página oficial ────────────────────────────────────────────────
  const { data: brand } = await admin
    .from("ci_brands").select("id, name, slug").eq("id", body.brand_id).eq("user_id", userId).maybeSingle();
  if (!brand) return fail("not_found", "Marca não encontrada.", 404);

  const { data: page } = await admin
    .from("ci_brand_pages").select("id, page_id, page_name")
    .eq("brand_id", brand.id).eq("is_selected", true).maybeSingle();
  if (!page) {
    return fail(
      "no_page_selected",
      "Nenhuma página oficial foi selecionada para esta marca. Rode a busca de marca e escolha uma antes de importar.",
      409,
    );
  }

  // Retomada: continua do cursor gravado, sem repetir o que já veio.
  let cursor: string | undefined;
  if (body.resume_run_id) {
    const { data: prev } = await admin
      .from("ci_import_runs").select("next_cursor")
      .eq("id", body.resume_run_id).eq("user_id", userId).maybeSingle();
    cursor = prev?.next_cursor ?? undefined;
    if (!cursor) return fail("cannot_resume", "A execução anterior não deixou cursor — não há de onde continuar.", 409);
  }

  const apiKey = Deno.env.get("SPRESHAPP_API_KEY");
  if (!apiKey) return fail("not_configured", "SPRESHAPP_API_KEY não está configurada nos secrets.", 503);

  const budget = new CreditBudget(maxCredits);
  const client = new SpreshClient({
    apiKey,
    baseUrl: Deno.env.get("SPRESHAPP_BASE_URL") ?? undefined,
    budget,
    logger: (e) => console.log(JSON.stringify({ fn: "ci-import-run", brand: brand.slug, ...e })),
  });

  const estimate = client.estimateCredits({ includePageSearch: false, maxAds });

  // ── Ensaio: mostra o custo sem gastar nada ────────────────────────────────
  if (body.dry_run) {
    const { count: known } = await admin
      .from("ci_ads").select("id", { count: "exact", head: true }).eq("brand_id", brand.id);
    return json({
      dry_run: true,
      brand: { id: brand.id, name: brand.name },
      page: { page_id: page.page_id, page_name: page.page_name },
      filters,
      max_ads: maxAds,
      max_credits: maxCredits,
      estimated_credits: estimate,
      already_imported: known ?? 0,
      // Honestidade sobre o que não conseguimos garantir.
      caveat:
        "Os endpoints de anúncio da SpreshApp não têm parâmetro de tamanho de página: " +
        "quem decide quantos anúncios voltam por chamada é o servidor, e o custo é 1 crédito " +
        "por anúncio retornado. Se uma página vier maior que o teto, o crédito já terá sido " +
        "cobrado — o excedente é registrado em credits_overspent no relatório da execução.",
    });
  }

  // ── Execução ──────────────────────────────────────────────────────────────
  const { data: run, error: runErr } = await admin.from("ci_import_runs").insert({
    brand_id: brand.id,
    user_id: userId,
    brand_page_id: page.id,
    endpoint: "brand_ads",
    filters,
    status: "running",
    max_ads: maxAds,
    max_credits: maxCredits,
    credits_estimated: estimate.max,
    started_at: new Date().toISOString(),
  }).select().single();

  if (runErr || !run) return fail("db_error", `Não foi possível criar a execução: ${runErr?.message}`, 500);

  const finishRun = async (patch: Record<string, unknown>) => {
    await admin.from("ci_import_runs")
      .update({ ...patch, finished_at: new Date().toISOString() }).eq("id", run.id);
  };

  let collected;
  try {
    collected = await client.collectBrandAds({
      page_id: page.page_id,
      display_format: filters.display_format,
      country: filters.country,
      sort: filters.sort,
      cursor,
      maxAds,
    });
  } catch (err) {
    const message = err instanceof SpreshError ? err.message : String(err);
    const code = err instanceof SpreshError ? err.code : "unknown";
    await finishRun({ status: "failed", error: message, credits_spent: budget.used });
    await logEvent(admin, {
      user_id: userId, brand_id: brand.id, job_kind: "import", job_id: run.id,
      level: "error", stage: "fetch", message: `Importação falhou: ${message}`,
      payload: { code, credits_spent: budget.used },
    });
    const status = code === "credits_exhausted" || code === "budget_exceeded" ? 429 : 502;
    return fail(code, message, status, { run_id: run.id, credits_spent: budget.used });
  }

  const { ads: normalized, rejected } = normalizeAds(collected.ads);

  // Quais já conhecíamos. Não evita a cobrança — a API já devolveu e cobrou —
  // mas evita linha duplicada e dá o número que o usuário precisa ver.
  const archiveIds = normalized.map((a) => a.ad_archive_id);
  const { data: existing } = await admin
    .from("ci_ads").select("id, ad_archive_id")
    .eq("brand_id", brand.id).in("ad_archive_id", archiveIds.length ? archiveIds : ["__none__"]);
  const existingByArchive = new Map((existing ?? []).map((r) => [r.ad_archive_id, r.id]));

  const nowIso = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let mediaFound = 0;
  const adIdByArchive = new Map<string, string>();
  const dbErrors: string[] = [];

  for (const ad of normalized) {
    const common = {
      page_id: ad.page_id,
      page_name: ad.page_name,
      page_profile_uri: ad.page_profile_uri,
      body_text: ad.body_text,
      headline: ad.headline,
      description: ad.description,
      cta: ad.cta,
      landing_page: ad.landing_page,
      display_format: ad.display_format,
      media_type: ad.media_type,
      started_on: ad.started_on,
      ended_on: ad.ended_on,
      is_active: ad.is_active,
      running_days: ad.running_days,
      countries: ad.countries,
      languages: ad.languages,
      platforms: ad.platforms,
      raw_payload: ad.raw_payload,
      last_seen_at: nowIso,
    };

    const known = existingByArchive.get(ad.ad_archive_id);
    if (known) {
      // Atualiza só o que muda com o tempo. concept_id e analysis_status são
      // resultado do nosso processamento — reimportar não pode zerar análise
      // que já custou LLM.
      const { error } = await admin.from("ci_ads").update(common).eq("id", known);
      if (error) dbErrors.push(`${ad.ad_archive_id}: ${error.message}`);
      else { updated++; adIdByArchive.set(ad.ad_archive_id, known); }
    } else {
      const { data: inserted, error } = await admin.from("ci_ads").insert({
        brand_id: brand.id,
        user_id: userId,
        import_run_id: run.id,
        ad_archive_id: ad.ad_archive_id,
        ...common,
      }).select("id").single();
      if (error || !inserted) dbErrors.push(`${ad.ad_archive_id}: ${error?.message}`);
      else { created++; adIdByArchive.set(ad.ad_archive_id, inserted.id); }
    }
  }

  // ── Mídias e fila de download ─────────────────────────────────────────────
  const mediaRows = normalized.flatMap((ad) => {
    const adId = adIdByArchive.get(ad.ad_archive_id);
    if (!adId) return [];
    mediaFound += ad.media.length;
    return ad.media.map((m) => ({
      ad_id: adId,
      user_id: userId,
      media_url: m.media_url,
      thumbnail_url: m.thumbnail_url,
      kind: m.kind,
      sort_order: m.sort_order,
    }));
  });

  if (mediaRows.length) {
    const { error } = await admin.from("ci_ad_media_sources")
      .upsert(mediaRows, { onConflict: "ad_id,media_url", ignoreDuplicates: true });
    if (error) dbErrors.push(`mídias: ${error.message}`);
  }

  // Enfileira o download só do que ainda não tem job. O UNIQUE em
  // media_source_id impede duplicar; ignoreDuplicates evita erro no batch.
  const { data: pendingMedia } = await admin
    .from("ci_ad_media_sources")
    .select("id, ad_id")
    .in("ad_id", [...adIdByArchive.values()])
    .eq("status", "pending");

  let queued = 0;
  if (pendingMedia?.length) {
    const { error, count } = await admin.from("ci_download_jobs").upsert(
      pendingMedia.map((m) => ({
        brand_id: brand.id,
        user_id: userId,
        media_source_id: m.id,
        ad_id: m.ad_id,
      })),
      { onConflict: "media_source_id", ignoreDuplicates: true, count: "exact" },
    );
    if (error) dbErrors.push(`fila: ${error.message}`);
    else queued = count ?? pendingMedia.length;
  }

  // "completed" com zero anúncios é indistinguível de "funcionou" para quem lê
  // só o status — e foi assim que a primeira importação real passou
  // despercebida: 200, concluída, nada no banco. Se a API não devolveu nada, a
  // execução não foi concluída com sucesso; ela terminou vazia, e o status
  // precisa dizer isso.
  const status = dbErrors.length
    ? "partial"
    : collected.ads.length === 0
      ? "empty"
      : "completed";
  await finishRun({
    status,
    pages_fetched: collected.pagesFetched,
    ads_returned: collected.ads.length,
    ads_created: created,
    ads_updated: updated,
    ads_skipped_known: existingByArchive.size,
    media_urls_found: mediaFound,
    credits_spent: collected.creditsSpent,
    next_cursor: collected.nextCursor,
    error: dbErrors.length ? dbErrors.slice(0, 5).join(" | ") : null,
  });

  await logEvent(admin, {
    user_id: userId, brand_id: brand.id, job_kind: "import", job_id: run.id,
    level: dbErrors.length ? "warn" : "info", stage: "complete",
    message:
      `Importação: ${collected.ads.length} anúncios (${created} novos, ${updated} atualizados), ` +
      `${collected.creditsSpent} créditos, ${queued} downloads na fila. Parou por ${collected.stopReason}.`,
    payload: {
      stop_reason: collected.stopReason,
      credits_spent: collected.creditsSpent,
      overspent: collected.overspentCredits,
      over_fetched: collected.overFetched,
      rejected: rejected.length,
    },
  });

  return json({
    run_id: run.id,
    status,
    brand: { id: brand.id, name: brand.name },
    page: { page_id: page.page_id, page_name: page.page_name },
    filters,
    pages_fetched: collected.pagesFetched,
    ads_returned: collected.ads.length,
    ads_created: created,
    ads_updated: updated,
    ads_already_known: existingByArchive.size,
    media_urls_found: mediaFound,
    downloads_queued: queued,
    credits_estimated: estimate,
    credits_spent: collected.creditsSpent,
    // Zero na esmagadora maioria das vezes. Quando não for, o usuário precisa
    // ver — é dinheiro que saiu além do teto que ele configurou.
    credits_overspent: collected.overspentCredits,
    over_fetched: collected.overFetched,
    stop_reason: collected.stopReason,
    next_cursor: collected.nextCursor,
    can_resume: Boolean(collected.nextCursor),
    // Nada é descartado em silêncio: itens recusados vêm com o motivo.
    rejected: rejected.slice(0, 20),
    db_errors: dbErrors.slice(0, 5),
  });
});
