/**
 * Cliente tipado da API SpreshApp.
 *
 * Substitui o adapter anterior, que chamava `POST /v1/ads/search` com
 * `{page_id, limit, cursor}`. Esse endpoint não existe: nem o path, nem o
 * corpo, nem o modelo de paginação batiam com a API real. A auditoria está em
 * docs/CREATIVE_INTELLIGENCE_AUDIT.md §2.4.
 *
 * ── O que este cliente garante ────────────────────────────────────────────
 *
 * 1. Nunca gasta mais crédito do que o orçamento permite. O CreditBudget é
 *    consultado ANTES de cada chamada e recusa com 'budget_exceeded' — é uma
 *    recusa nossa, sem tocar na rede. Importa porque 3.000 anúncios custam
 *    ~3.005 créditos e a cota grátis é 100/mês.
 *
 * 2. Nunca loga a chave. O logger recebe só method, path, status, duração,
 *    request-id e custo. `redact()` cobre o caso de uma mensagem de erro do
 *    servidor devolver a chave no corpo.
 *
 * 3. Retry com backoff exponencial + jitter só no que é retentável: 429, 5xx,
 *    timeout e erro de rede. 401/403/404/400 não são retentados — repetir uma
 *    chave inválida não a torna válida, só queima rate limit.
 *
 * 4. Paginação com detecção de ciclo. Um cursor que se repete encerra o laço
 *    em vez de rodar para sempre gastando 1 crédito por anúncio a cada volta.
 *
 * ── Uma limitação da API que vale conhecer ────────────────────────────────
 * Nem `GET /v1/brand/:page_id` nem `POST /v1/ad-search` documentam parâmetro
 * de tamanho de página. O tamanho é decidido pelo servidor. Como o custo é 1
 * crédito por anúncio RETORNADO, não dá para garantir de antemão que uma única
 * chamada custe ≤ N. O que dá para garantir — e o que este cliente faz — é
 * parar de pedir a próxima página assim que o teto for atingido, e nunca
 * iniciar uma chamada cujo pior caso conhecido estoure o orçamento restante.
 * `maxAdsPerPageObserved` registra o tamanho real observado para que a
 * estimativa mostrada ao usuário melhore a cada execução.
 */

import {
  type ActiveStatus,
  type AdSearchParams,
  type BrandAdsParams,
  CREDIT_COST,
  type MediaType,
  type SpreshAd,
  type SpreshAdDetailsResponse,
  type SpreshAdsResponse,
  type SpreshBrandPage,
  SpreshError,
  type SpreshPageSearchResponse,
} from "./types.ts";

// ── Orçamento ────────────────────────────────────────────────────────────────

/**
 * Handle de reserva. Existe para que `settle` e `release` não possam ser
 * chamados duas vezes para a mesma reserva.
 *
 * A versão anterior passava só o número: `release(50)` chamado duas vezes
 * devolvia 100 ao orçamento, comendo a reserva de uma chamada concorrente e
 * deixando o teto abrir mais do que devia. O handle carrega o próprio estado,
 * então a segunda chamada é um no-op.
 */
export interface CreditReservation {
  readonly worstCase: number;
  settled: boolean;
}

/**
 * Contador de créditos com teto rígido. Uma instância por import run.
 *
 * `reserve` é chamado antes da requisição com o custo de PIOR CASO; `settle`
 * ajusta para o custo real depois que a resposta chega. Sem a reserva, uma
 * chamada que devolvesse 80 anúncios estouraria um teto de 50 e só
 * descobriríamos depois de pagar.
 */
export class CreditBudget {
  private spent = 0;
  private reserved = 0;
  private overspend = 0;

  /**
   * `Infinity` é um limite válido e é o padrão do cliente: nem toda chamada
   * acontece dentro de um import run com teto (o brand search inicial, por
   * exemplo, roda antes de existir uma run). O que não é válido é NaN ou
   * negativo — isso seria erro de programação, e falhar cedo é melhor do que
   * um teto silenciosamente quebrado.
   */
  constructor(readonly limit: number) {
    if (Number.isNaN(limit) || limit < 0) {
      throw new Error(`CreditBudget: limite inválido (${limit}). Use um número >= 0 ou Infinity.`);
    }
  }

  get used(): number { return this.spent; }

  /**
   * Quanto passou do teto. Deveria ser sempre 0, mas os endpoints de anúncio
   * da SpreshApp não têm parâmetro de tamanho de página: quem decide quantos
   * anúncios voltam — e portanto quantos créditos são cobrados — é o servidor.
   * Se ele devolver mais do que a reserva previa, o crédito já foi gasto e não
   * há como desfazer. O número existe para que isso apareça no relatório da
   * importação em vez de sumir.
   */
  get overspent(): number { return this.overspend; }

  get available(): number {
    if (this.limit === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.limit - this.spent - this.reserved);
  }

  /** Lança antes de qualquer I/O se o pior caso não couber. */
  reserve(worstCase: number): CreditReservation {
    if (worstCase > this.available) {
      throw new SpreshError(
        "budget_exceeded",
        `Bloqueado antes de chamar a API: a operação pode custar até ${worstCase} créditos ` +
        `e restam ${this.available} do teto de ${this.limit}.`,
      );
    }
    this.reserved += worstCase;
    return { worstCase, settled: false };
  }

  /** Troca a reserva pelo custo real. Chamar duas vezes não faz nada. */
  settle(reservation: CreditReservation, actual: number): void {
    if (reservation.settled) return;
    reservation.settled = true;
    this.reserved = Math.max(0, this.reserved - reservation.worstCase);
    this.spent += actual;
    if (this.limit !== Number.POSITIVE_INFINITY && this.spent > this.limit) {
      this.overspend = this.spent - this.limit;
    }
  }

  /** Devolve a reserva quando a chamada falhou sem retornar dado cobrável. */
  release(reservation: CreditReservation): void {
    if (reservation.settled) return;
    reservation.settled = true;
    this.reserved = Math.max(0, this.reserved - reservation.worstCase);
  }
}

// ── Log ──────────────────────────────────────────────────────────────────────

export interface SpreshLogEntry {
  method: string;
  path: string;
  status?: number;
  durationMs: number;
  attempt: number;
  requestId?: string;
  creditsCharged?: number;
  adsReturned?: number;
  errorCode?: string;
  message?: string;
}

export type SpreshLogger = (entry: SpreshLogEntry) => void;

/** Última linha de defesa: apaga qualquer coisa com cara de chave. */
export function redact(text: string): string {
  return text
    .replace(/sk_sprs_[A-Za-z0-9_\-]+/g, "sk_sprs_***")
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1***");
}

// ── Opções ───────────────────────────────────────────────────────────────────

export interface SpreshClientOptions {
  apiKey: string;
  baseUrl?: string;
  budget?: CreditBudget;
  timeoutMs?: number;
  maxRetries?: number;
  logger?: SpreshLogger;
  /**
   * Pior caso assumido de anúncios por página enquanto não observamos o real.
   * Só suba isto se a API passar a devolver páginas maiores — quanto maior,
   * mais cedo o orçamento bloqueia por precaução.
   */
  assumedPageSize?: number;
  /** injetável para teste */
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULT_BASE_URL = "https://api.spreshapp.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Pior caso assumido para uma página de anúncios enquanto não observamos o
 * tamanho real. A doc não define page size; 50 é conservador o bastante para a
 * reserva não subestimar, e é corrigido pela primeira resposta real.
 */
const ASSUMED_PAGE_SIZE = 50;

export class SpreshClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly logger: SpreshLogger;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  readonly budget: CreditBudget;
  private readonly assumedPageSize: number;
  /** Maior página observada. Melhora a estimativa mostrada ao usuário. */
  maxAdsPerPageObserved = 0;

  constructor(opts: SpreshClientOptions) {
    if (!opts.apiKey) {
      throw new SpreshError("unauthorized", "SPRESHAPP_API_KEY não configurada.");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.budget = opts.budget ?? new CreditBudget(Number.POSITIVE_INFINITY);
    this.assumedPageSize = Math.max(1, opts.assumedPageSize ?? ASSUMED_PAGE_SIZE);
    this.logger = opts.logger ?? (() => {});
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleepImpl = opts.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  // ── Transporte ─────────────────────────────────────────────────────────────

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { query?: Record<string, string | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    }

    let lastError: SpreshError | undefined;

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url.toString(), {
          method,
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Accept": "application/json",
            ...(opts.body ? { "Content-Type": "application/json" } : {}),
          },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const durationMs = Date.now() - startedAt;
        const requestId = response.headers.get("x-request-id") ?? undefined;
        const rawText = await response.text();

        if (response.ok) {
          let parsed: T;
          try {
            parsed = JSON.parse(rawText) as T;
          } catch {
            throw new SpreshError("invalid_response", "SpreshApp devolveu 200 com corpo que não é JSON.", {
              status: response.status,
              requestId,
              detail: redact(rawText).slice(0, 400),
            });
          }
          this.logger({ method, path, status: response.status, durationMs, attempt, requestId });
          return parsed;
        }

        const error = this.toError(response.status, rawText, requestId, response.headers);
        this.logger({
          method, path, status: response.status, durationMs, attempt, requestId,
          errorCode: error.code, message: error.message,
        });

        if (!error.retryable || attempt > this.maxRetries) throw error;
        lastError = error;
        await this.sleepImpl(this.backoffMs(attempt, error.retryAfterMs));
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof SpreshError) {
          if (!err.retryable || attempt > this.maxRetries) throw err;
          lastError = err;
          await this.sleepImpl(this.backoffMs(attempt, err.retryAfterMs));
          continue;
        }

        const isAbort = err instanceof Error && err.name === "AbortError";
        const wrapped = new SpreshError(
          isAbort ? "timeout" : "network",
          isAbort
            ? `Sem resposta em ${this.timeoutMs}ms.`
            : `Falha de rede: ${redact(err instanceof Error ? err.message : String(err))}`,
          { retryable: true },
        );
        this.logger({
          method, path, durationMs: Date.now() - startedAt, attempt,
          errorCode: wrapped.code, message: wrapped.message,
        });

        if (attempt > this.maxRetries) throw wrapped;
        lastError = wrapped;
        await this.sleepImpl(this.backoffMs(attempt, undefined));
      }
    }

    throw lastError ?? new SpreshError("network", "Requisição falhou sem erro identificado.");
  }

  /**
   * 401/403/404/400 não são retentados: o resultado não muda com repetição, e
   * insistir só consome rate limit. 429 e 5xx são.
   */
  private toError(status: number, body: string, requestId: string | undefined, headers: Headers): SpreshError {
    const detail = redact(body).slice(0, 400);
    const retryAfter = headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;

    if (status === 401) {
      return new SpreshError("unauthorized", "Chave da SpreshApp inválida ou ausente.", { status, requestId, detail });
    }
    if (status === 403) {
      return new SpreshError("feature_not_available", "A conta SpreshApp não tem acesso à API.", { status, requestId, detail });
    }
    if (status === 404) {
      return new SpreshError("not_found", "Recurso não encontrado na SpreshApp.", { status, requestId, detail });
    }
    if (status === 429) {
      // A doc usa 429 para duas coisas diferentes. Créditos esgotados não
      // adianta retentar — só no dia 1 do mês seguinte. Rate limit, sim.
      const exhausted = /credits?_exhausted|reset_at/i.test(body);
      return exhausted
        ? new SpreshError("credits_exhausted",
            "Créditos mensais da SpreshApp esgotados. A cota reseta no dia 1.",
            { status, requestId, detail, retryable: false })
        : new SpreshError("rate_limited", "Rate limit da SpreshApp atingido.",
            { status, requestId, detail, retryable: true, retryAfterMs });
    }
    if (status >= 500) {
      return new SpreshError("server_error", `SpreshApp respondeu ${status}.`,
        { status, requestId, detail, retryable: true });
    }
    return new SpreshError("bad_request", `Requisição rejeitada (${status}).`, { status, requestId, detail });
  }

  /** Exponencial com jitter — sem jitter, N workers retentam em uníssono. */
  private backoffMs(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, 60_000);
    const base = Math.min(1000 * 2 ** (attempt - 1), 30_000);
    return Math.round(base * (0.7 + Math.random() * 0.6));
  }

  // ── Endpoints ──────────────────────────────────────────────────────────────

  /** GET /v1/brand/page-search — 5 créditos por chamada, fixo. */
  async searchBrandPages(query: string): Promise<{ pages: SpreshBrandPage[]; creditsSpent: number }> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      throw new SpreshError("bad_request", "A busca de marca exige ao menos 2 caracteres.");
    }

    const cost = CREDIT_COST.pageSearch;
    const reservation = this.budget.reserve(cost);
    try {
      const data = await this.request<SpreshPageSearchResponse>("GET", "/v1/brand/page-search", {
        query: { q: trimmed },
      });
      if (!Array.isArray(data?.pages)) {
        throw new SpreshError("invalid_response", "Resposta de page-search sem o array `pages`.");
      }
      this.budget.settle(reservation, cost);
      this.logger({
        method: "GET", path: "/v1/brand/page-search", durationMs: 0, attempt: 1,
        creditsCharged: cost, adsReturned: 0,
      });
      return { pages: data.pages, creditsSpent: cost };
    } catch (err) {
      // Falha antes de retornar dados não é cobrada — solta a reserva.
      this.budget.release(reservation);
      throw err;
    }
  }

  /** GET /v1/brand/:page_id — 1 crédito por anúncio retornado. */
  async getBrandAdsPage(
    params: BrandAdsParams,
  ): Promise<{ ads: SpreshAd[]; nextCursor: string | null; hasMore: boolean; creditsSpent: number }> {
    const worstCase = Math.max(this.maxAdsPerPageObserved, this.assumedPageSize) * CREDIT_COST.perAd;
    const reservation = this.budget.reserve(worstCase);
    try {
      const data = await this.request<SpreshAdsResponse>("GET", `/v1/brand/${encodeURIComponent(params.page_id)}`, {
        query: {
          sort: params.sort ?? "longest_running",
          display_format: params.display_format ?? "ALL",
          country: params.country ?? "ALL",
          cursor: params.cursor,
        },
      });
      return this.settleAdsPage(data, reservation, `/v1/brand/${params.page_id}`);
    } catch (err) {
      this.budget.release(reservation);
      throw err;
    }
  }

  /** POST /v1/ad-search — 1 crédito por anúncio retornado. */
  async searchAdsPage(
    params: AdSearchParams,
  ): Promise<{ ads: SpreshAd[]; nextCursor: string | null; hasMore: boolean; creditsSpent: number }> {
    const worstCase = Math.max(this.maxAdsPerPageObserved, this.assumedPageSize) * CREDIT_COST.perAd;
    const reservation = this.budget.reserve(worstCase);
    try {
      const data = await this.request<SpreshAdsResponse>("POST", "/v1/ad-search", { body: params });
      return this.settleAdsPage(data, reservation, "/v1/ad-search");
    } catch (err) {
      this.budget.release(reservation);
      throw err;
    }
  }

  private settleAdsPage(data: SpreshAdsResponse, reservation: CreditReservation, path: string) {
    if (!Array.isArray(data?.ads)) {
      this.budget.release(reservation);
      throw new SpreshError("invalid_response", `Resposta de ${path} sem o array \`ads\`.`);
    }
    const ads = data.ads;
    const actual = ads.length * CREDIT_COST.perAd;
    this.budget.settle(reservation, actual);
    this.maxAdsPerPageObserved = Math.max(this.maxAdsPerPageObserved, ads.length);

    const nextCursor = data.next_cursor ?? null;
    // `has_more` só é confiável quando presente; caso contrário, a existência
    // do cursor é o sinal.
    const hasMore = typeof data.has_more === "boolean" ? data.has_more : Boolean(nextCursor);

    this.logger({ method: "GET", path, durationMs: 0, attempt: 1, creditsCharged: actual, adsReturned: ads.length });
    return { ads, nextCursor, hasMore, creditsSpent: actual };
  }

  /** GET /v1/ad-details/:id — 1 crédito quando devolve dados, 0 quando não. */
  async getAdDetails(adArchiveId: string): Promise<{ details: SpreshAdDetailsResponse; creditsSpent: number }> {
    const worstCase = CREDIT_COST.adDetails;
    const reservation = this.budget.reserve(worstCase);
    try {
      const data = await this.request<SpreshAdDetailsResponse>(
        "GET", `/v1/ad-details/${encodeURIComponent(adArchiveId)}`,
      );
      // Fora de regiões com exigência de transparência a resposta vem vazia e
      // não custa nada.
      const returned = data && typeof data === "object" && Object.keys(data).length > 0;
      const actual = returned ? CREDIT_COST.adDetails : 0;
      this.budget.settle(reservation, actual);
      return { details: data ?? {}, creditsSpent: actual };
    } catch (err) {
      this.budget.release(reservation);
      throw err;
    }
  }

  // ── Paginação ──────────────────────────────────────────────────────────────

  /**
   * Percorre páginas até atingir `maxAds`, acabar o orçamento ou não haver mais
   * cursor. Devolve também o cursor onde parou, para retomar depois sem repagar
   * o que já veio.
   *
   * `stopReason` existe para a UI dizer POR QUE parou. "Vieram 20 de 3.000" com
   * motivo 'max_ads' é informação; sem motivo, parece bug.
   */
  async collectBrandAds(params: BrandAdsParams & { maxAds: number }): Promise<{
    ads: SpreshAd[];
    pagesFetched: number;
    creditsSpent: number;
    /** Cursor para retomar. Aponta para a página SEGUINTE à última lida. */
    nextCursor: string | null;
    stopReason: "max_ads" | "no_more_pages" | "budget" | "cursor_loop";
    /** Quantos anúncios além de maxAds vieram — e foram pagos — na última página. */
    overFetched: number;
    /** Quanto o teto foi ultrapassado, se foi. Ver CreditBudget.overspent. */
    overspentCredits: number;
  }> {
    const collected: SpreshAd[] = [];
    const seenCursors = new Set<string>();
    let cursor = params.cursor;
    // Cursor de retomada: separado de `cursor`, que é o da requisição em curso.
    // Usar um pelo outro fazia a retomada recomeçar do zero e repagar tudo.
    let resumeCursor: string | null = null;
    let pagesFetched = 0;
    let creditsSpent = 0;
    let stopReason: "max_ads" | "no_more_pages" | "budget" | "cursor_loop" = "no_more_pages";

    while (collected.length < params.maxAds) {
      const nextPageWorstCase = Math.max(this.maxAdsPerPageObserved, this.assumedPageSize) * CREDIT_COST.perAd;
      if (nextPageWorstCase > this.budget.available) {
        stopReason = "budget";
        break;
      }

      const page = await this.getBrandAdsPage({ ...params, cursor });
      pagesFetched++;
      creditsSpent += page.creditsSpent;
      collected.push(...page.ads);
      resumeCursor = page.hasMore ? (page.nextCursor ?? null) : null;

      if (collected.length >= params.maxAds) { stopReason = "max_ads"; break; }
      if (!page.hasMore || !page.nextCursor) { stopReason = "no_more_pages"; break; }
      // Um cursor repetido significa que a API está em loop. Sem esta checagem
      // o laço rodaria indefinidamente cobrando 1 crédito por anúncio a cada volta.
      if (seenCursors.has(page.nextCursor)) { stopReason = "cursor_loop"; break; }

      seenCursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }

    // Antes isto fazia `collected.slice(0, maxAds)` e jogava fora o excedente.
    // Mas o crédito já foi cobrado por TODO anúncio que a API devolveu — a
    // última página não vem cortada no tamanho que pedimos. Descartar dado pago
    // é a pior das opções: paga-se de novo para reimportar o mesmo anúncio.
    // Devolvemos tudo e reportamos quanto passou, para o import run registrar.
    return {
      ads: collected,
      pagesFetched,
      creditsSpent,
      nextCursor: resumeCursor,
      stopReason,
      overFetched: Math.max(0, collected.length - params.maxAds),
      overspentCredits: this.budget.overspent,
    };
  }

  /**
   * Estimativa mostrada ao usuário ANTES de gastar. Deliberadamente
   * conservadora: melhor prometer 25 e gastar 20 do que o contrário.
   */
  estimateCredits(opts: { includePageSearch: boolean; maxAds: number; adDetails?: number }): {
    min: number; max: number; explanation: string;
  } {
    const search = opts.includePageSearch ? CREDIT_COST.pageSearch : 0;
    const details = (opts.adDetails ?? 0) * CREDIT_COST.adDetails;
    const parts: string[] = [];
    if (search) parts.push(`${search} da busca de marca`);
    parts.push(`até ${opts.maxAds} dos anúncios (1 por anúncio retornado)`);
    if (details) parts.push(`até ${details} de ad-details`);
    return {
      min: search,
      max: search + opts.maxAds * CREDIT_COST.perAd + details,
      explanation: parts.join(" + "),
    };
  }
}

export { CREDIT_COST, SpreshError };
export type { ActiveStatus, MediaType, SpreshAd, SpreshBrandPage };
