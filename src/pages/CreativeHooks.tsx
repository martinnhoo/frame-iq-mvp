/**
 * /ci/hooks — PADRÕES de hook, não lista de hooks.
 *
 * ── A diferença ───────────────────────────────────────────────────────────
 * Uma lista ("Hook A — 32") você olha e fecha. Um padrão traz o número de
 * assets, em quantas receitas ele aparece, a estrutura de roteiro em que
 * costuma vir, o primeiro frame mais combinado e exemplos com a fala que
 * sustenta cada um — e isso vira briefing no mesmo dia.
 *
 * Cada card responde, nesta ordem: quanto a marca aposta nisso, onde isso
 * costuma aparecer, e me mostra a prova.
 *
 * ── O que a tela NÃO faz ──────────────────────────────────────────────────
 * Não diz que hook funciona. Não temos dado de performance, e ordenar por
 * "melhor" seria inventar. A ordem é por repetição — que é o que sabemos.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { useAcuracia, SeloConfianca, AvisoConfianca } from "@/ci/confianca";
import { T, Card } from "@/ci/tema";

type Row = Record<string, any>;

const TIPO_ROTULO: Record<string, string> = {
  hook: "falado",
  hook_visual: "visual",
  hook_written: "escrito",
};

const FUNCAO_ROTULO: Record<string, string> = {
  hook: "Hook", problem: "Problema", solution: "Solução", product: "Produto",
  demo: "Demonstração", demonstration: "Demonstração", proof: "Prova",
  benefit: "Benefício", offer: "Oferta", cta: "CTA",
};

const traduzEstrutura = (seq: string | null) =>
  !seq ? null : seq.split(" → ").map(f => FUNCAO_ROTULO[f] ?? f).join(" → ");


const Metrica = ({ valor, rotulo, cor }: { valor: React.ReactNode; rotulo: string; cor?: string }) => (
  <div>
    <div style={{
      fontSize: 19, fontWeight: 690, letterSpacing: "-.02em",
      fontVariantNumeric: "tabular-nums", color: cor ?? T.t1,
    }}>{valor}</div>
    <div style={{ fontSize: 10.6, color: T.label, marginTop: 1 }}>{rotulo}</div>
  </div>
);

export default function CreativeHooks() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);
  const [padroes, setPadroes] = useState<Row[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas, error: e1 } = await supabase
        .from("ci_brands").select("id,name").order("created_at");
      if (e1) throw e1;
      const b = (marcas ?? [])[0];
      if (!b) { setPadroes([]); return; }
      setMarca(b);

      const { data, error } = await supabase.rpc("ci_hook_patterns", {
        p_brand_id: b.id, p_limite: 40,
      });
      if (error) throw error;
      setPadroes((data ?? []) as Row[]);
    } catch (e: any) {
      // Erro visível, e não lista vazia: "nenhum padrão" e "a consulta quebrou"
      // parecem a mesma coisa na tela, e a diferença é tudo.
      setErro(e?.message ?? "não consegui carregar os padrões");
      setPadroes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const { mapa: acuracia } = useAcuracia(marca?.id);
  const maxAssets = Math.max(1, ...padroes.map(p => p.assets ?? 0));

  return (
    <LayoutCI ativo="hooks" brandId={marca?.id} larguraMax={1020}>
      <div style={{ margin: "14px 0 18px" }}>
        <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
          Padrões de hook{marca ? ` · ${marca.name}` : ""}
          <span style={{ marginLeft: 9, verticalAlign: "middle" }}>
            <SeloConfianca campo="hook" mapa={acuracia} en={false} />
          </span>
        </h1>
        <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 700 }}>
          Cada padrão traz em quantos anúncios aparece, em quantas receitas, a estrutura
          de roteiro em que costuma vir e os exemplos com a fala que sustenta.
          A ordem é por <strong>repetição</strong> — não por desempenho, que não temos.
        </p>
      </div>

      <AvisoConfianca campo="hook" mapa={acuracia} en={false} />

      {erro && (
        <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: "#F87171", fontSize: 13.3, marginBottom: 6 }}>{erro}</div>
          <button onClick={() => void carregar()} style={{
            background: "transparent", border: `1px solid ${T.b2}`, color: T.t2,
            borderRadius: 7, padding: "5px 11px", fontSize: 12.4, cursor: "pointer",
          }}>Tentar de novo</button>
        </Card>
      )}

      {carregando && <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>}

      {!carregando && !erro && padroes.length === 0 && (
        <Card>
          <div style={{
            fontSize: 9.5, letterSpacing: ".08em", fontWeight: 700,
            color: T.yellow, marginBottom: 6,
          }}>SEM DADO AINDA</div>
          <div style={{ fontSize: 12.9, color: T.t2, lineHeight: 1.6 }}>
            Nenhum hook com evidência foi extraído ainda. Hook sem a fala, o texto na tela
            ou o frame que o sustenta é descartado de propósito — um padrão sem prova não
            serve para escrever roteiro.
          </div>
        </Card>
      )}

      {padroes.map(p => {
        const exemplos = (p.exemplos ?? []) as Row[];
        const estrutura = traduzEstrutura(p.estrutura);
        const abertoAqui = aberto === p.chave;
        return (
          <Card key={p.chave}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 380px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 9.6, letterSpacing: ".06em", fontWeight: 700, color: T.violet,
                    background: "rgba(167,139,250,.10)", border: "1px solid rgba(167,139,250,.28)",
                    borderRadius: 6, padding: "2px 7px", textTransform: "uppercase",
                  }}>{TIPO_ROTULO[p.tipo] ?? p.tipo}</span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 620, lineHeight: 1.4 }}>
                  “{p.label}”
                </div>

                {/* A barra é de REPETIÇÃO, não de desempenho. O rótulo diz isso
                    porque uma barra sozinha é lida como "melhor". */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{
                    flex: 1, height: 5, background: T.bg3, borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${Math.round(100 * (p.assets ?? 0) / maxAssets)}%`,
                      height: "100%", background: T.violet,
                    }} />
                  </div>
                  <span style={{ fontSize: 10.6, color: T.label }}>repetição</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 22, paddingTop: 4 }}>
                <Metrica valor={p.assets ?? 0} rotulo="anúncios" cor={T.violet} />
                <Metrica valor={p.receitas ?? 0} rotulo="receitas" cor={T.teal} />
                <Metrica
                  valor={p.duracao_media_s ? `${p.duracao_media_s}s` : "—"}
                  rotulo="duração média"
                />
              </div>
            </div>

            {(estrutura || p.primeiro_frame) && (
              <div style={{
                marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.b1}`,
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 10.4, letterSpacing: ".06em", color: T.label, fontWeight: 660 }}>
                    ESTRUTURA EM QUE APARECE
                  </div>
                  <div style={{ fontSize: 12.8, color: estrutura ? T.t2 : T.label, marginTop: 4 }}>
                    {estrutura ?? "as cenas deste anúncio não receberam função"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.4, letterSpacing: ".06em", color: T.label, fontWeight: 660 }}>
                    PRIMEIRO FRAME
                  </div>
                  <div style={{ fontSize: 12.8, color: p.primeiro_frame ? T.t2 : T.label, marginTop: 4 }}>
                    {p.primeiro_frame ?? "não identificado"}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setAberto(abertoAqui ? null : p.chave)}
              style={{
                marginTop: 13, background: "transparent", border: `1px solid ${T.b2}`,
                color: T.t2, borderRadius: 7, padding: "5px 11px", fontSize: 12.2,
                cursor: "pointer",
              }}
            >
              {abertoAqui ? "Esconder exemplos" : `Ver ${exemplos.length} exemplo${exemplos.length === 1 ? "" : "s"} com evidência`}
            </button>

            {abertoAqui && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {exemplos.map((ex, i) => (
                  <div key={i} style={{
                    background: T.bg2, borderRadius: 9, padding: "10px 12px",
                    display: "flex", gap: 11, alignItems: "flex-start",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.55 }}>
                        {ex.evidence}
                      </div>
                      {ex.timestamp_s != null && (
                        <div style={{ fontSize: 10.8, color: T.label, marginTop: 3 }}>
                          aos {Math.round(Number(ex.timestamp_s))}s
                        </div>
                      )}
                    </div>
                    <a
                      href={`/ci/anuncio/${ex.ad_id}`}
                      style={{ fontSize: 12, color: T.blue, textDecoration: "none", whiteSpace: "nowrap" }}
                    >abrir ›</a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {padroes.length > 0 && (
        <div style={{
          marginTop: 14, paddingTop: 13, borderTop: `1px solid ${T.b1}`,
          fontSize: 12, color: T.t3, lineHeight: 1.55,
        }}>
          Repetição não é desempenho. Um padrão usado em muitos anúncios mostra em que a
          marca <strong>aposta</strong>, não o que deu certo — não temos gasto, impressão
          nem conversão, e inferir sucesso de frequência seria chute.
        </div>
      )}
    </LayoutCI>
  );
}
