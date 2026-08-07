/**
 * /ci/receitas — as ideias da marca, e o que muda entre as execuções
 *
 * ── O que esta tela responde ──────────────────────────────────────────────
 * "O que essa marca faz repetidamente?" — que é a pergunta que separa uma
 * biblioteca de anúncios analisados de uma ferramenta de estratégia.
 *
 * Abrir uma receita mostra três coisas, nesta ordem de importância:
 *
 *   1. POR QUE estes anúncios estão juntos (os match_reasons gravados)
 *   2. O QUE eles têm em comum
 *   3. O QUE MUDA entre eles — os eixos que a marca testou
 *
 * O item 3 é o ouro. "Mantiveram ângulo e prova, testaram 6 hooks e 3
 * durações" é leitura estratégica; "existem 6 anúncios" é inventário.
 *
 * ── O que ela NÃO faz ─────────────────────────────────────────────────────
 * Não diz qual variação funcionou melhor. Não temos essa informação e não
 * vamos inferir de tempo no ar — anúncio antigo pode estar no ar por inércia.
 * A tela mostra o que foi testado, não o que venceu.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  b1: "rgba(240,246,252,0.07)", b2: "rgba(240,246,252,0.12)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  blue: "#0ea5e9", green: "#4ADE80", red: "#F87171", yellow: "#FBBF24",
  violet: "#A78BFA", teal: "#2DD4BF",
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
type Row = Record<string, any>;

const KIND_ROTULO: Record<string, string> = {
  hook: "Hook", hook_visual: "Hook visual", hook_written: "Hook escrito",
  angle: "Ângulo", promise: "Promessa", proof: "Prova", demonstration: "Demonstração",
  objection: "Objeção", offer: "Oferta", cta: "CTA", mechanism: "Mecanismo",
  visual_style: "Estilo visual", story_structure: "Estrutura", scenario: "Cenário",
};

/** Eixos que interessam ver variando dentro de uma receita. */
const EIXOS_VARIACAO = ["hook", "hook_written", "hook_visual", "offer", "cta",
                        "visual_style", "scenario"] as const;

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 13,
    padding: 18, marginBottom: 14, ...style,
  }}>{children}</div>
);

const Vazio = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: T.bg2, border: `1px dashed ${T.b2}`, borderRadius: 9,
    padding: "14px 15px", fontSize: 12.8, color: T.t2, lineHeight: 1.55,
  }}>{children}</div>
);

export default function CreativeRecipes() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);
  const [d, setD] = useState<Row | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas } = await supabase
        .from("ci_brands").select("id,name,slug").order("created_at");
      const b = (marcas ?? [])[0];
      if (!b) { setMarca(null); return; }
      setMarca(b);

      const pega = async (tabela: string, sel: string): Promise<Row[]> => {
        const { data, error } = await supabase.from(tabela as never)
          .select(sel).eq("brand_id", b.id);
        if (error) throw new Error(`${tabela}: ${error.message}`);
        return (data ?? []) as Row[];
      };

      const [conceitos, membros, vinculos, termos, ads, assets] = await Promise.all([
        pega("ci_concepts",
          "id,name,description,confidence,ad_count,unique_asset_count,longevity_days,is_active,baseline_ad_id,review_status"),
        pega("ci_concept_members", "concept_id,ad_id,match_reasons,is_baseline"),
        pega("ci_ad_taxonomy", "ad_id,term_id,asset_id,evidence,confidence"),
        pega("ci_taxonomy_terms", "id,kind,label,slug"),
        pega("ci_ads", "id,ad_archive_id,headline,is_active,running_days,started_on,is_demo"),
        pega("ci_assets", "id,duration_seconds"),
      ]);

      setD({ conceitos, membros, vinculos, termos, ads, assets });
    } catch (e: any) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const termo = (id: string): Row | undefined =>
    ((d?.termos ?? []) as Row[]).find(t => t.id === id);

  /**
   * O que se repete e o que varia dentro de uma receita.
   *
   * Um eixo com UM valor em todos os anúncios é o que a marca manteve fixo.
   * Com vários, é o que ela testou. A distinção é a leitura estratégica
   * inteira: ninguém quer saber que existem 6 anúncios — quer saber que os 6
   * mantêm o mesmo argumento e trocam a abertura.
   */
  const analisar = (conceptId: string) => {
    const meus = ((d?.membros ?? []) as Row[]).filter(m => m.concept_id === conceptId);
    const adIds = new Set(meus.map(m => m.ad_id));
    const ads = ((d?.ads ?? []) as Row[]).filter(a => adIds.has(a.id));
    const vinc = ((d?.vinculos ?? []) as Row[]).filter(v => adIds.has(v.ad_id));

    const porEixo = new Map<string, Map<string, Set<string>>>();  // kind → label → adIds
    for (const v of vinc) {
      const t = termo(v.term_id);
      if (!t) continue;
      const mapa = porEixo.get(t.kind) ?? new Map<string, Set<string>>();
      const conj = mapa.get(t.label) ?? new Set<string>();
      conj.add(v.ad_id);
      mapa.set(t.label, conj);
      porEixo.set(t.kind, mapa);
    }

    const fixos: Array<{ kind: string; label: string }> = [];
    const variados: Array<{ kind: string; valores: Array<{ label: string; n: number }> }> = [];
    for (const [kind, mapa] of porEixo) {
      const valores = [...mapa.entries()]
        .map(([label, conj]) => ({ label, n: conj.size }))
        .sort((a, b) => b.n - a.n);
      // Fixo = um valor só, presente em TODOS os anúncios da receita. Um valor
      // só presente em metade não é "mantido", é "só metade tinha".
      if (valores.length === 1 && valores[0].n === ads.length && ads.length > 1) {
        fixos.push({ kind, label: valores[0].label });
      } else if (valores.length > 1) {
        variados.push({ kind, valores });
      }
    }

    const duracoes = ads.length
      ? ((d?.assets ?? []) as Row[])
          .filter(a => vinc.some(v => v.asset_id === a.id) && a.duration_seconds)
          .map(a => Number(a.duration_seconds))
      : [];

    return {
      ads: ads.sort((a, b) => (b.running_days ?? 0) - (a.running_days ?? 0)),
      motivos: (meus[0]?.match_reasons as string[] | undefined) ?? [],
      fixos,
      // Só os eixos que interessam ver variando, e ordenados por quantas
      // execuções diferentes tiveram.
      variados: variados
        .filter(v => (EIXOS_VARIACAO as readonly string[]).includes(v.kind))
        .sort((a, b) => b.valores.length - a.valores.length),
      duracoes,
    };
  };

  const conceitos = ((d?.conceitos ?? []) as Row[])
    .sort((a, b) => (b.ad_count ?? 0) - (a.ad_count ?? 0));

  return (
    <div style={{ minHeight: "100vh", background: T.bg0, color: T.t1, fontFamily: F, padding: "24px 22px 40px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <a href="/ci" style={{ color: T.blue, fontSize: 13.3, textDecoration: "none" }}>← Visão geral</a>

        <div style={{ margin: "14px 0 20px" }}>
          <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
            Receitas criativas{marca ? ` · ${marca.name}` : ""}
          </h1>
          <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 680 }}>
            Cada receita é um conjunto de anúncios que contam a mesma ideia. Abrir uma
            mostra o que a marca manteve fixo e o que ela testou — que é a leitura
            que interessa.
          </p>
        </div>

        {erro && <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: T.red, fontSize: 13.3 }}>{erro}</div></Card>}
        {carregando && <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>}

        {!carregando && conceitos.length === 0 && (
          <Card>
            <Vazio>
              Nenhuma receita montada. Volte à <a href="/ci" style={{ color: T.blue }}>visão geral</a> e
              clique em <strong>Montar receitas</strong> — o agrupamento não roda sozinho,
              porque reconstruir apaga o que foi gerado por máquina e isso deve ser
              uma decisão, não um efeito colateral de abrir a página.
            </Vazio>
          </Card>
        )}

        {conceitos.map(c => {
          const a = analisar(c.id);
          const abertaAqui = aberta === c.id;
          return (
            <Card key={c.id} style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setAberta(abertaAqui ? null : c.id)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  padding: "16px 18px", cursor: "pointer", fontFamily: F, color: T.t1,
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 640, marginBottom: 5 }}>
                    {c.name}
                    {c.review_status === "confirmed" && (
                      <span style={{ fontSize: 10, color: T.green, marginLeft: 8 }}>confirmada</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.2, color: T.t3, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <span>{c.ad_count} anúncio{c.ad_count === 1 ? "" : "s"}</span>
                    {a.variados.length > 0 && (
                      <span style={{ color: T.violet }}>
                        {a.variados.length} eixo{a.variados.length === 1 ? "" : "s"} testado{a.variados.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {c.longevity_days > 0 && <span>{c.longevity_days} dias no ar</span>}
                  </div>
                </div>
                <span style={{ color: T.t3, fontSize: 18 }}>{abertaAqui ? "−" : "+"}</span>
              </button>

              {abertaAqui && (
                <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${T.b1}` }}>

                  {a.motivos.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".07em", color: T.label, fontWeight: 660, marginBottom: 7 }}>
                        POR QUE ESTÃO JUNTOS
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {a.motivos.map((m, i) => (
                          <span key={i} style={{
                            fontSize: 12, color: T.t2, background: "rgba(167,139,250,.08)",
                            border: "1px solid rgba(167,139,250,.28)", borderRadius: 7, padding: "5px 10px",
                          }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.fixos.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".07em", color: T.label, fontWeight: 660, marginBottom: 7 }}>
                        MANTIVERAM IGUAL
                      </div>
                      <div style={{ display: "grid", gap: 5 }}>
                        {a.fixos.map((f, i) => (
                          <div key={i} style={{ fontSize: 12.8, display: "flex", gap: 9 }}>
                            <span style={{ color: T.label, minWidth: 96 }}>{KIND_ROTULO[f.kind] ?? f.kind}</span>
                            <span style={{ color: T.teal }}>{f.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.variados.length > 0 ? (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, letterSpacing: ".07em", color: T.label, fontWeight: 660, marginBottom: 7 }}>
                        TESTARAM
                      </div>
                      <div style={{ display: "grid", gap: 11 }}>
                        {a.variados.map(v => (
                          <div key={v.kind}>
                            <div style={{ fontSize: 12.3, color: T.violet, marginBottom: 5 }}>
                              {v.valores.length} {KIND_ROTULO[v.kind]?.toLowerCase() ?? v.kind} diferentes
                            </div>
                            <div style={{ display: "grid", gap: 4 }}>
                              {v.valores.slice(0, 8).map(x => (
                                <div key={x.label} style={{ display: "flex", gap: 10, fontSize: 12.6 }}>
                                  <span style={{ flex: 1, color: T.t2 }}>{x.label}</span>
                                  <span style={{ color: T.t3, fontVariantNumeric: "tabular-nums" }}>
                                    {x.n} anúncio{x.n === 1 ? "" : "s"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : c.ad_count > 1 && (
                    <div style={{ marginTop: 16, fontSize: 12.5, color: T.t3, lineHeight: 1.55 }}>
                      Nenhum eixo variando entre os anúncios desta receita. Ou são execuções
                      muito próximas, ou a análise não capturou a diferença.
                    </div>
                  )}

                  {a.duracoes.length > 1 && (
                    <div style={{ marginTop: 14, fontSize: 12.4, color: T.t3 }}>
                      Duração de {Math.round(Math.min(...a.duracoes))}s a {Math.round(Math.max(...a.duracoes))}s
                    </div>
                  )}

                  <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 11, letterSpacing: ".07em", color: T.label, fontWeight: 660, marginBottom: 8 }}>
                      ANÚNCIOS
                    </div>
                    <div style={{ display: "grid", gap: 5 }}>
                      {a.ads.map(ad => (
                        <a key={ad.id} href={`/ci/anuncio/${ad.id}`} style={{
                          display: "flex", gap: 11, alignItems: "center", textDecoration: "none",
                          background: T.bg2, borderRadius: 8, padding: "9px 12px", fontSize: 12.7,
                          color: T.t2,
                        }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ad.headline || ad.ad_archive_id}
                          </span>
                          {ad.is_demo && <span style={{ fontSize: 10, color: T.yellow }}>DEMO</span>}
                          {ad.is_active && <span style={{ fontSize: 10.5, color: T.green }}>no ar</span>}
                          {ad.running_days != null && (
                            <span style={{ fontSize: 11, color: T.t3 }}>{ad.running_days}d</span>
                          )}
                          <span style={{ color: T.blue, fontSize: 12 }}>inspecionar →</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {conceitos.length > 0 && (
          <div style={{
            marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.b1}`,
            fontSize: 12, color: T.t3, lineHeight: 1.55,
          }}>
            Esta tela mostra o que a marca <strong>testou</strong>, não o que funcionou.
            Não temos dado de performance, e inferir sucesso de tempo no ar seria
            chute — anúncio antigo pode estar no ar por inércia.
          </div>
        )}
      </div>
    </div>
  );
}
