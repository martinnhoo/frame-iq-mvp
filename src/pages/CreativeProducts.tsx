/**
 * /ci/produtos — o playbook criativo de cada produto.
 *
 * ── A pergunta ────────────────────────────────────────────────────────────
 * "Quando esta marca está vendendo ESTE produto, o que ela faz?"
 *
 * Abrir um produto entrega ângulos, hooks, problemas, promessas, provas,
 * ofertas, CTAs e formatos — cada um com quantos anúncios sustentam. É o que
 * alguém precisa para escrever um roteiro novo do mesmo produto sem começar
 * do zero.
 *
 * ── Por que cada bloco carrega a contagem ─────────────────────────────────
 * "Ângulo: conforto" sozinho é opinião. "Ângulo: conforto — 14 de 22 anúncios"
 * é observação. O número é o que separa as duas coisas, e ele aparece sempre.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { useAcuracia, SeloConfianca } from "@/ci/confianca";
import { T, Card } from "@/ci/tema";

type Row = Record<string, any>;

/** Ordem de leitura: primeiro a ideia, depois a execução, por último o fecho. */
const BLOCOS: { campo: string; titulo: string; cor: string; ajuda: string }[] = [
  { campo: "angulos",   titulo: "Ângulos",   cor: T.teal,   ajuda: "Por que a pessoa deveria se importar" },
  { campo: "problemas", titulo: "Objeções",  cor: T.red,    ajuda: "O que a marca diz que resolve" },
  { campo: "promessas", titulo: "Promessas", cor: T.green,  ajuda: "O que ela promete" },
  { campo: "provas",    titulo: "Provas",    cor: T.blue,   ajuda: "Com o que ela sustenta" },
  { campo: "hooks",     titulo: "Hooks",     cor: T.violet, ajuda: "Como abre" },
  { campo: "ofertas",   titulo: "Ofertas",   cor: T.orange, ajuda: "Condição comercial" },
  { campo: "ctas",      titulo: "CTAs",      cor: T.yellow, ajuda: "Chamada final" },
  { campo: "formatos",  titulo: "Formatos",  cor: T.t3,     ajuda: "Estilo visual" },
];


export default function CreativeProducts() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);
  const [produtos, setProdutos] = useState<Row[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas, error: e1 } = await supabase
        .from("ci_brands").select("id,name").order("created_at");
      if (e1) throw e1;
      const b = (marcas ?? [])[0];
      if (!b) { setProdutos([]); return; }
      setMarca(b);

      const { data, error } = await supabase.rpc("ci_product_playbook", { p_brand_id: b.id });
      if (error) throw error;
      const lista = (data ?? []) as Row[];
      setProdutos(lista);
      // Abre o primeiro: um acordeão todo fechado obriga um clique só para
      // descobrir se há conteúdo, e a resposta quase sempre é sim.
      if (lista.length > 0) setAberto(lista[0].chave);
    } catch (e: any) {
      setErro(e?.message ?? "não consegui carregar os produtos");
      setProdutos([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const { mapa: acuracia } = useAcuracia(marca?.id);

  return (
    <LayoutCI ativo="produtos" brandId={marca?.id} larguraMax={1020}>
      <div style={{ margin: "14px 0 18px" }}>
        <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
          Playbook por produto{marca ? ` · ${marca.name}` : ""}
          <span style={{ marginLeft: 9, verticalAlign: "middle" }}>
            <SeloConfianca campo="produto" mapa={acuracia} en={false} />
          </span>
        </h1>
        <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 700 }}>
          O que a marca faz quando está vendendo cada produto. Todo item traz em quantos
          anúncios aparece — <strong>"ângulo: conforto" é opinião; "conforto em 14 de 22"
          é observação</strong>.
        </p>
      </div>

      {erro && (
        <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: T.red, fontSize: 13.3, marginBottom: 6 }}>{erro}</div>
          <button onClick={() => void carregar()} style={{
            background: "transparent", border: `1px solid ${T.b2}`, color: T.t2,
            borderRadius: 7, padding: "5px 11px", fontSize: 12.4, cursor: "pointer",
          }}>Tentar de novo</button>
        </Card>
      )}

      {carregando && <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>}

      {!carregando && !erro && produtos.length === 0 && (
        <Card>
          <div style={{
            fontSize: 9.5, letterSpacing: ".08em", fontWeight: 700,
            color: T.yellow, marginBottom: 6,
          }}>SEM DADO AINDA</div>
          <div style={{ fontSize: 12.9, color: T.t2, lineHeight: 1.6 }}>
            Nenhum produto foi identificado com evidência. O worker preenche isto sozinho
            depois da análise — e produto sem a fala ou o frame que o sustenta é descartado
            de propósito.
          </div>
        </Card>
      )}

      {produtos.map(p => {
        const abertoAqui = aberto === p.chave;
        return (
          <Card key={p.chave}>
            <div
              onClick={() => setAberto(abertoAqui ? null : p.chave)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 640, letterSpacing: "-.01em" }}>
                  {p.produto}
                </div>
                <div style={{ fontSize: 11.6, color: T.label, marginTop: 3 }}>
                  {p.receitas} receita{p.receitas === 1 ? "" : "s"}
                  {p.duracao_media_s ? ` · ${p.duracao_media_s}s em média` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
                <div>
                  <div style={{
                    fontSize: 19, fontWeight: 690, fontVariantNumeric: "tabular-nums",
                  }}>{p.assets}</div>
                  <div style={{ fontSize: 10.6, color: T.label }}>anúncios</div>
                </div>
                <div>
                  <div style={{
                    fontSize: 19, fontWeight: 690, fontVariantNumeric: "tabular-nums",
                    color: (p.ativos ?? 0) > 0 ? T.green : T.label,
                  }}>{p.ativos ?? 0}</div>
                  <div style={{ fontSize: 10.6, color: T.label }}>no ar</div>
                </div>
                <span style={{ color: T.t3, fontSize: 15 }}>{abertoAqui ? "▾" : "▸"}</span>
              </div>
            </div>

            {abertoAqui && (
              <div style={{
                marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.b1}`,
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 18,
              }}>
                {BLOCOS.map(b => {
                  const itens = (p[b.campo] ?? []) as Row[];
                  return (
                    <div key={b.campo}>
                      <div style={{
                        fontSize: 10.4, letterSpacing: ".06em", fontWeight: 660,
                        color: b.cor, marginBottom: 2,
                      }}>{b.titulo.toUpperCase()}</div>
                      <div style={{ fontSize: 10.6, color: T.label, marginBottom: 7 }}>
                        {b.ajuda}
                      </div>

                      {/* Bloco vazio mantém o lugar e diz o motivo. Sumir daria
                          a impressão de que a marca não usa aquilo, quando o
                          que houve foi o modelo não ter extraído. */}
                      {itens.length === 0 ? (
                        <div style={{ fontSize: 11.8, color: T.label, fontStyle: "italic" }}>
                          nada extraído com evidência
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 5 }}>
                          {itens.slice(0, 6).map((it, i) => (
                            <div key={i} style={{
                              display: "flex", gap: 9, alignItems: "baseline", fontSize: 12.5,
                            }}>
                              <span style={{ flex: 1, color: T.t2, lineHeight: 1.4 }}>{it.label}</span>
                              <span style={{
                                color: T.t3, fontVariantNumeric: "tabular-nums", fontSize: 11.6,
                              }}>{it.ads}/{p.assets}</span>
                            </div>
                          ))}
                          {itens.length > 6 && (
                            <div style={{ fontSize: 11.3, color: T.label, marginTop: 2 }}>
                              +{itens.length - 6} com menos anúncios
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {produtos.length > 0 && (
        <div style={{
          marginTop: 14, paddingTop: 13, borderTop: `1px solid ${T.b1}`,
          fontSize: 12, color: T.t3, lineHeight: 1.55,
        }}>
          "no ar" vem da biblioteca pública da Meta e diz apenas que o anúncio continua
          publicado. Não é sinal de desempenho — anúncio antigo pode seguir no ar por
          inércia.
        </div>
      )}
    </LayoutCI>
  );
}
