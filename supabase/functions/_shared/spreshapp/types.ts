/**
 * Tipos da API pública do SpreshApp.
 *
 * Fonte: https://spreshapp.com/docs/api, conferida contra resposta real de
 * GET /v1/brand/page-search?q=Shapermint em 06/08/2026 (HTTP 200).
 *
 * ── Por que os campos de ad são quase todos opcionais ──────────────────────
 * A doc mostra um exemplo de resposta, não um schema. A biblioteca da Meta
 * devolve conjuntos de campos diferentes por tipo de anúncio, por país e por
 * época — um anúncio de imagem não traz video_url, um anúncio fora da UE não
 * traz dado de transparência. Tipar tudo como obrigatório produziria um
 * cliente que compila e quebra em produção. Aqui, o normalizador é que decide
 * o que fazer com a ausência, e ele é testado contra os casos degenerados.
 *
 * Campos desconhecidos são preservados via índice `[k: string]: unknown` e
 * gravados inteiros em ci_ads.raw_payload. Se o SpreshApp adicionar algo
 * amanhã, não perdemos o dado só porque não estava no tipo.
 */

// ── Marcas ───────────────────────────────────────────────────────────────────

export interface SpreshBrandPage {
  page_id: string;
  name: string;
  category?: string | null;
  likes?: number | null;
  /** 'BLUE_VERIFIED' | 'NOT_VERIFIED' | outros que a Meta introduzir */
  verification?: string | null;
  image_uri?: string | null;
  ig_username?: string | null;
  ig_followers?: number | null;
  page_alias?: string | null;
  [k: string]: unknown;
}

export interface SpreshPageSearchResponse {
  pages: SpreshBrandPage[];
  [k: string]: unknown;
}

// ── Anúncios ─────────────────────────────────────────────────────────────────

export interface SpreshAd {
  ad_archive_id: string;
  page_id?: string | null;
  page_name?: string | null;
  page_profile_uri?: string | null;
  page_profile_picture_url?: string | null;

  body_text?: string | null;
  title?: string | null;
  caption?: string | null;
  link_description?: string | null;
  cta?: string | null;
  cta_type?: string | null;
  landing_page?: string | null;

  /** 'VIDEO' | 'IMAGE' | 'DCO' | 'CAROUSEL' | ... */
  display_format?: string | null;

  /** epoch em SEGUNDOS na doc — não milissegundos. Ver normalize.ts. */
  ad_started_on?: number | string | null;
  ad_ended_on?: number | string | null;
  is_active?: boolean | null;

  video_url?: string | null;
  video_preview_image_url?: string | null;
  image_url?: string | null;
  /** carrosséis */
  cards?: Array<{
    video_url?: string | null;
    image_url?: string | null;
    title?: string | null;
    body?: string | null;
    link_url?: string | null;
    [k: string]: unknown;
  }> | null;

  countries?: string[] | string | null;
  languages?: string[] | string | null;
  publisher_platform?: string[] | string | null;

  [k: string]: unknown;
}

export interface SpreshAdsResponse {
  ads: SpreshAd[];
  next_cursor?: string | null;
  has_more?: boolean | null;
  [k: string]: unknown;
}

/**
 * Transparência DSA. A chave do objeto é o próprio ad_archive_id — a resposta
 * é um mapa, não um objeto plano.
 */
export interface SpreshAdDetails {
  total_reach?: number | null;
  age_gender_breakdown?: Array<{
    age_range: string;
    male?: number | null;
    female?: number | null;
    unknown?: number | null;
  }> | null;
  country_ratio?: Record<string, number> | null;
  gender_audience?: string | null;
  estimated_spend_usd?: number | null;
  [k: string]: unknown;
}

export type SpreshAdDetailsResponse = Record<string, SpreshAdDetails>;

// ── Parâmetros ───────────────────────────────────────────────────────────────

export type ActiveStatus = "ACTIVE" | "INACTIVE" | "ALL";
export type MediaType = "ALL" | "VIDEO" | "IMAGE";
export type BrandSort = "longest_running" | "newest";

export interface AdSearchParams {
  query: string;
  active_status?: ActiveStatus;
  media_type?: MediaType;
  countries?: string[];
  content_languages?: string[];
  page_ids?: string[];
  sort_data?: {
    mode: "SORT_BY_RELEVANCY_MONTHLY_GROUPED" | "SORT_BY_TOTAL_IMPRESSIONS";
    direction: "DESCENDING" | "ASCENDING";
  };
  start_date?: { min: string; max: string | null };
  cursor?: string;
}

export interface BrandAdsParams {
  page_id: string;
  sort?: BrandSort;
  display_format?: MediaType;
  /** ISO separados por vírgula, ou 'ALL' */
  country?: string;
  cursor?: string;
}

// ── Custos ───────────────────────────────────────────────────────────────────

/**
 * Tabela oficial de custo. Fica em código, e não só na doc, porque o teto de
 * créditos é verificado ANTES de cada chamada — o número precisa estar aqui
 * para o cálculo acontecer.
 */
export const CREDIT_COST = {
  /** por chamada, independente de quantas páginas voltam */
  pageSearch: 5,
  /** por ANÚNCIO retornado — não por chamada */
  perAd: 1,
  /** por ad-details que retorna dados; 0 quando a região não tem transparência */
  adDetails: 1,
} as const;

// ── Erros ────────────────────────────────────────────────────────────────────

export type SpreshErrorCode =
  | "unauthorized"          // 401 — chave inválida ou ausente
  | "feature_not_available" // 403 — conta sem acesso à API
  | "not_found"             // 404
  | "credits_exhausted"     // 429 — cota do mês acabou
  | "rate_limited"          // 429 com Retry-After
  | "bad_request"           // 400
  | "server_error"          // 5xx
  | "timeout"
  | "network"
  | "invalid_response"      // 200 com corpo que não bate com o schema
  | "budget_exceeded";      // recusa NOSSA, antes de gastar

export class SpreshError extends Error {
  readonly code: SpreshErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly requestId?: string;
  /** Corpo truncado, para diagnóstico. Nunca contém a chave. */
  readonly detail?: string;

  constructor(
    code: SpreshErrorCode,
    message: string,
    opts: {
      status?: number;
      retryable?: boolean;
      retryAfterMs?: number;
      requestId?: string;
      detail?: string;
    } = {},
  ) {
    super(message);
    this.name = "SpreshError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
    this.requestId = opts.requestId;
    this.detail = opts.detail;
  }
}
