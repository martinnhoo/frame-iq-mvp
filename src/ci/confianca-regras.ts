/**
 * As regras de confiança, sem React e sem Supabase.
 *
 * Ficam separadas do componente por um motivo prático: aqui não há node_modules
 * no ambiente onde eu rodo teste, então qualquer arquivo que importe `react`
 * é intestável para mim. Regra de negócio presa dentro de um componente é regra
 * que nunca é testada — e esta em particular decide se a tela mente ou não.
 */

/** Abaixo disto a acurácia é indicativa, não conclusiva. */
export const MINIMO_AMOSTRA = 8;

/** Abaixo disto o dado ganha aviso visual, não só um número discreto. */
export const LIMIAR_FRACO = 70;

/** A partir daqui o campo é confiável o bastante para não pedir ressalva. */
export const LIMIAR_BOM = 90;

export type Acuracia = {
  campo: string;
  revisados: number;
  corretos: number;
  parciais: number;
  errados: number;
  acuracia_pct: number | null;
};

export type MapaAcuracia = Record<string, Acuracia>;

export type Nivel = "nao_medido" | "amostra_pequena" | "fraco" | "razoavel" | "bom";

/**
 * A ordem dos testes aqui é a regra inteira, e cada linha existe por um motivo:
 *
 *   1. Sem dado → "não medido". NUNCA "bom". Ausência de medição não é
 *      aprovação, e tratar as duas igual é o defeito que este módulo corrige.
 *   2. Amostra pequena vem ANTES da faixa de porcentagem: 100% em dois
 *      anúncios não é 100% de nada, e mostrar verde ali seria pior que não
 *      mostrar nada — daria confiança onde não há evidência.
 */
export function nivelDe(a?: Acuracia | null): Nivel {
  if (!a || a.revisados === 0 || a.acuracia_pct === null || a.acuracia_pct === undefined) {
    return "nao_medido";
  }
  if (a.revisados < MINIMO_AMOSTRA) return "amostra_pequena";
  if (a.acuracia_pct < LIMIAR_FRACO) return "fraco";
  if (a.acuracia_pct < LIMIAR_BOM) return "razoavel";
  return "bom";
}

/** Só o nível "fraco" merece aviso de bloco; o resto seria ruído. */
export function mereceAviso(a?: Acuracia | null): boolean {
  return nivelDe(a) === "fraco";
}
