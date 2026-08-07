/**
 * Idioma das telas de Creative Intelligence.
 *
 * ── Por que um dicionário próprio e não a i18n do projeto ─────────────────
 * O LanguageContext existente cobre o dashboard antigo e tem outra estrutura
 * de chaves. Enfiar as telas de CI nele significaria mexer num arquivo grande
 * que outras páginas dependem, e o risco não paga: aqui são ~120 frases num
 * módulo isolado, que some junto se o módulo sair.
 *
 * ── Inglês como padrão ────────────────────────────────────────────────────
 * O uso principal é em inglês. Quem quiser português troca uma vez e a escolha
 * persiste no localStorage.
 *
 * ── O que NÃO é traduzido, de propósito ───────────────────────────────────
 * O conteúdo vindo do banco: rótulo de hook, evidência, transcrição. Isso é
 * dado observado no criativo, e traduzir mudaria o que a marca de fato disse —
 * "these never roll down" virando "estes nunca enrolam" seria uma citação
 * falsa. Evidência é citação; citação não se traduz.
 */
import { createContext, useContext, useEffect, useState } from "react";

export type Idioma = "en" | "pt";

const CHAVE = "ci-idioma";

type Dic = Record<string, { en: string; pt: string }>;

/**
 * As frases. `en` primeiro porque é o padrão — ler o arquivo já mostra o que o
 * usuário verá na maioria das vezes.
 */
export const D: Dic = {
  // ── Navegação ──────────────────────────────────────────────────────────
  nav_overview:   { en: "Overview",        pt: "Visão Geral" },
  nav_brands:     { en: "Brands",          pt: "Marcas" },
  nav_ads:        { en: "Ads",             pt: "Anúncios" },
  nav_recipes:    { en: "Recipes",         pt: "Receitas" },
  nav_hooks:      { en: "Hooks",           pt: "Hooks" },
  nav_people:     { en: "People",          pt: "Pessoas" },
  nav_products:   { en: "Products",        pt: "Produtos" },
  nav_reports:    { en: "Reports",         pt: "Relatórios" },
  nav_soon:       { en: "soon",            pt: "em breve" },
  nav_quality:    { en: "Extraction quality", pt: "Qualidade da extração" },
  nav_health:     { en: "System health",   pt: "Saúde do sistema" },
  nav_import:     { en: "+ Import a brand", pt: "+ Importar uma marca" },
  back_overview:  { en: "← Overview",      pt: "← Visão geral" },
  tagline:        { en: "Find patterns.\nBuild better creative.",
                    pt: "Descubra padrões.\nCrie melhores criativos." },

  // ── KPIs ───────────────────────────────────────────────────────────────
  kpi_active:     { en: "Active ads found",   pt: "Anúncios ativos encontrados" },
  kpi_assets:     { en: "Unique assets",      pt: "Assets únicos" },
  kpi_recipes:    { en: "Creative recipes",   pt: "Receitas criativas atuais" },
  kpi_people:     { en: "Recurring people",   pt: "Pessoas recorrentes" },
  kpi_coverage:   { en: "Valid coverage",     pt: "Cobertura válida" },

  // ── Painel ─────────────────────────────────────────────────────────────
  panel_repeats:  { en: "What repeats most right now", pt: "O que mais se repete agora" },
  panel_mix:      { en: "Current creative mix",        pt: "Mix criativo atual" },
  panel_scripts:  { en: "Most used script structures", pt: "Estruturas de roteiro mais usadas" },
  panel_hooks:    { en: "Most frequent hooks",         pt: "Hooks que mais aparecem" },
  panel_people:   { en: "Recurring people and delivery", pt: "Pessoas e delivery mais recorrentes" },
  panel_messages: { en: "Current message map",         pt: "Mapa de mensagens atual" },
  panel_brief:    { en: "How to turn this into a script", pt: "Como transformar isso em script" },

  col_recipe:     { en: "Creative recipe", pt: "Receita criativa" },
  col_evidence:   { en: "Evidence (repetition)", pt: "Evidência (repetição)" },
  col_assets:     { en: "Assets",   pt: "Assets" },
  col_people:     { en: "People",   pt: "Pessoas" },
  col_duration:   { en: "Duration", pt: "Duração" },
  col_hook:       { en: "Dominant hook", pt: "Hook dominante" },

  problems:       { en: "Problems",  pt: "Problemas" },
  promises:       { en: "Promises",  pt: "Promessas" },
  proofs:         { en: "Proofs",    pt: "Provas" },
  none_found:     { en: "none identified", pt: "nenhum identificado" },

  build_recipes:  { en: "Build recipes",  pt: "Montar receitas" },
  regroup:        { en: "Regroup",        pt: "Reagrupar" },
  grouping:       { en: "Grouping…",      pt: "Agrupando…" },
  copy_brief:     { en: "Copy brief",     pt: "Copiar briefing" },
  copied:         { en: "Copied",         pt: "Copiado" },
  not_observed:   { en: "not observed",   pt: "não observado" },

  // ── Receitas ───────────────────────────────────────────────────────────
  recipes_title:  { en: "Creative recipes", pt: "Receitas criativas" },
  why_together:   { en: "WHY THEY'RE GROUPED", pt: "POR QUE ESTÃO JUNTOS" },
  kept:           { en: "KEPT THE SAME", pt: "MANTIVERAM" },
  tested:         { en: "TESTED",        pt: "TESTARAM" },
  ads_label:      { en: "ADS",           pt: "ANÚNCIOS" },
  inspect:        { en: "inspect →",     pt: "inspecionar →" },
  reading_var:    { en: "Reading variations…", pt: "Lendo variações…" },
  nothing_constant: { en: "nothing constant across all", pt: "nada constante em todos" },

  // ── Anúncio ────────────────────────────────────────────────────────────
  video:          { en: "Video",          pt: "Vídeo" },
  keyframes:      { en: "Keyframes",      pt: "Keyframes" },
  classifications:{ en: "Classifications", pt: "Classificações" },
  scenes:         { en: "Scenes",         pt: "Cenas" },
  transcript:     { en: "Transcript",     pt: "Transcrição" },
  onscreen:       { en: "On-screen text", pt: "Texto na tela" },
  ad_copy:        { en: "Ad copy",        pt: "Texto do anúncio" },
  no_audio:       { en: "Video has no audio track — nothing to transcribe.",
                    pt: "Vídeo sem trilha de áudio — não há o que transcrever." },
  not_transcribed:{ en: "Not transcribed yet.", pt: "Ainda não transcrito." },
  days_running:   { en: "days running",   pt: "dias no ar" },
  live:           { en: "live",           pt: "no ar" },

  // ── Qualidade ──────────────────────────────────────────────────────────
  quality_title:  { en: "Extraction quality", pt: "Qualidade da extração" },
  accuracy_field: { en: "Accuracy by field",  pt: "Acurácia por campo" },
  right:          { en: "Right",   pt: "Certo" },
  partial:        { en: "Partial", pt: "Parcial" },
  wrong:          { en: "Wrong",   pt: "Errado" },
  reviewed:       { en: "reviewed", pt: "revisado" },
  previous:       { en: "← previous", pt: "← anterior" },
  next:           { en: "next →",     pt: "próximo →" },
  open_ad:        { en: "open the ad ↗", pt: "abrir o anúncio ↗" },
  fields_reviewed:{ en: "fields reviewed", pt: "campos revisados" },

  // ── Rodapé ─────────────────────────────────────────────────────────────
  footer: {
    en: "This data reflects public signals of creative repetition — how many ads the brand ran and what repeats between them. It does NOT represent performance, ROAS, CPA or confirmed results, and does not come from anyone's ad account.",
    pt: "Os dados refletem sinais públicos de criativos e repetição — quantos anúncios a marca colocou no ar e o que se repete entre eles. NÃO representam desempenho, ROAS, CPA ou resultados confirmados, e não vêm da conta de anúncios de ninguém.",
  },
};

const Ctx = createContext<{ idioma: Idioma; setIdioma: (i: Idioma) => void }>({
  idioma: "en", setIdioma: () => {},
});

export function IdiomaProvider({ children }: { children: React.ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>(() => {
    const salvo = typeof window !== "undefined" ? window.localStorage.getItem(CHAVE) : null;
    return salvo === "pt" || salvo === "en" ? salvo : "en";
  });
  useEffect(() => {
    try { window.localStorage.setItem(CHAVE, idioma); } catch { /* modo privado */ }
  }, [idioma]);
  return <Ctx.Provider value={{ idioma, setIdioma: setIdiomaState }}>{children}</Ctx.Provider>;
}

/**
 * `t("chave")` devolve a frase. Chave desconhecida devolve a própria chave em
 * vez de string vazia: um rótulo faltando aparece como `kpi_novo` na tela, que
 * é feio e óbvio — melhor que um espaço em branco que ninguém nota.
 */
export function useIdioma() {
  const { idioma, setIdioma } = useContext(Ctx);
  const t = (chave: keyof typeof D | string): string => {
    const entrada = D[chave as string];
    return entrada ? entrada[idioma] : String(chave);
  };
  return { idioma, setIdioma, t };
}

/** O seletor. Discreto de propósito: troca-se uma vez e não se mexe mais. */
export function SeletorIdioma({ cor = "rgba(240,246,252,0.48)" }: { cor?: string }) {
  const { idioma, setIdioma } = useIdioma();
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {(["en", "pt"] as const).map(i => (
        <button key={i} onClick={() => setIdioma(i)} style={{
          background: "transparent",
          color: idioma === i ? "#F0F6FC" : cor,
          border: "none", padding: "3px 6px", fontSize: 11.5,
          fontWeight: idioma === i ? 700 : 500,
          fontFamily: "inherit", cursor: "pointer",
          borderBottom: idioma === i ? "1px solid #A78BFA" : "1px solid transparent",
        }}>{i.toUpperCase()}</button>
      ))}
    </div>
  );
}
