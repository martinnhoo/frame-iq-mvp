/**
 * Testes da lógica de confiança.
 *
 * Rodar:  npx esbuild src/ci/confianca-regras.ts --outdir=.build-confianca --format=esm
 *         node src/ci/confianca.test.mjs
 *
 * O que estes testes protegem é UMA invariante, e ela é a razão do módulo
 * existir: campo não medido não pode cair no mesmo balde de campo bom. Se
 * alguém um dia "simplificar" o nivelDe e fizer ausência de revisão virar
 * verde, a tela volta a mentir por omissão — que é o defeito que estamos
 * corrigindo. O teste falha antes disso chegar na tela.
 */
import { nivelDe, MINIMO_AMOSTRA, LIMIAR_FRACO, LIMIAR_BOM } from "../../.build-confianca/confianca-regras.js";

let falhou = false;
const check = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${nome}${detalhe ? `  [${detalhe}]` : ""}`);
  if (!cond) falhou = true;
};

const a = (revisados, pct) => ({
  campo: "x", revisados, corretos: 0, parciais: 0, errados: 0, acuracia_pct: pct,
});

// ── A invariante principal ──────────────────────────────────────────────────
check("sem entrada nenhuma → não medido", nivelDe(undefined) === "nao_medido");
check("entrada nula → não medido", nivelDe(null) === "nao_medido");
check("zero revisões → não medido", nivelDe(a(0, null)) === "nao_medido");
check("revisões só de 'n/a' (pct nulo) → não medido",
  nivelDe(a(0, null)) === "nao_medido");
check("NÃO MEDIDO nunca é 'bom'", nivelDe(undefined) !== "bom");

// ── Amostra ────────────────────────────────────────────────────────────────
check(`n abaixo de ${MINIMO_AMOSTRA} → amostra pequena, mesmo com 100%`,
  nivelDe(a(MINIMO_AMOSTRA - 1, 100)) === "amostra_pequena",
  nivelDe(a(MINIMO_AMOSTRA - 1, 100)));
check("100% com n=2 NÃO é 'bom' — é a armadilha clássica",
  nivelDe(a(2, 100)) !== "bom");
check(`n exatamente ${MINIMO_AMOSTRA} já vale como medida`,
  nivelDe(a(MINIMO_AMOSTRA, 100)) === "bom");

// ── Faixas ─────────────────────────────────────────────────────────────────
check(`abaixo de ${LIMIAR_FRACO}% → fraco`,
  nivelDe(a(20, LIMIAR_FRACO - 1)) === "fraco");
check(`exatamente ${LIMIAR_FRACO}% → razoável (limiar não é fraco)`,
  nivelDe(a(20, LIMIAR_FRACO)) === "razoavel");
check(`abaixo de ${LIMIAR_BOM}% → razoável`,
  nivelDe(a(20, LIMIAR_BOM - 1)) === "razoavel");
check(`exatamente ${LIMIAR_BOM}% → bom`,
  nivelDe(a(20, LIMIAR_BOM)) === "bom");
check("0% com amostra grande → fraco, não 'não medido'",
  nivelDe(a(30, 0)) === "fraco", nivelDe(a(30, 0)));

// ── O caso do briefing dele ────────────────────────────────────────────────
// "Se proof acerta 60%, não deveria ser apresentado da mesma maneira que
//  duração, que acerta 100%."
check("proof a 60% e duração a 100% caem em níveis DIFERENTES",
  nivelDe(a(25, 60)) !== nivelDe(a(25, 100)),
  `${nivelDe(a(25, 60))} vs ${nivelDe(a(25, 100))}`);

console.log(falhou ? "\nHOUVE FALHA" : "\nTODOS OS TESTES PASSARAM");
process.exit(falhou ? 1 : 0);
