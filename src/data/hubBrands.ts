/**
 * hubBrands — registro de marcas e mercados do Brilliant Hub.
 *
 * Marca pode operar em múltiplos mercados. Cada marca tem:
 *   - markets: lista de códigos de mercado (1+); primeiro = default
 *   - promptHint: base brand context; injetado em todo prompt
 *   - license: optional Record<market, text>; license só pra marcas
 *     reguladas em mercado específico (hoje só BETBUS-MX)
 *
 * Mercados:
 *   - BR: Brasil
 *   - MX: México
 *   - CO: Colômbia
 *   - PE: Peru
 *   - US: EUA
 *   - IN: Índia (Hinglish — mistura Hindi + English em script latino)
 *
 * Para adicionar marca nova: append em HUB_BRANDS. Para adicionar
 * mercado novo: append em HUB_MARKETS + label nos 4 idiomas.
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
//   - SUBTIL, não nacionalista. NÃO pedir bandeiras, símbolos pátrios,
//     traje típico, ícones turísticos, "energia carnavalesca", Bollywood,
//     mariachi, etc. Esses clichês deixam o criativo tosco.
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
      "Do NOT use national flags, carnival imagery, tropical clichés, or any nationalistic " +
      "symbols. Keep the creative modern and brand-driven.",
  },
  MX: {
    code: "MX",
    flag: "🇲🇽",
    labels: { pt: "México", en: "Mexico", es: "México", zh: "墨西哥" },
    promptContext:
      "Target market: Mexico. If people appear, they should reflect the Mexican population " +
      "(mestizo, indigenous and afro-mestizo features, varied skin tones — authentic, modern). " +
      "Any on-image text in Mexican Spanish. Do NOT use flags, mariachi, sombreros, lucha libre, " +
      "or other national/cultural clichés. Keep it modern and brand-driven.",
  },
  CO: {
    code: "CO",
    flag: "🇨🇴",
    labels: { pt: "Colômbia", en: "Colombia", es: "Colombia", zh: "哥伦比亚" },
    promptContext:
      "Target market: Colombia. If people appear, they should reflect the Colombian population " +
      "(mestizo, afro-Colombian, varied features — authentic, modern). Any on-image text in " +
      "Colombian Spanish. Do NOT use flags, national symbols, or cultural clichés. Keep it " +
      "modern and brand-driven.",
  },
  PE: {
    code: "PE",
    flag: "🇵🇪",
    labels: { pt: "Peru", en: "Peru", es: "Perú", zh: "秘鲁" },
    promptContext:
      "Target market: Peru. If people appear, they should reflect the Peruvian population " +
      "(predominantly mestizo, Andean indigenous features common — authentic, not exotic or " +
      "touristy). Any on-image text in Peruvian Spanish. Do NOT use flags, Andean costumes, " +
      "llamas, Machu Picchu, or cultural clichés. Keep it modern and brand-driven.",
  },
  US: {
    code: "US",
    flag: "🇺🇸",
    labels: { pt: "EUA", en: "USA", es: "EE.UU.", zh: "美国" },
    promptContext:
      "Target market: United States. If people appear, they should reflect the diverse US " +
      "population (varied ethnicities, ages — natural and authentic representation). Any " +
      "on-image text in American English. Do NOT use flags, eagles, or heavy-handed patriotic " +
      "imagery. Keep it modern and brand-driven.",
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
      "big!', 'Apna luck try karo', 'Bonus milega 100% guaranteed'. Do NOT use flags, saris, " +
      "turbans, Taj Mahal, Bollywood dance, mandalas, henna, or cultural clichés. Keep it " +
      "modern and brand-driven.",
  },
};

export interface HubBrand {
  id: string;
  /** Nome — pode ter forma i18n quando faz sentido (ex: "Sem marca"). Marcas reais (BETBUS, ELUCK) usam o mesmo nome em todos os idiomas. */
  name: string;
  i18nName?: Record<Lang, string>;
  markets: MarketCode[];
  gradient: string;
  logoInitials: string;
  /** Path opcional pro PNG do logo (em /public). Quando presente, o
   *  brand card mostra a imagem ao invés das iniciais, e o user pode
   *  ativar a opção "Incluir logo" pra compositar no canto superior
   *  direito do criativo gerado. FUNILIVE não tem (mascote integrado). */
  logoImage?: string;
  promptHint: string;
  license?: Partial<Record<MarketCode, string>>;
}

export const HUB_BRANDS: HubBrand[] = [
  {
    id: "none",
    name: "Sem marca",
    i18nName: { pt: "Sem marca", en: "No brand", es: "Sin marca", zh: "无品牌" },
    markets: [],
    gradient: "linear-gradient(135deg, #475569, #1E293B)",
    logoInitials: "—",
    promptHint: "",
  },
  {
    id: "betbus",
    name: "BETBUS",
    markets: ["MX"],
    gradient: "linear-gradient(135deg, #DC2626, #F59E0B)",
    logoInitials: "BB",
    logoImage: "/brand-logos/bet-bus-logo.png",
    promptHint:
      "BETBUS branding context: online casino & sports betting brand. " +
      "Visual style: bold red and gold accents, high-energy gaming atmosphere, " +
      "modern premium look with selective use of neon and gold sparkles when appropriate.",
    license: {
      MX:
        "Betbus es un sitio web de entretenimiento online autorizado mediante oficio numero " +
        "DGJS/0175/2023 de la Dirección de Juegos y Sorteos de los Estados Unidos Mexicanos y " +
        "operado por Energy C2, S.A.P.I. de C.V., autorizado por The Fabulous Vegas Games S.A. " +
        "de C.V., empresa registrada en México con autorización para operar en línea por la " +
        "Secretaría de Gobernación – Dirección General de Juegos y Sorteos de los Estados Unidos " +
        "Mexicanos No. DGJS/DGAAD/DCRCA/SSCCARb/2852/2015. Los Juegos Con Apuesta Estan Prohibidos " +
        "Para Menores De Edad. 18+ Aplican T&C, Permiso: P-08/2015-Ter.",
    },
  },
  {
    id: "eluck",
    name: "ELUCK",
    markets: ["BR", "MX", "CO", "PE"],
    gradient: "linear-gradient(135deg, #10B981, #FCD34D)",
    logoInitials: "EL",
    logoImage: "/brand-logos/eluck-logo.png",
    promptHint:
      "ELUCK branding context: online casino brand operating across multiple markets. " +
      "Visual style: vibrant green and gold accents, modern energetic aesthetic, " +
      "premium gaming atmosphere with celebratory mood.",
  },
  {
    id: "come",
    name: "COME.COM",
    // COME.COM opera na Índia. Idioma do texto e aparência das pessoas
    // já vão pelo market promptContext (sutil). Aqui só mantemos a
    // identidade da brand: cores, tom visual, vibe gaming/casino moderno.
    // Logo desativado por enquanto (asset estava dando 404).
    markets: ["IN"],
    gradient: "linear-gradient(135deg, #F59E0B, #DC2626)",
    logoInitials: "CC",
    promptHint:
      "COME.COM branding context: online casino & gaming brand. " +
      "Visual style: warm saffron and red accents, modern tech-forward look, " +
      "premium feel with high contrast. Energetic but clean — not over-decorated.",
  },
  {
    id: "funilive",
    name: "FUNILIVE",
    markets: ["BR", "MX", "US"],
    gradient: "linear-gradient(135deg, #8B5CF6, #EC4899)",
    logoInitials: "FL",
    logoImage: "/brand-logos/funilive-logo.jpg",
    promptHint:
      "FUNILIVE branding context: Live casino & betting brand with international presence. " +
      "Visual style: modern vibrant aesthetic with purple and magenta tones, " +
      "live entertainment vibe, dynamic and youthful.",
  },
];

export function getBrand(id: string | null | undefined): HubBrand | null {
  if (!id) return null;
  return HUB_BRANDS.find(b => b.id === id) || null;
}

export function getBrandName(brand: HubBrand, lang: Lang): string {
  return brand.i18nName?.[lang] || brand.name;
}

export function getMarketLabel(code: MarketCode, lang: Lang): string {
  return HUB_MARKETS[code]?.labels[lang] || code;
}
