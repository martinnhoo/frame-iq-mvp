/**
 * Normalização SpreshApp → linhas de public.ci_ads e public.ci_ad_media_sources.
 *
 * Regras que governam este arquivo:
 *
 * 1. O payload original é preservado inteiro em raw_payload. Normalizar é uma
 *    interpretação; a interpretação pode estar errada e ser corrigida depois,
 *    mas só se o original ainda estiver lá.
 *
 * 2. Ausência não vira valor inventado. Sem data de início, running_days é
 *    null — não 0. Zero é uma afirmação ("rodou por zero dias"); null é a
 *    verdade ("não sabemos").
 *
 * 3. Nada de spend/impressions aqui. Esses números existem em ci_estimated_metrics,
 *    com fonte e limitação por linha, e nunca em coluna de ci_ads que pudesse
 *    ser lida como performance real.
 */

import type { SpreshAd } from "./types.ts";

export interface NormalizedMedia {
  media_url: string;
  thumbnail_url: string | null;
  kind: "video" | "image";
  sort_order: number;
}

export interface NormalizedAd {
  ad_archive_id: string;
  page_id: string | null;
  page_name: string | null;
  page_profile_uri: string | null;

  body_text: string | null;
  headline: string | null;
  description: string | null;
  cta: string | null;
  landing_page: string | null;

  display_format: string | null;
  media_type: "video" | "image" | "carousel" | "unknown";

  started_on: string | null;   // ISO
  ended_on: string | null;     // ISO
  is_active: boolean | null;
  running_days: number | null;

  countries: string[];
  languages: string[];
  platforms: string[];

  media: NormalizedMedia[];
  raw_payload: SpreshAd;
}

// ── Auxiliares ───────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function arr(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  // Alguns campos chegam como "US,GB" em vez de array.
  return s.includes(",") ? s.split(",").map((x) => x.trim()).filter(Boolean) : [s];
}

/**
 * A doc mostra `ad_started_on: 1714521600` — epoch em SEGUNDOS. Mas o mesmo
 * campo já apareceu como string ISO em respostas reais, e outras APIs da Meta
 * usam milissegundos. Tratar segundos como milissegundos jogaria a data para
 * 1970, e o contrário para o ano 56000 — em ambos os casos, running_days e
 * todos os gráficos de longevidade viram lixo silencioso.
 *
 * O corte em 1e11 separa os dois: qualquer epoch em segundos de uma data real
 * fica abaixo, qualquer epoch em milissegundos fica acima.
 */
export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    const ms = n > 1e11 ? n : n * 1000;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    // Sanidade: a biblioteca de anúncios da Meta não tem nada antes de 2018.
    const year = d.getUTCFullYear();
    if (year < 2015 || year > 2100) return null;
    return d.toISOString();
  }

  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Dias corridos entre início e fim. Sem início, devolve null — e não 0.
 * Anúncio ativo sem data de fim conta até hoje.
 */
export function runningDays(startedIso: string | null, endedIso: string | null, isActive: boolean | null, now = new Date()): number | null {
  if (!startedIso) return null;
  const start = new Date(startedIso).getTime();
  if (Number.isNaN(start)) return null;

  let end: number;
  if (endedIso) {
    end = new Date(endedIso).getTime();
    if (Number.isNaN(end)) end = now.getTime();
  } else if (isActive === false) {
    // Terminou mas não sabemos quando: não dá para afirmar a duração.
    return null;
  } else {
    end = now.getTime();
  }

  if (end < start) return null;
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

function inferMediaType(ad: SpreshAd, media: NormalizedMedia[]): NormalizedAd["media_type"] {
  const declared = str(ad.display_format)?.toUpperCase();
  if (declared === "VIDEO") return "video";
  if (declared === "IMAGE") return "image";
  if (declared === "CAROUSEL" || declared === "DCO") {
    return media.length > 1 ? "carousel" : media[0]?.kind ?? "unknown";
  }
  // Sem formato declarado, o que existe de mídia decide.
  if (media.length > 1) return "carousel";
  if (media.length === 1) return media[0].kind;
  return "unknown";
}

function collectMedia(ad: SpreshAd): NormalizedMedia[] {
  const out: NormalizedMedia[] = [];
  const seen = new Set<string>();
  const thumb = str(ad.video_preview_image_url);

  const push = (url: unknown, kind: "video" | "image", thumbnail: string | null) => {
    const u = str(url);
    // URLs do CDN da Meta são assinadas; a mesma mídia aparece com querystrings
    // diferentes. Deduplicar aqui evita dois jobs para o mesmo arquivo. A
    // deduplicação definitiva é por SHA-256, depois do download.
    if (!u || !/^https?:\/\//i.test(u) || seen.has(u)) return;
    seen.add(u);
    out.push({ media_url: u, thumbnail_url: thumbnail, kind, sort_order: out.length });
  };

  push(ad.video_url, "video", thumb);
  // Só usa image_url como mídia principal quando não há vídeo — no anúncio de
  // vídeo ela é a capa, não o criativo.
  if (out.length === 0) push(ad.image_url, "image", thumb);

  for (const card of ad.cards ?? []) {
    push(card?.video_url, "video", null);
    if (!card?.video_url) push(card?.image_url, "image", null);
  }

  return out;
}

// ── Normalizador ─────────────────────────────────────────────────────────────

export function normalizeAd(ad: SpreshAd, now = new Date()): NormalizedAd {
  const archiveId = str(ad.ad_archive_id);
  if (!archiveId) {
    // Sem identidade estável não há idempotência: reimportar duplicaria a linha
    // e recobraria o crédito. Melhor recusar o item e registrar do que gravar
    // um anúncio que nunca vamos conseguir reconhecer de novo.
    throw new Error("Anúncio sem ad_archive_id — não é possível garantir idempotência.");
  }

  const media = collectMedia(ad);
  const started = toIso(ad.ad_started_on);
  const ended = toIso(ad.ad_ended_on);
  const isActive = typeof ad.is_active === "boolean" ? ad.is_active : null;

  return {
    ad_archive_id: archiveId,
    page_id: str(ad.page_id),
    page_name: str(ad.page_name),
    page_profile_uri: str(ad.page_profile_uri) ?? str(ad.page_profile_picture_url),

    body_text: str(ad.body_text),
    headline: str(ad.title),
    description: str(ad.link_description) ?? str(ad.caption),
    cta: str(ad.cta) ?? str(ad.cta_type),
    landing_page: str(ad.landing_page),

    display_format: str(ad.display_format),
    media_type: inferMediaType(ad, media),

    started_on: started,
    ended_on: ended,
    is_active: isActive,
    running_days: runningDays(started, ended, isActive, now),

    countries: arr(ad.countries),
    languages: arr(ad.languages),
    platforms: arr(ad.publisher_platform),

    media,
    raw_payload: ad,
  };
}

export interface NormalizeBatchResult {
  ads: NormalizedAd[];
  /** Itens recusados, com o motivo. Nunca descartados em silêncio. */
  rejected: Array<{ index: number; reason: string; snippet: string }>;
}

export function normalizeAds(ads: SpreshAd[], now = new Date()): NormalizeBatchResult {
  const out: NormalizedAd[] = [];
  const rejected: NormalizeBatchResult["rejected"] = [];
  const seen = new Set<string>();

  ads.forEach((ad, index) => {
    try {
      const normalized = normalizeAd(ad, now);
      // A API pode repetir o mesmo anúncio entre páginas. Inserir duas vezes
      // bateria no UNIQUE do banco e abortaria o batch inteiro.
      if (seen.has(normalized.ad_archive_id)) {
        rejected.push({ index, reason: "duplicado dentro do mesmo lote", snippet: normalized.ad_archive_id });
        return;
      }
      seen.add(normalized.ad_archive_id);
      out.push(normalized);
    } catch (err) {
      rejected.push({
        index,
        reason: err instanceof Error ? err.message : String(err),
        snippet: JSON.stringify(ad).slice(0, 160),
      });
    }
  });

  return { ads: out, rejected };
}

/** Classifica as páginas do brand search para a UI destacar a provável oficial. */
export function rankBrandPages<T extends { name?: string; verification?: string | null; likes?: number | null }>(
  pages: T[],
  query: string,
): Array<T & { officialScore: number; isLikelyOfficial: boolean }> {
  const q = query.trim().toLowerCase();

  const scored = pages.map((p) => {
    const name = (p.name ?? "").toLowerCase();
    let score = 0;
    // Verificação azul é o sinal mais forte, mas não é prova: revendedores
    // grandes também se verificam. Por isso é score, e não filtro.
    if ((p.verification ?? "").toUpperCase().includes("BLUE")) score += 50;
    if (name === q) score += 30;
    else if (name.startsWith(q)) score += 15;
    const likes = p.likes ?? 0;
    if (likes > 0) score += Math.min(20, Math.log10(likes + 1) * 4);
    return { ...p, officialScore: Math.round(score * 10) / 10 };
  }).sort((a, b) => b.officialScore - a.officialScore);

  // "Inequivocamente oficial" = líder verificado, com folga clara sobre o
  // segundo. Sem folga, quem decide é o usuário — e a UI mostra a lista.
  const [first, second] = scored;
  const unambiguous = Boolean(
    first &&
    (first.verification ?? "").toUpperCase().includes("BLUE") &&
    (!second || first.officialScore - second.officialScore >= 25),
  );

  return scored.map((p, i) => ({ ...p, isLikelyOfficial: unambiguous && i === 0 }));
}
