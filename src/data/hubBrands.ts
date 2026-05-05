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

export const HUB_MARKETS: Record<MarketCode, HubMarket> = {
  BR: {
    code: "BR",
    flag: "🇧🇷",
    labels: { pt: "Brasil", en: "Brazil", es: "Brasil", zh: "巴西" },
    promptContext: "Target audience: Brazilian users. Use cultural references and visual cues familiar to Brazilian Portuguese-speaking audience (carnival energy, tropical vibes, vibrant green and yellow when contextually appropriate).",
  },
  MX: {
    code: "MX",
    flag: "🇲🇽",
    labels: { pt: "México", en: "Mexico", es: "México", zh: "墨西哥" },
    promptContext: "Target audience: Mexican users. Use cultural references and visual cues familiar to Mexican Spanish-speaking audience (warm reds and golds, festive aesthetic, Latin American casino atmosphere).",
  },
  CO: {
    code: "CO",
    flag: "🇨🇴",
    labels: { pt: "Colômbia", en: "Colombia", es: "Colombia", zh: "哥伦比亚" },
    promptContext: "Target audience: Colombian users. Visual style appealing to Colombian Spanish-speaking audience (bright yellows, blues and reds when contextually appropriate, energetic Latin American vibe).",
  },
  PE: {
    code: "PE",
    flag: "🇵🇪",
    labels: { pt: "Peru", en: "Peru", es: "Perú", zh: "秘鲁" },
    promptContext: "Target audience: Peruvian users. Visual style appealing to Peruvian Spanish-speaking audience (red and white accents when contextually appropriate, Andean-influenced modern aesthetic).",
  },
  US: {
    code: "US",
    flag: "🇺🇸",
    labels: { pt: "EUA", en: "USA", es: "EE.UU.", zh: "美国" },
    promptContext: "Target audience: US users. Visual style appealing to American English-speaking audience (high-contrast modern look, Vegas-style casino aesthetic when relevant, premium feel).",
  },
  IN: {
    code: "IN",
    flag: "🇮🇳",
    labels: { pt: "Índia", en: "India", es: "India", zh: "印度" },
    promptContext:
      "Target audience: Indian users. ALL on-image text MUST be in HINGLISH " +
      "(a mix of Hindi and English written in Latin/Roman script — never in Devanagari). " +
      "Examples of Hinglish copy: 'Aaj hi khelo aur jeeto big!', 'Apna luck try karo', " +
      "'Bonus milega 100% guaranteed', 'Khel jeet ka maza lo'. " +
      "Visual style: vibrant saturated colors (deep saffron, royal blue, hot pink, gold), " +
      "Bollywood-influenced energy, festive Indian aesthetic with subtle desi cultural cues " +
      "(diya/lamp glow, mandala-inspired patterns when fitting), high-contrast premium look. " +
      "Avoid generic Western imagery — embrace South Asian visual codes.",
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
      "BETBUS branding context: Mexican online casino & sports betting brand. " +
      "Visual style: bold red and gold accents, vibrant Latin American casino aesthetic, " +
      "high-energy atmosphere with neon lights and gold sparkles when appropriate.",
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
      "ELUCK branding context: Latin American online casino brand operating across multiple markets. " +
      "Visual style: vibrant green and gold accents, modern energetic aesthetic, " +
      "premium gaming atmosphere with celebratory mood.",
  },
  {
    id: "come",
    name: "COME.COM",
    // COME.COM opera na Índia — todo texto on-image deve ser HINGLISH
    // (Hindi + English em script latino, nunca em Devanagari).
    // Logo desativado por enquanto (asset estava dando 404).
    markets: ["IN"],
    gradient: "linear-gradient(135deg, #F59E0B, #DC2626)",
    logoInitials: "CC",
    promptHint:
      "COME.COM branding context: Indian online casino & gaming brand. " +
      "Visual style: vibrant Bollywood-influenced energy, deep saffron and royal blue accents, " +
      "festive South Asian aesthetic with high contrast, premium feel. " +
      "ALL on-image copy in HINGLISH (Hindi + English mixed, written in Latin/Roman script — " +
      "NEVER in Devanagari script). Embrace desi cultural cues (golden glow, celebratory mood) " +
      "while keeping the brand modern and tech-forward.",
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
