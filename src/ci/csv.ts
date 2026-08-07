/**
 * Geração de CSV — sem React, sem Supabase, testável em Node puro.
 *
 * ── Por que não é uma linha de join(",") ──────────────────────────────────
 * Porque os dados deste produto são texto livre vindo de anúncios: falas com
 * vírgula, aspas, quebra de linha, e evidências que são citações inteiras.
 * Um join ingênuo produz um arquivo que abre torto no Excel e desloca colunas
 * silenciosamente — o pior tipo de erro num export, porque a planilha parece
 * certa e os valores estão na coluna errada.
 *
 * ── A regra do RFC 4180, e onde ela não basta ─────────────────────────────
 * Campo com vírgula, aspas ou quebra vai entre aspas; aspas internas dobram.
 * Isso resolve o formato. Três coisas que o RFC não cobre e que quebram na
 * prática:
 *
 *   · BOM UTF-8 — sem ele o Excel no Windows lê "Não" como "NÃ£o". O produto é
 *     usado em português; sem BOM o export nasce ilegível.
 *
 *   · Injeção de fórmula — um campo começando com = + - @ é interpretado como
 *     fórmula pelo Excel e pelo Sheets. Como o texto vem de anúncios de
 *     terceiros, isso é entrada não confiável escrevendo fórmula na máquina de
 *     quem abre. Prefixamos com aspa simples, que o Excel entende como "isto é
 *     texto".
 *
 *   · null e undefined — viram string vazia, não "null". Ninguém quer a
 *     palavra null numa planilha.
 */

/** Caracteres que fazem o Excel tratar o campo como fórmula. */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function escaparCampo(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  let texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);

  // Neutraliza fórmula ANTES de decidir sobre aspas: a aspa simples adicionada
  // aqui não deve influenciar a decisão de escapar.
  if (INICIO_DE_FORMULA.test(texto)) texto = `'${texto}`;

  const precisaAspas = /[",\n\r;]/.test(texto);
  if (!precisaAspas) return texto;

  return `"${texto.replace(/"/g, '""')}"`;
}

export function gerarCsv(
  colunas: { chave: string; titulo: string }[],
  linhas: Record<string, unknown>[],
): string {
  const cabecalho = colunas.map(c => escaparCampo(c.titulo)).join(",");
  const corpo = linhas.map(l => colunas.map(c => escaparCampo(l[c.chave])).join(","));
  // CRLF é o que o RFC pede e o que o Excel espera.
  return [cabecalho, ...corpo].join("\r\n");
}

/**
 * O BOM vai aqui e não dentro de gerarCsv: quem testa o conteúdo quer comparar
 * o texto, não caçar um caractere invisível no começo de toda asserção.
 */
export const BOM_UTF8 = "﻿";

export function baixarCsv(nomeArquivo: string, csv: string): void {
  const blob = new Blob([BOM_UTF8 + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Sem o revoke, cada export segura o arquivo inteiro em memória até a aba
  // fechar. Com CSV de 50.000 linhas isso deixa de ser detalhe.
  URL.revokeObjectURL(url);
}

/** Nome com data, para não sobrescrever o export da semana passada. */
export function nomeArquivo(prefixo: string, marca?: string | null): string {
  const hoje = new Date().toISOString().slice(0, 10);
  const m = (marca ?? "marca")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${prefixo}-${m || "marca"}-${hoje}.csv`;
}
