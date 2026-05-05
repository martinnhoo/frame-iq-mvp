/**
 * hubBrands — registro das marcas do Brilliant Hub.
 *
 * Cada marca tem:
 *   - Identidade visual (gradient + iniciais — pode trocar por imagem real depois)
 *   - Mercado/país (BR ou MX)
 *   - prompt_hint: contexto que vai injetado na chamada da OpenAI pra
 *     IA entender o estilo da marca
 *   - license (opcional): disclaimer regulatório que pode aparecer
 *     como overlay na imagem. Hoje só BETBUS tem (MX). Marcas BR não
 *     têm regulação ativa, então sem license.
 *
 * Adicionar nova marca: appendar aqui. Front-end e edge function lêem
 * desse mesmo arquivo via import — sem migração de DB necessária.
 */

export interface HubBrand {
  id: string;
  name: string;
  market: "BR" | "MX" | "NONE";
  marketLabel: string;
  flag: string;
  gradient: string;
  logoInitials: string;
  promptHint: string;
  license?: string;
}

export const HUB_BRANDS: HubBrand[] = [
  {
    id: "none",
    name: "Sem marca",
    market: "NONE",
    marketLabel: "Genérico",
    flag: "✦",
    gradient: "linear-gradient(135deg, #475569, #1E293B)",
    logoInitials: "—",
    promptHint: "",
  },
  {
    id: "betbus",
    name: "BETBUS",
    market: "MX",
    marketLabel: "México",
    flag: "🇲🇽",
    gradient: "linear-gradient(135deg, #DC2626, #F59E0B)",
    logoInitials: "BB",
    promptHint:
      "BETBUS branding context: Mexican online casino & sports betting brand. " +
      "Visual style: bold red and gold accents, vibrant Latin American casino aesthetic, " +
      "high-energy atmosphere with neon lights and gold sparkles when appropriate.",
    license:
      "Betbus es un sitio web de entretenimiento online autorizado mediante oficio numero " +
      "DGJS/0175/2023 de la Dirección de Juegos y Sorteos de los Estados Unidos Mexicanos y " +
      "operado por Energy C2, S.A.P.I. de C.V., autorizado por The Fabulous Vegas Games S.A. " +
      "de C.V., empresa registrada en México con autorización para operar en línea por la " +
      "Secretaría de Gobernación – Dirección General de Juegos y Sorteos de los Estados Unidos " +
      "Mexicanos No. DGJS/DGAAD/DCRCA/SSCCARb/2852/2015. Los Juegos Con Apuesta Estan Prohibidos " +
      "Para Menores De Edad. 18+ Aplican T&C, Permiso: P-08/2015-Ter.",
  },
  {
    id: "eluck",
    name: "ELUCK",
    market: "BR",
    marketLabel: "Brasil",
    flag: "🇧🇷",
    gradient: "linear-gradient(135deg, #10B981, #FCD34D)",
    logoInitials: "EL",
    promptHint:
      "ELUCK branding context: Brazilian online casino brand. " +
      "Visual style: vibrant green and yellow accents inspired by Brazilian flag colors, " +
      "energetic and modern Latin American gaming aesthetic.",
  },
  {
    id: "funilive",
    name: "FUNILIVE",
    market: "BR",
    marketLabel: "Brasil",
    flag: "🇧🇷",
    gradient: "linear-gradient(135deg, #8B5CF6, #EC4899)",
    logoInitials: "FL",
    promptHint:
      "FUNILIVE branding context: Brazilian live casino & betting brand. " +
      "Visual style: modern vibrant aesthetic with purple and magenta tones, " +
      "live entertainment vibe, dynamic and youthful.",
  },
];

export function getBrand(id: string | null | undefined): HubBrand | null {
  if (!id) return null;
  return HUB_BRANDS.find(b => b.id === id) || null;
}
