/**
 * Testes do CSV.
 *
 * Rodar:  npx esbuild src/ci/csv.ts --outdir=.build-csv --format=esm
 *         node src/ci/csv.test.mjs
 *
 * O caso que dá nome a este arquivo é a injeção de fórmula. O texto exportado
 * aqui vem de anúncios de terceiros — nós não controlamos o que a marca
 * escreve. Um campo começando com "=" é executado como fórmula pelo Excel e
 * pelo Sheets na máquina de quem abre o arquivo. Isso é entrada não confiável
 * virando execução, e num export de "inteligência de concorrente" é exatamente
 * o lugar onde alguém plantaria isso.
 */
import { escaparCampo, gerarCsv, nomeArquivo } from "../../.build-csv/csv.js";

let falhou = false;
const check = (nome, cond, detalhe = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${nome}${detalhe ? `  [${detalhe}]` : ""}`);
  if (!cond) falhou = true;
};

// ── Escape básico ───────────────────────────────────────────────────────────
check("texto simples não ganha aspas", escaparCampo("conforto") === "conforto");
check("vírgula força aspas", escaparCampo("a,b") === '"a,b"', escaparCampo("a,b"));
check("aspas internas são dobradas",
  escaparCampo('ela disse "não sai do lugar"') === '"ela disse ""não sai do lugar"""',
  escaparCampo('ela disse "não sai do lugar"'));
check("quebra de linha força aspas", escaparCampo("linha1\nlinha2") === '"linha1\nlinha2"');
check("ponto e vírgula força aspas (separador em locale pt-BR)",
  escaparCampo("a;b") === '"a;b"', escaparCampo("a;b"));

// ── Nulos ───────────────────────────────────────────────────────────────────
check("null vira vazio, não a palavra 'null'", escaparCampo(null) === "");
check("undefined vira vazio", escaparCampo(undefined) === "");
check("zero NÃO vira vazio", escaparCampo(0) === "0", escaparCampo(0));
check("false NÃO vira vazio", escaparCampo(false) === "false");

// ── Injeção de fórmula ──────────────────────────────────────────────────────
for (const perigoso of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
  check(`"${perigoso}" é neutralizado com aspa simples`,
    escaparCampo(perigoso).startsWith("'"), escaparCampo(perigoso));
}
check("fórmula com vírgula ganha aspa simples E aspas duplas",
  escaparCampo("=HYPERLINK(1,2)") === `"'=HYPERLINK(1,2)"`,
  escaparCampo("=HYPERLINK(1,2)"));
check("texto que só CONTÉM = no meio não é alterado",
  escaparCampo("a=b") === "a=b", escaparCampo("a=b"));

// ── Objeto ──────────────────────────────────────────────────────────────────
check("objeto vira JSON dentro de aspas",
  escaparCampo({ a: 1 }) === '"{""a"":1}"', escaparCampo({ a: 1 }));

// ── Documento inteiro ───────────────────────────────────────────────────────
const csv = gerarCsv(
  [{ chave: "nome", titulo: "Receita" }, { chave: "n", titulo: "Assets" }],
  [{ nome: "stays in place", n: 6 }, { nome: 'com "aspas", e vírgula', n: 2 }],
);
check("o cabeçalho vem primeiro", csv.split("\r\n")[0] === "Receita,Assets");
check("usa CRLF, como o Excel espera", csv.includes("\r\n"));
check("três linhas para dois registros", csv.split("\r\n").length === 3, String(csv.split("\r\n").length));
check("a linha complicada sai escapada",
  csv.split("\r\n")[2] === '"com ""aspas"", e vírgula",2',
  csv.split("\r\n")[2]);

// ── Nome do arquivo ─────────────────────────────────────────────────────────
const nome = nomeArquivo("receitas", "Shapermint Brasil");
check("nome tem prefixo, marca e data",
  /^receitas-shapermint-brasil-\d{4}-\d{2}-\d{2}\.csv$/.test(nome), nome);
check("acento na marca não vira lixo no nome",
  /^receitas-esportes-da-sorte-/.test(nomeArquivo("receitas", "Esportes da Sorte")),
  nomeArquivo("receitas", "Esportes da Sorte"));
check("marca ausente não gera nome quebrado",
  /^receitas-marca-\d{4}/.test(nomeArquivo("receitas", null)), nomeArquivo("receitas", null));

console.log(falhou ? "\nHOUVE FALHA" : "\nTODOS OS TESTES PASSARAM");
process.exit(falhou ? 1 : 0);
