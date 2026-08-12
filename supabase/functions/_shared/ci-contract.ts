import type { SpreshAd } from "./spreshapp/types.ts";

export const AD_CONTEXT_HASH_VERSION = "ad-context/v1";
export const ASSET_OBSERVATION_CONTRACT_VERSION = "asset-observation/v1";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizeText(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeText).filter((item): item is string => Boolean(item)))].sort();
}

function normalizeLandingPage(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const withoutFragment = normalized.split("#", 1)[0];
  const queryIndex = withoutFragment.indexOf("?");
  if (queryIndex < 0) return withoutFragment;
  const base = withoutFragment.slice(0, queryIndex);
  const trackingKey = /^(utm_[^=]*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i;
  const query = withoutFragment.slice(queryIndex + 1)
    .split("&")
    .filter(Boolean)
    .filter((part) => !trackingKey.test(part.split("=", 1)[0]))
    .sort()
    .join("&");
  return query ? `${base}?${query}` : base;
}

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stableJson(value: JsonValue): string {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface AdContextInput {
  body_text?: unknown;
  headline?: unknown;
  description?: unknown;
  cta?: unknown;
  landing_page?: unknown;
  display_format?: unknown;
  languages?: unknown;
}

function utf8Hex(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function contextComponent(value: string | null): string {
  return value == null ? "~" : utf8Hex(value);
}

export function canonicalAdContext(input: AdContextInput): string {
  const languages = normalizeStringArray(input.languages);
  return [
    AD_CONTEXT_HASH_VERSION,
    `body_text=${contextComponent(normalizeText(input.body_text))}`,
    `headline=${contextComponent(normalizeText(input.headline))}`,
    `description=${contextComponent(normalizeText(input.description))}`,
    `cta=${contextComponent(normalizeText(input.cta)?.toUpperCase() ?? null)}`,
    `landing_page=${contextComponent(normalizeLandingPage(input.landing_page))}`,
    `display_format=${contextComponent(normalizeText(input.display_format)?.toUpperCase() ?? null)}`,
    `languages=${languages.map((item) => contextComponent(item)).join(",")}`,
  ].join("|");
}

export async function contextHash(input: AdContextInput): Promise<string> {
  return sha256Hex(canonicalAdContext(input));
}

export interface ImportFingerprintInput {
  brand_id: string;
  page_id: string;
  filters: Record<string, JsonValue>;
  max_ads: number;
  cursor?: string | null;
}

export function canonicalImportRequest(input: ImportFingerprintInput): JsonValue {
  return {
    contract_version: "ci-import/v1",
    brand_id: input.brand_id,
    page_id: input.page_id,
    filters: input.filters,
    max_ads: input.max_ads,
    cursor: input.cursor ?? null,
  };
}

export async function importRequestFingerprint(input: ImportFingerprintInput): Promise<string> {
  return sha256Hex(stableJson(canonicalImportRequest(input)));
}

export interface PersistedImportPage {
  page_index: number;
  response_payload: { ads?: SpreshAd[] } & Record<string, unknown>;
}

export function replayAdsFromPages(pages: PersistedImportPage[]): SpreshAd[] {
  return [...pages]
    .sort((left, right) => left.page_index - right.page_index)
    .flatMap((page) => Array.isArray(page.response_payload?.ads) ? page.response_payload.ads : []);
}
