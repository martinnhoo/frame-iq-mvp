/**
 * hubBrands — registro de mercados + tipos de marca do Hub.
 *
 * ⚠️ MARCAS PRÉ-CADASTRADAS FORAM REMOVIDAS (02/08/2026).
 *
 * Antes existiam BETBUS, ELUCK, COME.COM e FUNILIVE hardcoded aqui, com
 * promptHint e logo em /public/brand-logos. Isso não escala pra produto
 * comercial: cada cliente novo exigia um deploy, e as marcas de terceiros
 * ficavam visíveis pra todo mundo.
 *
 * Agora TODA marca é do usuário, vinda de `user_brands` + `brand_assets`:
 *   - nome
 *   - preferências / contexto (campo `notes`) → vira o promptHint
 *   - logo (`logo_url`) → composita no criativo
 *   - assets de referência visual (screenshots, promos) → input do gpt-image-2
 *
 * Carregue com o hook `useUserBrands()` (src/hooks/useUserBrands.ts), que
 * devolve exatamente o shape `HubBrand[]` que as páginas do Hub já consomem.
 *
 * Mercados continuam aqui — são genéricos (idioma + aparência das pessoas),
 * não pertencem a nenhuma marca.
 */

export type MarketCode = "BR" | "MX" | "CO" | "PE" | "US" | "IN";
export type Lang = "pt" | "en" | "es" | "zh";

export interface HubMarket {
  code: MarketCode;
  flag: string;
  labels: Record<Lang, string>;
  /** Contexto adicional injetado no prompt quando esse mercado é selecionado */
  promptContext: string;
}

// Filosofia dos promptContext:
//   - SUBTIL por DEFAULT, não nacionalista. NÃO empurrar bandeiras,
//     símbolos pátrios, traje típico, etc por padrão. Esses clichês
//     deixam o criativo tosco quando aparecem sem pedido.
//   - MAS: o user prompt SEMPRE vence. Se o user explicitamente pedir
//     "com bandeira do México", o AI deve atender. Por isso usamos
//     "Avoid by default... unless the user prompt explicitly requests".
//   - O QUE importa pra cada market: (a) idioma do texto on-image,
//     (b) aparência das pessoas se houver pessoas no criativo.
//   - O resto da estética vem do brand promptHint (cores, vibe), NÃO do
//     market. Brand é forte; market só localiza.
export const HUB_MARKETS: Record<MarketCode, HubMarket> = {
  BR: {
    code: "BR",
    flag: "🇧🇷",
    labels: { pt: "Brasil", en: "Brazil", es: "Brasil", zh: "巴西" },
    promptContext:
      "Target market: Brazil. If people appear, they should reflect the diverse Brazilian " +
      "population (mix of skin tones — afro-Brazilian, multiracial, white, indigenous heritage — " +
      "authentic and modern, not stereotyped). Any on-image text in Brazilian Portuguese. " +
      "By default avoid national flags, carnival imagery, tropical/jungle clichés, and " +
      "nationalistic symbols UNLESS the user prompt explicitly requests them — the user's " +
      "instruction always overrides this default. Otherwise keep the creative modern and " +
      "brand-driven.",
  },
  MX: {
    code: "MX",
    flag: "🇲🇽",
    labels: { pt: "México", en: "Mexico", es: "México", zh: "墨西哥" },
    promptContext:
      "Target market: Mexico. If people appear, they should reflect the Mexican population " +
      "(mestizo, indigenous and afro-mestizo features, varied skin tones — authentic, modern). " +
      "Any on-image text in Mexican Spanish. By default avoid flags, mariachi, sombreros, " +
      "lucha libre, and other national/cultural clichés UNLESS the user prompt explicitly " +
      "requests them — the user's instruction always overrides this default. Otherwise keep " +
      "it modern and brand-driven.",
  },
  CO: {
    code: "CO",
    flag: "🇨🇴",
    labels: { pt: "Colômbia", en: "Colombia", es: "Colombia", zh: "哥伦比亚" },
    promptContext:
      "Target market: Colombia. If people appear, they should reflect the Colombian population " +
      "(mestizo, afro-Colombian, varied features — authentic, modern). Any on-image text in " +
      "Colombian Spanish. By default avoid flags, national symbols, and cultural clichés UNLESS " +
      "the user prompt explicitly requests them — the user's instruction always overrides this " +
      "default. Otherwise keep it modern and brand-driven.",
  },
  PE: {
    code: "PE",
    flag: "🇵🇪",
    labels: { pt: "Peru", en: "Peru", es: "Perú", zh: "秘鲁" },
    promptContext:
      "Target market: Peru. If people appear, they should reflect the Peruvian population " +
      "(predominantly mestizo, Andean indigenous features common — authentic, not exotic or " +
      "touristy). Any on-image text in Peruvian Spanish. By default avoid flags, Andean " +
      "costumes, llamas, Machu Picchu, and cultural clichés UNLESS the user prompt explicitly " +
      "requests them — the user's instruction always overrides this default. Otherwise keep " +
      "it modern and brand-driven.",
  },
  US: {
    code: "US",
    flag: "🇺🇸",
    labels: { pt: "EUA", en: "USA", es: "EE.UU.", zh: "美国" },
    promptContext:
      "Target market: United States. If people appear, they should reflect the diverse US " +
      "population (varied ethnicities, ages — natural and authentic representation). Any " +
      "on-image text in American English. By default avoid flags, eagles, and heavy-handed " +
      "patriotic imagery UNLESS the user prompt explicitly requests them — the user's " +
      "instruction always overrides this default. Otherwise keep it modern and brand-driven.",
  },
  IN: {
    code: "IN",
    flag: "🇮🇳",
    labels: { pt: "Índia", en: "India", es: "India", zh: "印度" },
    promptContext:
      "Target market: India. If people appear, they should reflect the Indian population " +
      "(South Asian features, varied skin tones from light to dark, modern attire — not " +
      "always traditional). Any on-image text MUST be in HINGLISH (Hindi mixed with English " +
      "written in Latin/Roman script — NEVER Devanagari). Examples: 'Aaj hi khelo aur jeeto " +
      "big!', 'Apna luck try karo', 'Bonus milega 100% guaranteed'. By default avoid flags, " +
      "saris, turbans, Taj Mahal, Bollywood dance, mandalas, henna, and cultural clichés " +
      "UNLESS the user prompt explicitly requests them — the user's instruction always " +
      "overrides this default. Otherwise keep it modern and brand-driven.",
  },
};

export interface HubBrand {
  id: string;
  /** Nome da marca. i18nName só é usado pela pseudo-marca "Sem marca". */
  name: string;
  i18nName?: Record<Lang, string>;
  markets: MarketCode[];
  gradient: string;
  logoInitials: string;
  /** URL do logo (Storage). Quando presente, o card mostra a imagem e o
   *  usuário pode ativar "Incluir logo" pra compositar no criativo. */
  logoImage?: string;
  /** Contexto/preferências da marca, escritos pelo usuário. Injetado no prompt. */
  promptHint: string;
  /** Texto legal opcional por mercado (ex.: disclaimer regulatório). */
  license?: Partial<Record<MarketCode, string>>;
}

/** Pseudo-marca sempre disponível. Gerar sem marca é um caso legítimo. */
export const NO_BRAND: HubBrand = {
  id: "none",
  name: "Sem marca",
  i18nName: { pt: "Sem marca", en: "No brand", es: "Sin marca", zh: "无品牌" },
  markets: [],
  gradient: "linear-gradient(135deg, #475569, #1E293B)",
  logoInitials: "—",
  promptHint: "",
};

/**
 * @deprecated Não existem mais marcas globais. Mantido só pra não quebrar
 * imports antigos — contém apenas "Sem marca". Use `useUserBrands()`.
 */
export const HUB_BRANDS: HubBrand[] = [NO_BRAND];

// ── Row do banco → HubBrand ──────────────────────────────────────────────────

export interface UserBrandRow {
  id: string;
  name: string;
  notes: string | null;
  logo_url?: string | null;
  markets?: string[] | null;
  /** Texto legal por mercado: {"BR": "...", "MX": "..."} */
  license?: Record<string, string> | null;
}

/** Gradiente estável derivado do id — mesma marca, mesma cor, sempre. */
function gradientFor(id: string): string {
  const palette = [
    ["#0EA5E9", "#1E40AF"], ["#10B981", "#065F46"], ["#A78BFA", "#5B21B6"],
    ["#F59E0B", "#B45309"], ["#F87171", "#991B1B"], ["#EC4899", "#9D174D"],
    ["#22D3EE", "#0E7490"], ["#FBBF24", "#78350F"],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const [a, b] = palette[h % palette.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const VALID_MARKETS = new Set<string>(["BR", "MX", "CO", "PE", "US", "IN"]);

/** Converte uma linha de `user_brands` no shape que as páginas do Hub usam. */
export function userBrandToHubBrand(row: UserBrandRow): HubBrand {
  return {
    id: row.id,
    name: row.name,
    markets: (row.markets ?? []).filter((m): m is MarketCode => VALID_MARKETS.has(m)),
    gradient: gradientFor(row.id),
    logoInitials: initialsFor(row.name),
    logoImage: row.logo_url || undefined,
    promptHint: (row.notes || "").trim(),
    // Antes o license nunca era preenchido, então `hasLicense` era sempre
    // falso e o disclaimer regulatório jamais aparecia — inclusive para
    // quem precisava dele por lei.
    license: (row.license && Object.keys(row.license).length > 0)
      ? (row.license as Partial<Record<MarketCode, string>>)
      : undefined,
  };
}

// ── Registro ativo de marcas ─────────────────────────────────────────────────
// As marcas do usuário chegam de forma assíncrona (hook `useUserBrands`), mas
// dezenas de call sites chamam `getBrand(id)` sem acesso a estado de React —
// dentro de `useMemo`, de helpers, de renderizadores de lista. Em vez de
// enfiar o pool por props em sete páginas de milhares de linhas, o hook
// publica aqui e `getBrand` lê deste registro por padrão.
//
// Isso é seguro porque o hook faz `setState` junto com a publicação: quando o
// pool muda, o React re-renderiza e a próxima leitura já vê a lista nova.
let BRAND_POOL: HubBrand[] = [NO_BRAND];

/** Chamado pelo `useUserBrands`. Não chame direto de componente. */
export function setBrandPool(pool: HubBrand[]): void {
  BRAND_POOL = pool.length > 0 ? pool : [NO_BRAND];
}

export function getBrandPool(): HubBrand[] {
  return BRAND_POOL;
}

/**
 * Resolve uma marca por id. Usa o registro publicado pelo `useUserBrands`,
 * ou um pool explícito quando você tiver um em mãos.
 */
export function getBrand(
  id: string | null | undefined,
  pool: HubBrand[] = BRAND_POOL,
): HubBrand | null {
  if (!id) return null;
  if (id === "none") return NO_BRAND;
  return pool.find(b => b.id === id) || null;
}

export function getBrandName(brand: HubBrand, lang: Lang): string {
  return brand.i18nName?.[lang] || brand.name;
}

export function getMarketLabel(code: MarketCode, lang: Lang): string {
  return HUB_MARKETS[code]?.labels[lang] || code;
}
