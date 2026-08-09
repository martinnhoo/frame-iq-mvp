/**
 * /ci — Visão Geral do Creative Intelligence
 *
 * Layout fiel ao mapa aprovado: mesma lateral, mesmo topo, mesmos cinco KPIs,
 * mesma tabela de receitas com as mesmas colunas, mesmo donut, mesmas três
 * cartelas do meio, mesmo mapa de mensagens e mesmo rodapé.
 *
 * ── A única liberdade que tomei ───────────────────────────────────────────
 * Onde o mapa mostra número, aqui vai o número REAL. Onde ainda não há dado, o
 * bloco mantém o lugar e o tamanho, mas diz o que falta — em vez de repetir os
 * números do mockup, que seriam invenção com cara de resultado.
 *
 * Três blocos dependem de agrupamento que ainda não escrevi (receitas,
 * estruturas de roteiro, pessoas). Eles aparecem marcados, com o motivo.
 *
 * ── Sobre os números ──────────────────────────────────────────────────────
 * Tudo aqui é sinal público de repetição. Nada é gasto, impressão, ROAS ou CPA.
 * O rodapé diz isso — e é a frase mais importante da tela.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdioma, SeletorIdioma } from "@/ci/idioma";
import { useAcuracia, SeloConfianca, AvisoConfianca } from "@/ci/confianca";
import { BarraStatus } from "@/ci/BarraStatus";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  b1: "rgba(240,246,252,0.07)", b2: "rgba(240,246,252,0.12)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  blue: "#0ea5e9", green: "#4ADE80", red: "#F87171", yellow: "#FBBF24",
  purple: "#8B5CF6", violet: "#A78BFA", teal: "#2DD4BF", orange: "#FBBF24",
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
type Row = Record<string, any>;

// ── Ícones (inline, sem dependência) ────────────────────────────────────────
const I = {
  home: "M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  brand: "M4 4h16v16H4zM8 8h8v8H8z",
  ads: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5v8m-4-4h8",
  recipe: "M4 6h16M4 12h16M4 18h10",
  hook: "M13 2 4 14h6l-1 8 9-12h-6z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
  product: "M20 7 12 3 4 7v10l8 4 8-4z",
  report: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.5-4.5",
  layers: "M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  bulb: "M9 21h6M10 17h4a5 5 0 1 0-4 0z",
  shield: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z",
  doc: "M6 2h8l4 4v16H6zM14 2v4h4",
  spark: "m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z",
  chat: "M4 5h16v11H9l-5 4z",
  warn: "M12 3 2 20h20zM12 10v4m0 3h.01",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-4-9 3 3 5-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2",
  phone: "M8 2h8v20H8zM11 19h2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
};
const Ic = ({ d, s = 16, c = "currentColor", w = 1.6 }: { d: string; s?: number; c?: string; w?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w}
       strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>
);

const NAV = [
  { id: "overview", k: "nav_overview", icon: I.home, href: "/ci", pronto: true },
  { id: "marcas", k: "nav_brands", icon: I.brand, href: "/importar", pronto: true },
  { id: "anuncios", k: "nav_ads", icon: I.ads, href: "/shapermint", pronto: true },
  { id: "receitas", k: "nav_recipes", icon: I.recipe, href: "/ci/receitas", pronto: true },
  { id: "hooks", k: "nav_hooks", icon: I.hook, href: "/ci/hooks", pronto: true },
  { id: "pessoas", k: "nav_people", icon: I.person, href: "/ci/pessoas", pronto: true },
  { id: "produtos", k: "nav_products", icon: I.product, href: "/ci/produtos", pronto: true },
  { id: "relatorios", k: "nav_reports", icon: I.report, href: "/ci/relatorio", pronto: true },
];

// ── Peças ───────────────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 13, padding: 18, ...style,
  }}>{children}</div>
);

/**
 * `selo` recebe o selo de confiança do campo que o painel apresenta.
 *
 * Fica no cabeçalho e não junto de cada item: a acurácia é do CAMPO, não da
 * linha. Repetir "63%" em cada prova daria a impressão de que aquela prova
 * específica foi medida, o que seria uma precisão inventada.
 */
const Head = ({ children, hint, link, selo }: {
  children: React.ReactNode; hint?: string; link?: string; selo?: React.ReactNode;
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 15 }}>
    <span style={{ fontSize: 15, fontWeight: 640 }}>{children}</span>
    {hint && <span title={hint} style={{
      fontSize: 9.5, color: T.label, border: `1px solid ${T.b2}`, borderRadius: "50%",
      width: 14, height: 14, display: "grid", placeItems: "center", cursor: "help",
    }}>i</span>}
    {selo}
    {link && <a href={link} style={{ marginLeft: "auto", fontSize: 12.5, color: T.blue, textDecoration: "none" }}>›</a>}
  </div>
);

/** Mantém o lugar do bloco, mas nunca finge que há dado. */
const Falta = ({ motivo, pendente, acao }: { motivo: string; pendente?: boolean; acao?: React.ReactNode }) => (
  <div style={{
    background: pendente ? "rgba(139,92,246,.05)" : T.bg2,
    border: `1px dashed ${pendente ? "rgba(139,92,246,.34)" : T.b2}`,
    borderRadius: 10, padding: "15px 14px",
  }}>
    <div style={{
      fontSize: 9.5, letterSpacing: ".08em", fontWeight: 700, marginBottom: 6,
      color: pendente ? T.violet : T.yellow,
    }}>{pendente ? "AINDA NÃO CONSTRUÍDO" : "SEM DADO AINDA"}</div>
    <div style={{ fontSize: 12.6, color: T.t2, lineHeight: 1.58 }}>{motivo}</div>
    {acao && <div style={{ marginTop: 10 }}>{acao}</div>}
  </div>
);

const Kpi = ({ icon, cor, label, valor, sufixo, hint, apagado }: {
  icon: string; cor: string; label: string; valor: React.ReactNode;
  sufixo?: string; hint?: string; apagado?: boolean;
}) => (
  <Card style={{ flex: "1 1 175px", minWidth: 175, display: "flex", alignItems: "center", gap: 13, padding: 16 }}>
    <div style={{
      width: 40, height: 40, borderRadius: 11, background: `${cor}1f`,
      display: "grid", placeItems: "center", flexShrink: 0,
    }}><Ic d={icon} s={19} c={cor} /></div>
    <div style={{ minWidth: 0 }}>
      <div title={hint} style={{ fontSize: 11.6, color: T.t3, lineHeight: 1.3, marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: 26, fontWeight: 690, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums",
        color: apagado ? T.label : T.t1,
      }}>{valor}<span style={{ fontSize: 16, color: T.t3 }}>{sufixo}</span></div>
    </div>
  </Card>
);

const Pilula = ({ icon, children, dot }: { icon?: string; children: React.ReactNode; dot?: string }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8, background: T.bg1,
    border: `1px solid ${T.b1}`, borderRadius: 9, padding: "8px 13px", fontSize: 13.2, color: T.t2,
  }}>
    {dot && <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />}
    {icon && <Ic d={icon} s={14} c={T.t3} />}
    {children}
  </div>
);

/** Barra de repetição do mapa: blocos discretos, não gradiente. */
const Repeticao = ({ n, max, cor }: { n: number; max: number; cor: string }) => {
  const total = 14;
  const cheios = max > 0 ? Math.max(1, Math.round((n / max) * total)) : 0;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 6, height: 14, borderRadius: 2,
          background: i < cheios ? cor : "rgba(240,246,252,0.06)",
        }} />
      ))}
    </div>
  );
};

/** Donut em SVG puro — sem biblioteca de gráfico para um anel de 5 fatias. */
const Donut = ({ fatias }: { fatias: { label: string; pct: number; cor: string }[] }) => {
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg width={132} height={132} viewBox="0 0 132 132">
      <circle cx={66} cy={66} r={R} fill="none" stroke={T.bg3} strokeWidth={20} />
      {fatias.map((f, i) => {
        const len = (f.pct / 100) * C;
        const el = <circle key={i} cx={66} cy={66} r={R} fill="none" stroke={f.cor}
          strokeWidth={20} strokeDasharray={`${len} ${C - len}`}
          strokeDashoffset={-acc} transform="rotate(-90 66 66)" />;
        acc += len;
        return el;
      })}
    </svg>
  );
};

const PALETA = [T.purple, T.blue, T.teal, T.orange, "rgba(240,246,252,0.28)"];

// ═══════════════════════════════════════════════════════════════════════════

export default function CreativeOverview() {
  const { t, idioma } = useIdioma();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Row[]>([]);
  const [marca, setMarca] = useState<Row | null>(null);
  const [d, setD] = useState<Row | null>(null);

  // A acurácia medida em /ci/qualidade, para colar em cada painel. Uma chamada
  // por marca; falha aqui não derruba a tela — o selo passa a dizer "não
  // medido", que é a verdade.
  const { mapa: acuracia } = useAcuracia(marca?.id);

  /**
   * T6 · O que mais se repete agora — calculado no BANCO.
   *
   * A tabela abaixo era montada com fetchEverything().filter().reduce() no
   * navegador. Com 40 anúncios funcionava; com 3.000 pesa e com 50.000 não
   * roda. Além disso, a definição de "variou" passa a vir da mesma função que
   * a tela de receitas usa — duas definições divergiriam com o tempo e as duas
   * telas começariam a discordar sem ninguém entender por quê.
   */
  const [prioridade, setPrioridade] = useState<Row[] | null>(null);
  const [erroPrioridade, setErroPrioridade] = useState<string | null>(null);

  useEffect(() => {
    if (!marca?.id) return;
    let vivo = true;
    (async () => {
      const { data, error } = await supabase.rpc("ci_creative_priority", { p_brand_id: marca.id });
      if (!vivo) return;
      if (error) { setErroPrioridade(error.message); setPrioridade(null); return; }
      setErroPrioridade(null);
      setPrioridade((data ?? []) as Row[]);
    })();
    return () => { vivo = false; };
  }, [marca?.id, d]);
  const en = idioma === "en";
  const selo = (campo: string) => <SeloConfianca campo={campo} mapa={acuracia} en={en} />;

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ci_brands").select("id,slug,name,market,language").order("created_at");
      if (error) { setErro(error.message); setCarregando(false); return; }
      setMarcas(data ?? []);
      setMarca((data ?? [])[0] ?? null);
      if (!(data ?? []).length) setCarregando(false);
    })();
  }, []);

  const carregar = useCallback(async (brandId: string) => {
    setCarregando(true); setErro(null);
    const q = (t: string, sel: string) =>
      ((supabase.from(t as any) as any).select(sel).eq("brand_id", brandId)) as Promise<{ data: Row[] | null }>;
    try {
      const [ads, assets, termos, vinculos, conceitos, pessoas, cenas, runs, membros] = await Promise.all([
        q("ci_ads", "id,media_type,display_format,is_active,running_days,is_demo,analysis_status"),
        q("ci_assets", "id,media_type,duration_seconds,analysis_status"),
        q("ci_taxonomy_terms", "id,kind,slug,label"),
        q("ci_ad_taxonomy", "term_id,ad_id,asset_id,evidence,evidence_kind"),
        q("ci_concepts", "id,name,description,review_status,confidence,ad_count," +
          "unique_asset_count,longevity_days,is_active,angle_term_id,proof_term_id,baseline_ad_id"),
        q("ci_person_clusters", "id,label,asset_count"),
        q("ci_scenes", "asset_id,scene_index,scene_function"),
        supabase.from("ci_import_runs")
          .select("created_at,ads_created,credits_spent").eq("brand_id", brandId)
          .order("created_at", { ascending: false }).limit(1),
        q("ci_concept_members", "concept_id,ad_id,match_reasons,is_baseline"),
      ]);
      setD({
        ads: ads.data ?? [], assets: assets.data ?? [], termos: termos.data ?? [],
        vinculos: vinculos.data ?? [], conceitos: conceitos.data ?? [],
        pessoas: pessoas.data ?? [], cenas: cenas.data ?? [], run: (runs.data ?? [])[0] ?? null,
        membros: membros.data ?? [],
      });
    } catch (e: any) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (marca?.id) carregar(marca.id); }, [marca?.id, carregar]);

  // ── Reagrupar ─────────────────────────────────────────────────────────────
  // Botão explícito e não automático: reconstruir apaga as receitas geradas por
  // máquina (preservando as revisadas), e isso é uma ação, não um efeito
  // colateral de abrir a página.
  const [reagrupando, setReagrupando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const reagrupar = async () => {
    if (!marca?.id) return;
    setReagrupando(true); setErro(null);
    const { data, error } = await supabase.rpc("ci_rebuild_concepts", { p_brand_id: marca.id });
    setReagrupando(false);
    if (error) { setErro(`Reagrupamento falhou: ${error.message}`); return; }
    const r = Array.isArray(data) ? data[0] : data;
    if (r?.anuncios_sem_sinal > 0) {
      // Não é erro, mas o usuário precisa saber que parte da base ficou fora —
      // senão a soma das receitas não bate com o total de anúncios e parece bug.
      setErro(`${r.anuncios_sem_sinal} anúncio(s) ficaram fora: a análise não ` +
              `extraiu ângulo, mecanismo nem prova deles. Sem nenhum dos três não ` +
              `há assinatura para agrupar.`);
    }
    await carregar(marca.id);
  };

  // ── Agregações ────────────────────────────────────────────────────────────
  // ── Por que os vínculos de demonstração são excluídos ────────────────────
  // O anúncio semeado para provar o pipeline (Big Buck Bunny) tem is_demo
  // marcado na LINHA DELE, mas os termos que a análise extraiu dele não têm
  // marca nenhuma. Sem este filtro, "Coelho animado deitado na grama" aparecia
  // na lista de hooks da Shapermint como se fosse um hook da marca — dado de
  // demonstração misturado em silêncio com dado real, que é justamente o que
  // não pode acontecer.
  //
  // Excluir e não etiquetar: um hook de teste no meio da lista, mesmo com selo,
  // ainda desloca contagem e ordenação. Ele não pertence à análise da marca —
  // pertence ao histórico de como o sistema foi testado.
  const idsDemo = new Set(((d?.ads ?? []) as Row[]).filter(a => a.is_demo).map(a => a.id));
  const vinculosReais = ((d?.vinculos ?? []) as Row[]).filter(v => !idsDemo.has(v.ad_id));

  const termosDe = (...kinds: string[]): Row[] => ((d?.termos ?? []) as Row[])
    .filter(t => kinds.includes(t.kind))
    .map((t): Row => ({ ...t, usos: vinculosReais.filter(v => v.term_id === t.id).length }))
    // Termo que só existia por causa do anúncio de demonstração some da lista
    // em vez de aparecer com zero — zero aqui seria ruído, não informação.
    .filter(t => t.usos > 0)
    .sort((a, b) => b.usos - a.usos);

  const ads: Row[] = d?.ads ?? [];
  const assets: Row[] = d?.assets ?? [];
  const hooks = termosDe("hook", "hook_written", "hook_visual");
  const problemas = termosDe("objection");
  const promessas = termosDe("promise");
  const provas = termosDe("proof");
  const estilos = termosDe("visual_style");
  const conceitos: Row[] = d?.conceitos ?? [];
  const pessoas: Row[] = d?.pessoas ?? [];

  const analisados = assets.filter(a => a.analysis_status === "completed").length;
  const cobertura = assets.length ? Math.round((analisados / assets.length) * 100) : 0;
  const ativos = ads.filter(a => a.is_active).length;
  const demo = ads.filter(a => a.is_demo).length;
  const semReal = ads.length - demo === 0;
  const maxHook = Math.max(1, ...hooks.map(h => h.usos));

  // ── Estruturas de roteiro ─────────────────────────────────────────────────
  //
  // A sequência de FUNÇÕES de cena de cada anúncio — problema → produto →
  // demonstração → CTA — e quantos anúncios repetem cada sequência.
  //
  // Calculado aqui e não em SQL de propósito: os dados já vieram na carga da
  // página, então uma função no banco seria uma ida a mais à rede e mais uma
  // migration para o usuário colar. Se um dia isto precisar rodar sobre
  // milhares de anúncios, vira SQL; com dezenas, não paga o custo.
  //
  // Cenas consecutivas com a MESMA função viram uma só: um anúncio com três
  // cenas seguidas de demonstração conta "demonstração" uma vez. Sem isso,
  // dois anúncios com a mesma estrutura e cortes diferentes seriam estruturas
  // diferentes — e o painel mostraria variação onde não há.
  const ROTULO_CENA: Record<string, string> = {
    hook: "Hook", problem: "Problema", product: "Produto",
    demonstration: "Demonstração", proof: "Prova", benefit: "Benefício",
    offer: "Oferta", objection: "Objeção", solution: "Solução",
    testimonial: "Depoimento", cta: "CTA", close: "Fechamento",
  };
  const estruturas = (() => {
    // Mesmo motivo dos termos: a estrutura de cena do vídeo de demonstração
    // não é uma estrutura de roteiro da marca.
    //
    // Exclui o asset só quando ele NÃO tem nenhum vínculo real. A deduplicação
    // é por SHA-256, então o mesmo vídeo pode estar num anúncio de demonstração
    // e num anúncio de verdade; nesse caso ele é dado real e fica.
    const assetsReais = new Set(vinculosReais.map(v => v.asset_id));
    const assetsDemo = new Set(
      ((d?.vinculos ?? []) as Row[])
        .filter(v => idsDemo.has(v.ad_id) && !assetsReais.has(v.asset_id))
        .map(v => v.asset_id));
    const porAd = new Map<string, { ordem: number; f: string }[]>();
    for (const c of (d?.cenas ?? []) as Row[]) {
      if (!c.scene_function || assetsDemo.has(c.asset_id)) continue;
      const lista = porAd.get(c.asset_id) ?? [];
      lista.push({ ordem: Number(c.scene_index ?? 0), f: String(c.scene_function) });
      porAd.set(c.asset_id, lista);
    }
    const contagem = new Map<string, { passos: string[]; assets: number }>();
    for (const [, cenas] of porAd) {
      const passos: string[] = [];
      for (const c of cenas.sort((a, b) => a.ordem - b.ordem)) {
        if (passos[passos.length - 1] !== c.f) passos.push(c.f);
      }
      if (passos.length < 2) continue;  // um passo só não é estrutura
      const chave = passos.join(">");
      const atual = contagem.get(chave);
      if (atual) atual.assets++;
      else contagem.set(chave, { passos, assets: 1 });
    }
    return [...contagem.values()].sort((a, b) => b.assets - a.assets);
  })();


  // ── Receitas prontas para a tabela ────────────────────────────────────────
  // Cada coluna do mapa sai de dado real ou é marcada como não disponível.
  // Nenhuma é preenchida por estimativa.
  const membros: Row[] = d?.membros ?? [];
  const maxReceita = Math.max(1, ...conceitos.map(c => c.ad_count ?? 0));
  const ordenadas = [...conceitos]
    .sort((a, b) => (b.ad_count ?? 0) - (a.ad_count ?? 0))
    .map((c): Row => {
      const meus = membros.filter(m => m.concept_id === c.id);
      const adIds = new Set(meus.map(m => m.ad_id));
      const assetIds = new Set(
        vinculosReais.filter((v: Row) => adIds.has(v.ad_id)).map((v: Row) => v.asset_id),
      );
      const duracoes = assets
        .filter(a => assetIds.has(a.id) && a.duration_seconds)
        .map(a => Number(a.duration_seconds));
      // Hook dominante DA RECEITA: o hook mais usado entre os anúncios dela —
      // e não o hook global, que diria a mesma coisa em toda linha.
      const hooksDaReceita = hooks
        .map(h => ({
          label: h.label,
          n: vinculosReais.filter((v: Row) => v.term_id === h.id && adIds.has(v.ad_id)).length,
        }))
        .filter(h => h.n > 0)
        .sort((a, b) => b.n - a.n);
      return {
        ...c,
        motivos: (meus[0]?.match_reasons as string[] | undefined) ?? [],
        hook: hooksDaReceita[0]?.label ?? null,
        duracao: duracoes.length
          ? `${Math.round(Math.min(...duracoes))}–${Math.round(Math.max(...duracoes))}s`
          : "—",
      };
    });
  const totalEstilo = Math.max(1, estilos.reduce((s, e) => s + e.usos, 0));
  const fatias = estilos.slice(0, 5).map((e, i) => ({
    label: e.label, pct: Math.round((e.usos / totalEstilo) * 100), cor: PALETA[i],
  }));

  // ── Briefing ──────────────────────────────────────────────────────────────
  //
  // Derivado, não gerado. Cada linha é uma leitura direta do que foi observado
  // na receita dominante — o ângulo que ela usa, a estrutura que os anúncios
  // dela repetem, o hook mais frequente, a faixa de duração.
  //
  // Não passa por LLM de propósito. Um modelo escreveria um briefing mais
  // bonito, e ninguém conseguiria dizer de onde saiu cada frase. Aqui, toda
  // linha aponta para um dado que está no banco — e "não observado" aparece
  // como "não observado", em vez de virar recomendação plausível.
  const briefing = (() => {
    const r = ordenadas[0];
    if (!r) return null;
    const est = estruturas[0];
    return {
      receita: r.name,
      ads: r.ad_count ?? 0,
      linhas: [
        { rotulo: "Formato",   valor: estilos[0]?.label ?? null },
        { rotulo: "Duração",   valor: r.duracao !== "—" ? r.duracao : null },
        { rotulo: "Abertura",  valor: r.hook ? `“${r.hook}”` : null },
        { rotulo: "Estrutura", valor: est ? est.passos.map(p => ROTULO_CENA[p] ?? p).join(" → ") : null },
        { rotulo: "Prova",     valor: provas[0]?.label ?? null },
        { rotulo: "CTA",       valor: termosDe("cta")[0]?.label ?? null },
      ],
    };
  })();

  const copiarBriefing = () => {
    if (!briefing) return;
    const texto = [
      `Briefing — ${marca?.name ?? ""}`,
      `Receita: ${briefing.receita} (observada em ${briefing.ads} anúncio(s))`,
      "",
      ...briefing.linhas.map(l => `${l.rotulo}: ${l.valor ?? t("not_observed")}`),
      "",
      "Baseado em sinais públicos de repetição de criativos.",
      "NÃO representa desempenho, ROAS, CPA nem resultado confirmado.",
    ].join("\n");
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2200);
  };

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: "100vh", background: T.bg0, color: T.t1, fontFamily: F, display: "flex" }}>

      {/* ══ Lateral ══════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 215, borderRight: `1px solid ${T.b1}`, padding: "22px 13px",
        display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "0 9px 20px" }}>
          <div style={{ fontSize: 22, fontWeight: 730, letterSpacing: "-.025em" }}>AdBrief</div>
          <div style={{ fontSize: 11.5, color: T.violet, fontWeight: 570, marginTop: 1 }}>Creative Intelligence</div>
        </div>

        <nav style={{ display: "grid", gap: 3 }}>
          {NAV.map(n => {
            const ativo = n.id === "overview";
            const conteudo = (
              <div style={{
                display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
                borderRadius: 9, fontSize: 13.5,
                background: ativo ? "rgba(139,92,246,.13)" : "transparent",
                border: `1px solid ${ativo ? "rgba(139,92,246,.28)" : "transparent"}`,
                color: ativo ? T.t1 : n.pronto ? T.t2 : T.label,
                cursor: n.href ? "pointer" : "default",
              }}>
                <Ic d={n.icon} s={16} c={ativo ? T.violet : "currentColor"} />
                <span style={{ flex: 1 }}>{t(n.k)}</span>
                {!n.pronto && <span style={{ fontSize: 9, color: T.violet, opacity: .8 }}>{t("nav_soon")}</span>}
              </div>
            );
            return n.href
              ? <a key={n.id} href={n.href} style={{ textDecoration: "none" }}>{conteudo}</a>
              : <div key={n.id}>{conteudo}</div>;
          })}
        </nav>

        <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
          <a href="/ci/qualidade" style={{
            display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
            borderRadius: 8, fontSize: 12.6, color: T.t3, textDecoration: "none",
            border: `1px solid ${T.b1}`, marginBottom: 6,
          }}>
            <Ic d={I.check} s={14} c={T.t3} /> {t("nav_quality")}
          </a>
          <a href="/ci/saude" style={{
            display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
            borderRadius: 8, fontSize: 12.6, color: T.t3, textDecoration: "none",
            border: `1px solid ${T.b1}`,
          }}>
            <Ic d={I.shield} s={14} c={T.t3} /> {t("nav_health")}
          </a>
          <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "0 9px" }}>
            <Ic d={I.spark} s={17} c={T.violet} />
            <div style={{ fontSize: 12.2, color: T.t3, lineHeight: 1.45 }}>
              {t("tagline").split("\n")[0]}<br />{t("tagline").split("\n")[1]}
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "11px 9px",
            borderTop: `1px solid ${T.b1}`,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9, background: "rgba(139,92,246,.18)",
              display: "grid", placeItems: "center", color: T.violet, fontWeight: 700, fontSize: 13,
            }}>C</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.8, fontWeight: 600 }}>Creative Team</div>
              <div style={{ fontSize: 11, color: T.t3 }}>Plano Pro</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══ Conteúdo ═════════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* A barra fica FORA do padding e grudada no topo: rolar a página não
            pode esconder o estado da fila, que é a informação que responde
            "posso confiar no que estou vendo agora?". */}
        <BarraStatus brandId={marca?.id} en={en} />
        <div style={{ padding: "12px 22px 34px" }}>

        {/* ── Topo ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: "rgba(139,92,246,.18)",
            display: "grid", placeItems: "center", color: T.violet, fontWeight: 750, fontSize: 15,
          }}>{(marca?.name ?? "?")[0]}</div>

          <select
            value={marca?.id ?? ""}
            onChange={e => setMarca(marcas.find(m => m.id === e.target.value) ?? null)}
            style={{
              background: "transparent", border: "none", color: T.t1,
              fontSize: 19, fontWeight: 660, fontFamily: F, cursor: "pointer", outline: "none",
              letterSpacing: "-.01em",
            }}>
            {marcas.length === 0 && <option>Nenhuma marca</option>}
            {marcas.map(m => <option key={m.id} value={m.id} style={{ background: T.bg2 }}>{m.name}</option>)}
          </select>

          <div style={{ display: "flex", gap: 9, marginLeft: "auto", flexWrap: "wrap", alignItems: "center" }}>
            <Pilula dot={ativos ? T.green : T.label}>
              {ativos > 0 ? `${ativos} ativos agora` : "Nenhum ativo"}
            </Pilula>
            <Pilula icon={I.globe}>{marca?.market ?? "—"}</Pilula>
            <Pilula icon={I.chat}>{marca?.language ?? "—"}</Pilula>
            <SeletorIdioma />
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.3, color: T.t3 }}>
              <Ic d={I.refresh} s={14} c={T.t3} />
              {d?.run
                ? `Última sincronização ${new Date(d.run.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : "Nunca sincronizado"}
            </div>
          </div>
        </div>

        {erro && (
          <Card style={{ borderColor: "rgba(248,113,113,.4)", marginBottom: 14 }}>
            <div style={{ color: T.red, fontSize: 13.3 }}>{erro}</div>
          </Card>
        )}

        {carregando && <div style={{ color: T.t3, fontSize: 13.5, padding: 20 }}>Carregando…</div>}

        {!carregando && marcas.length === 0 && (
          <Card>
            <Falta motivo="Nenhuma marca cadastrada. O painel liga sozinho assim que a primeira importação terminar."
              acao={<a href="/importar" style={{ color: T.blue, fontSize: 13.2 }}>Importar uma marca →</a>} />
          </Card>
        )}

        {!carregando && d && marca && (
          <>
            {semReal && (
              <Card style={{ borderColor: "rgba(251,191,36,.38)", background: "rgba(251,191,36,.045)", marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                  <Ic d={I.warn} s={17} c={T.yellow} />
                  <div>
                    <div style={{ color: T.yellow, fontWeight: 620, fontSize: 13.6, marginBottom: 4 }}>
                      Esta marca ainda não tem anúncio real
                    </div>
                    <div style={{ color: T.t2, fontSize: 13, lineHeight: 1.58 }}>
                      {demo > 0
                        ? `Os ${demo} registros existentes são de DEMONSTRAÇÃO, semeados para provar o pipeline. Todo número abaixo vem deles — não da ${marca.name}.`
                        : "Nada foi importado ainda."}{" "}
                      <a href="/importar" style={{ color: T.blue }}>Importar de verdade →</a>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* ── KPIs ──────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginBottom: 13 }}>
              <Kpi icon={I.search} cor={T.violet} label={t("kpi_active")} valor={ativos}
                   apagado={!ativos} hint="Criativos da biblioteca pública. Não é gasto nem impressão." />
              <Kpi icon={I.layers} cor={T.blue} label={t("kpi_assets")} valor={assets.length}
                   apagado={!assets.length} hint="Vídeos distintos por SHA-256. O mesmo vídeo em 5 anúncios conta 1." />
              <Kpi icon={I.bulb} cor={T.green} label={t("kpi_recipes")} valor={conceitos.length}
                   apagado={!conceitos.length} hint="Agrupamento de anúncios que contam a mesma ideia." />
              <Kpi icon={I.person} cor={T.orange} label={t("kpi_people")} valor={pessoas.length}
                   apagado={!pessoas.length} hint="Grupos anônimos. Nunca identificamos quem é." />
              <Kpi icon={I.shield} cor={T.teal} label={t("kpi_coverage")} valor={cobertura} sufixo="%"
                   apagado={!cobertura} hint="Assets com análise concluída sobre o total." />
            </div>

            {/* ── Linha 2 ───────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.62fr 1fr", gap: 12, marginBottom: 12 }}>

              <Card>
                <Head hint="Anúncios diferentes que contam a mesma ideia. A barra mostra quanto cada receita se repete." selo={selo("receita")}>
                  {t("panel_repeats")}
                </Head>
                {conceitos.length === 0 ? (
                  <Falta motivo={
                    assets.length === 0
                      ? "Nenhum anúncio analisado ainda. As receitas saem do agrupamento dos anúncios por ângulo, mecanismo e prova."
                      : "Nenhuma receita montada ainda para estes anúncios. Reagrupe para construir."
                  } acao={
                    <button onClick={reagrupar} disabled={reagrupando || !assets.length} style={{
                      background: assets.length ? T.violet : T.bg3,
                      color: assets.length ? "#0B0713" : T.t3,
                      border: "none", borderRadius: 9, padding: "10px 17px",
                      fontSize: 13, fontWeight: 640, fontFamily: F,
                      cursor: assets.length ? "pointer" : "not-allowed",
                    }}>{reagrupando ? t("grouping") : t("build_recipes")}</button>
                  } />
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.7 }}>
                    <thead>
                      <tr style={{ color: T.label, fontSize: 11, textAlign: "left" }}>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>#</th>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>Receita criativa</th>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>Assets</th>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}
                            title="Quantos valores distintos a marca testou nos eixos que ela variou">
                          Variações
                        </th>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>Pessoas</th>
                        <th style={{ padding: "0 8px 10px 0", fontWeight: 600 }}>Duração</th>
                        {/* Presença por ÚLTIMO, de propósito: um rótulo na
                            primeira coluna é lido como nota de desempenho, e
                            desempenho é o que não temos. Os números brutos vêm
                            antes para ancorar a leitura. */}
                        <th style={{ padding: "0 0 10px 0", fontWeight: 600 }}>Presença</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(prioridade ?? ordenadas).slice(0, 6).map((c: Row, i: number) => {
                        const usandoRpc = prioridade != null;
                        const nome = usandoRpc ? c.nome : c.name;
                        const assets = usandoRpc ? c.assets_unicos : (c.unique_asset_count ?? 0);
                        const dur = usandoRpc
                          ? (c.duracao_min_s != null
                              ? `${c.duracao_min_s}–${c.duracao_max_s}s` : "—")
                          : c.duracao;
                        return (
                        <tr key={usandoRpc ? c.concept_id : c.id} style={{ borderTop: `1px solid ${T.b1}` }}>
                          <td style={{ padding: "11px 8px 11px 0" }}>
                            <div style={{
                              width: 22, height: 22, borderRadius: "50%", background: T.bg3,
                              display: "grid", placeItems: "center", fontSize: 11, color: T.violet, fontWeight: 700,
                            }}>{i + 1}</div>
                          </td>
                          <td style={{ padding: "11px 8px 11px 0", color: T.t1, maxWidth: 210 }}>
                            {nome}
                            {usandoRpc && c.hook_dominante && (
                              <div title={`Hook mais frequente desta receita: ${c.hook_dominante}`}
                                   style={{ fontSize: 10.8, color: T.t3, marginTop: 3,
                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                “{c.hook_dominante}”
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "11px 8px 11px 0", color: T.t1, fontVariantNumeric: "tabular-nums" }}>
                            {assets}
                          </td>
                          <td style={{ padding: "11px 8px 11px 0", fontVariantNumeric: "tabular-nums" }}>
                            {usandoRpc ? (
                              c.variacoes > 0 ? (
                                <span title={`${c.variacoes} valores distintos em ${c.eixos_variados} eixo(s); ${c.eixos_mantidos} eixo(s) mantido(s)`}
                                      style={{ color: T.violet }}>
                                  {c.variacoes}
                                </span>
                              ) : (
                                <span title="Nenhum eixo variou: as execuções são muito próximas, ou a análise não capturou a diferença"
                                      style={{ color: T.label }}>0</span>
                              )
                            ) : <span style={{ color: T.label }}>—</span>}
                          </td>
                          <td style={{ padding: "11px 8px 11px 0", color: T.t2 }}>
                            <span style={{ color: T.label }}
                                  title="Agrupamento de pessoas ainda não construído">n/d</span>
                          </td>
                          <td style={{ padding: "11px 8px 11px 0", color: T.t2 }}>{dur}</td>
                          <td style={{ padding: "11px 0", maxWidth: 150 }}>
                            {usandoRpc ? (
                              <span title={`${c.presenca_motivo}. Presença é repetição observada, não desempenho.`}
                                    style={{
                                      fontSize: 11.4, fontWeight: 620,
                                      color: c.presenca === "muito alta" ? T.violet
                                           : c.presenca === "alta" ? T.blue
                                           : c.presenca === "média" ? T.t2 : T.label,
                                    }}>
                                {c.presenca}
                                <div style={{ fontSize: 10.2, color: T.label, fontWeight: 500, marginTop: 1 }}>
                                  {c.share_pct}% dos assets
                                </div>
                              </span>
                            ) : <Repeticao n={c.ad_count ?? 0} max={maxReceita} cor={T.violet} />}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {erroPrioridade && (
                  <div style={{
                    marginTop: 11, fontSize: 11.6, color: T.yellow,
                    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.26)",
                    borderRadius: 8, padding: "7px 10px",
                  }}>
                    Colunas de variação e presença indisponíveis ({erroPrioridade}). A tabela
                    caiu para o cálculo antigo, feito no navegador — os números de Assets e
                    Duração continuam corretos, Variações aparece como “—”.
                  </div>
                )}
                {conceitos.length > 0 && (
                  <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={reagrupar} disabled={reagrupando} style={{
                      background: "transparent", color: T.t2, border: `1px solid ${T.b2}`,
                      borderRadius: 8, padding: "7px 13px", fontSize: 12.3, fontFamily: F,
                      cursor: reagrupando ? "wait" : "pointer",
                    }}>{reagrupando ? t("grouping") : t("regroup")}</button>
                    <span style={{ fontSize: 11.8, color: T.t3 }}>
                      Agrupado por ângulo e mecanismo. Hook e prova ficam de fora: são execução, não ideia — e aparecem como eixos de variação.
                    </span>
                  </div>
                )}
              </Card>

              <Card>
                <Head hint="Distribuição dos estilos visuais que o modelo identificou, com evidência." selo={selo("formato")}>
                  {t("panel_mix")}
                </Head>
                {fatias.length === 0 ? (
                  <Falta motivo={semReal
                    ? "Nenhum anúncio real analisado. O estilo visual sai da análise de cada vídeo."
                    : "Os vídeos analisados não produziram classificação de estilo visual com evidência."} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <Donut fatias={fatias} />
                    <div style={{ flex: 1, display: "grid", gap: 9 }}>
                      {fatias.map(f => (
                        <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: f.cor }} />
                          <span style={{ flex: 1, color: T.t2 }}>{f.label}</span>
                          <span style={{ fontWeight: 640, fontVariantNumeric: "tabular-nums" }}>{f.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* ── Linha 3 ───────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>

              <Card>
                <Head hint="A sequência de funções de cena que mais se repete: problema → produto → demonstração → CTA." selo={selo("estrutura")}>
                  {t("panel_scripts")}
                </Head>
                {estruturas.length === 0 ? (
                  <Falta motivo={
                    (d?.cenas ?? []).length === 0
                      ? "Nenhum anúncio analisado ainda. A estrutura sai da função de cada cena, que o modelo identifica no vídeo."
                      : "As cenas analisadas não receberam função (hook, problema, demonstração, CTA). Sem função não há sequência para comparar."
                  } />
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {estruturas.slice(0, 4).map((e, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {e.passos.map((p, j) => (
                            <span key={j} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{
                                fontSize: 11.3, color: T.t2, background: T.bg2,
                                border: `1px solid ${T.b1}`, borderRadius: 7, padding: "5px 9px",
                                whiteSpace: "nowrap",
                              }}>{ROTULO_CENA[p] ?? p}</span>
                              {j < e.passos.length - 1 && <Ic d={I.arrow} s={11} c={T.label} />}
                            </span>
                          ))}
                        </div>
                        <div style={{ textAlign: "right", minWidth: 46 }}>
                          <div style={{ fontSize: 13, fontWeight: 640, fontVariantNumeric: "tabular-nums" }}>{e.assets}</div>
                          <div style={{ fontSize: 9.5, color: T.label }}>assets</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11.3, color: T.t3, lineHeight: 1.5 }}>
                      Cenas seguidas com a mesma função contam uma vez — senão o mesmo roteiro
                      com cortes diferentes viraria duas estruturas.
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <Head hint="Cada hook carrega a evidência que o sustenta: a fala, o texto na tela ou o frame." selo={selo("hook")}>
                  {t("panel_hooks")}
                </Head>
                {hooks.length === 0 ? (
                  <Falta motivo={semReal
                    ? "Sem anúncio real analisado não há hook para contar. O worker preenche isto sozinho depois da importação."
                    : "Os vídeos analisados não produziram hook com evidência — e item sem evidência é descartado de propósito."}
                    acao={<a href="/importar" style={{ color: T.blue, fontSize: 12.8 }}>Importar uma marca →</a>} />
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {hooks.slice(0, 5).map(h => {
                      const ev = ((d.vinculos as Row[]).find(v => v.term_id === h.id) || {}).evidence;
                      return (
                        <div key={h.id} style={{ background: T.bg2, borderRadius: 9, padding: "10px 11px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                            <Ic d={I.chat} s={14} c={T.t3} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.9, lineHeight: 1.4 }}>“{h.label}”</div>
                              {ev && <div style={{ fontSize: 11.2, color: T.t3, marginTop: 4 }}>{String(ev).slice(0, 80)}</div>}
                            </div>
                            <div style={{ fontSize: 12, color: T.t2, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                              {h.usos}<div style={{ fontSize: 10, color: T.label }}>assets</div>
                            </div>
                          </div>
                          <div style={{ marginTop: 7 }}><Repeticao n={h.usos} max={maxHook} cor={T.blue} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <Head hint="Agrupamento anônimo por aparência recorrente. Nunca identificamos a pessoa.">
                  {t("panel_people")}
                </Head>
                {pessoas.length === 0 ? (
                  <Falta pendente motivo={
                    "O agrupamento de pessoas ainda não foi escrito. Quando for, cada grupo vem com " +
                    "identificador anônimo (PERSON_014) e só o que dá para observar: em quantos criativos " +
                    "aparece, duração média, formato. Nunca nome, etnia, idade ou qualquer atributo sensível."
                  } />
                ) : (
                  <div style={{ display: "grid", gap: 9 }}>
                    {pessoas.slice(0, 3).map(p => (
                      <div key={p.id} style={{ background: T.bg2, borderRadius: 9, padding: "11px 12px" }}>
                        <div style={{ fontSize: 12.9, fontWeight: 620 }}>{p.label}</div>
                        <div style={{ fontSize: 11.4, color: T.t3, marginTop: 3 }}>{p.asset_count} assets</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* ── Linha 4 ───────────────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12 }}>

              <Card>
                <Head hint="O que a marca diz que resolve, o que promete e com o que prova." selo={selo("proof")}>
                  {t("panel_messages")}
                </Head>
                {/* Aviso de bloco, e não só selo: este painel é o que mais vira
                    briefing, e prova é o campo que o modelo mais erra. Só
                    aparece quando a acurácia medida está abaixo de 70%. */}
                <AvisoConfianca campo="proof" mapa={acuracia} en={en} />
                {problemas.length + promessas.length + provas.length === 0 ? (
                  <Falta motivo={semReal
                    ? "Sem anúncio real analisado. Este mapa vem das objeções, promessas e provas que o modelo extrai de cada vídeo — sempre com a evidência junto."
                    : "Os vídeos analisados não produziram objeção, promessa ou prova com evidência."} />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                    {([["Problemas", problemas, T.red, I.warn],
                       ["Promessas", promessas, T.green, I.check],
                       ["Provas", provas, T.blue, I.shield]] as const).map(([titulo, lista, cor, icone]) => (
                      <div key={titulo}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <Ic d={icone} s={13} c={cor} />
                          <span style={{ fontSize: 12.4, color: cor, fontWeight: 620 }}>{titulo}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {lista.length === 0
                            ? <span style={{ fontSize: 12, color: T.label }}>nenhum identificado</span>
                            : lista.slice(0, 6).map(x => (
                              <span key={x.id} title={`${x.usos} anúncio(s)`} style={{
                                fontSize: 12, color: T.t2, background: `${cor}12`,
                                border: `1px solid ${cor}33`, borderRadius: 20, padding: "5px 11px",
                              }}>{x.label}</span>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <Head hint="A receita dominante convertida em instruções de roteiro." selo={selo("receita")}>
                  {t("panel_brief")}
                </Head>
                {!briefing ? (
                  <Falta motivo={
                    "O briefing é a receita dominante virada em instrução. Sem receita montada não " +
                    "há de onde tirar — e escrever um roteiro plausível aqui seria inventar e chamar " +
                    "de análise."
                  } />
                ) : (
                  <>
                    <div style={{ fontSize: 12.4, color: T.t3, marginBottom: 12, lineHeight: 1.5 }}>
                      Da receita <span style={{ color: T.t1 }}>{briefing.receita}</span>, observada em{" "}
                      {briefing.ads} anúncio{briefing.ads === 1 ? "" : "s"}.
                    </div>
                    <div style={{ display: "grid", gap: 8, marginBottom: 15 }}>
                      {briefing.linhas.map(l => (
                        <div key={l.rotulo} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.8 }}>
                          <Ic d={l.valor ? I.check : I.warn} s={13} c={l.valor ? T.green : T.label} />
                          <span style={{ color: T.label, minWidth: 62 }}>{l.rotulo}</span>
                          <span style={{ flex: 1, color: l.valor ? T.t2 : T.label }}>
                            {/* "não observado" e não um palpite: a lacuna é informação. */}
                            {l.valor ?? t("not_observed")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button onClick={copiarBriefing} style={{
                      background: T.violet, color: "#0B0713", border: "none", borderRadius: 9,
                      padding: "10px 17px", fontSize: 13, fontWeight: 640, fontFamily: F,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <Ic d={I.spark} s={14} c="#0B0713" />
                      {copiado ? t("copied") : t("copy_brief")}
                    </button>
                  </>
                )}
              </Card>
            </div>

            {/* ── Rodapé ────────────────────────────────────────────────────── */}
            <div style={{
              marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.b1}`,
              display: "flex", gap: 9, alignItems: "flex-start",
              fontSize: 12.1, color: T.t3, lineHeight: 1.55,
            }}>
              <Ic d={I.warn} s={14} c={T.t3} />
              <div>
                Os dados refletem sinais públicos de criativos e repetição — quantos anúncios a marca
                colocou no ar e o que se repete entre eles.{" "}
                <strong style={{ color: T.t2 }}>Não representam desempenho, ROAS, CPA ou resultados
                confirmados</strong>, e não vêm da conta de anúncios de ninguém.
              </div>
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  );
}
