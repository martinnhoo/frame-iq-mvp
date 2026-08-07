/**
 * /ci/qualidade — a acurácia por campo, medida
 *
 * ── A pergunta ────────────────────────────────────────────────────────────
 * "Posso confiar nesses gráficos?"
 *
 * O painel apresenta `proof` e `duração` do mesmo jeito. Se um acerta 60% e o
 * outro 100%, a interface mente por omissão — e mentir por omissão é pior que
 * errar visivelmente, porque ninguém vai procurar.
 *
 * ── Como foi desenhada para ser rápida ────────────────────────────────────
 * Revisar 30–50 anúncios campo a campo é trabalho chato, e ferramenta chata
 * não é usada. Então: quando está certo, é UM clique. O campo de correção só
 * aparece quando você marca errado ou parcial — que é onde a informação vale.
 *
 * `n/a` existe e é importante: um anúncio sem áudio não tem transcrição para
 * errar. Contá-lo como acerto inflaria a nota; como erro, deprimiria. Ele fica
 * fora do denominador.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";

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

/** Os campos revisáveis, na ordem em que fazem sentido conferir. */
const CAMPOS = [
  { id: "transcript", nome: "Transcrição", ajuda: "O texto bate com a fala?" },
  { id: "ocr", nome: "Texto na tela", ajuda: "Leu o que está escrito no vídeo?" },
  { id: "formato", nome: "Formato / estilo", ajuda: "UGC, demo, talking head — acertou?" },
  { id: "produto", nome: "Produto", ajuda: "Identificou o produto certo?" },
  { id: "hook", nome: "Hook", ajuda: "É mesmo a abertura do anúncio?" },
  { id: "angle", nome: "Ângulo", ajuda: "É o argumento de venda usado?" },
  { id: "proof", nome: "Prova", ajuda: "O que ele chamou de prova sustenta a promessa?" },
  { id: "offer", nome: "Oferta", ajuda: "" },
  { id: "cta", nome: "CTA", ajuda: "" },
  { id: "estrutura", nome: "Estrutura de cena", ajuda: "A sequência de funções está certa?" },
  { id: "receita", nome: "Receita", ajuda: "Este anúncio pertence ao grupo em que caiu?" },
] as const;

const VEREDITOS = [
  { id: "correto", rotulo: "Certo", cor: T.green },
  { id: "parcial", rotulo: "Parcial", cor: T.yellow },
  { id: "errado", rotulo: "Errado", cor: T.red },
  { id: "nao_aplicavel", rotulo: "n/a", cor: T.label },
] as const;

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 13,
    padding: 18, marginBottom: 14, ...style,
  }}>{children}</div>
);

export default function CreativeQuality() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);
  const [ads, setAds] = useState<Row[]>([]);
  const [indice, setIndice] = useState(0);
  const [revisoes, setRevisoes] = useState<Record<string, Row>>({});
  const [resumo, setResumo] = useState<Row[]>([]);
  const [correcao, setCorrecao] = useState<Record<string, string>>({});
  const [contexto, setContexto] = useState<Row | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas } = await supabase
        .from("ci_brands").select("id,name").order("created_at");
      const b = (marcas ?? [])[0];
      if (!b) return;
      setMarca(b);

      // Só anúncios REAIS e JÁ ANALISADOS.
      //
      // O comentário aqui dizia isso desde o começo e o código não fazia:
      // faltava o filtro de analysis_status, e a fila abria num anúncio de
      // IMAGEM sem asset nenhum. Revisar o que o worker não tocou mede a fila,
      // não a extração — e pior, faz a ferramenta parecer quebrada logo no
      // primeiro item.
      //
      // Anúncio de IMAGEM nunca entra: só vídeo vai para a fila de análise
      // (imagem não tem transcrição nem cena, e mandá-la ao LLM gastaria por
      // nada). Ele existe na base, aparece na contagem de anúncios, e não tem
      // o que revisar.
      const { data: lista } = await supabase.from("ci_ads")
        .select("id,ad_archive_id,headline,analysis_status,is_demo,media_type")
        .eq("brand_id", b.id).eq("is_demo", false)
        .eq("analysis_status", "completed")
        .order("started_on", { ascending: false });
      setAds((lista ?? []) as Row[]);

      // Quantos ficaram de fora, e por quê. Sem isto, "80 anúncios na base e 3
      // para revisar" pareceria bug em vez de consequência.
      const { count: totalReais } = await supabase.from("ci_ads")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", b.id).eq("is_demo", false);
      const { count: imagens } = await supabase.from("ci_ads")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", b.id).eq("is_demo", false).neq("media_type", "video");
      setContexto({ total: totalReais ?? 0, imagens: imagens ?? 0,
                    revisaveis: (lista ?? []).length });

      const { data: revs } = await supabase.from("ci_quality_reviews")
        .select("ad_id,campo,veredito,valor_correto").eq("brand_id", b.id);
      const mapa: Record<string, Row> = {};
      for (const r of (revs ?? []) as Row[]) mapa[`${r.ad_id}|${r.campo}`] = r;
      setRevisoes(mapa);

      const { data: sum } = await supabase.rpc("ci_quality_summary", { p_brand_id: b.id });
      setResumo((sum ?? []) as Row[]);
    } catch (e: any) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const ad = ads[indice];

  const julgar = async (campo: string, veredito: string) => {
    if (!ad || !marca) return;
    const chave = `${ad.id}|${campo}`;
    const valorCorreto = correcao[chave]?.trim() || null;

    // Otimista: a tela responde no clique. Revisar 50 anúncios esperando
    // ida-e-volta de rede em cada campo seria insuportável.
    setRevisoes(r => ({ ...r, [chave]: { ad_id: ad.id, campo, veredito, valor_correto: valorCorreto } }));

    const { data: sessao } = await supabase.auth.getUser();
    const { error } = await supabase.from("ci_quality_reviews").upsert({
      ad_id: ad.id, brand_id: marca.id, user_id: sessao?.user?.id,
      campo, veredito, valor_correto: valorCorreto,
    }, { onConflict: "ad_id,campo" });

    if (error) {
      setErro(`Não gravou: ${error.message}`);
      setRevisoes(r => { const c = { ...r }; delete c[chave]; return c; });
      return;
    }
    const { data: sum } = await supabase.rpc("ci_quality_summary", { p_brand_id: marca.id });
    setResumo((sum ?? []) as Row[]);
  };

  const revisadosDoAd = (adId: string) =>
    CAMPOS.filter(c => revisoes[`${adId}|${c.id}`]).length;

  return (
    <LayoutCI ativo="qualidade" brandId={marca?.id} larguraMax={1050}>

        <div style={{ margin: "14px 0 20px" }}>
          <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
            Qualidade da extração
          </h1>
          <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 700 }}>
            Confira campo a campo e o sistema calcula a acurácia. É o que responde
            se os gráficos merecem confiança — um campo que acerta 60% não pode ser
            apresentado igual a um que acerta 100%.
          </p>
        </div>

        {erro && <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: T.red, fontSize: 13.3 }}>{erro}</div></Card>}

        {/* ── O placar ────────────────────────────────────────────────── */}
        <Card>
          <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 4 }}>Acurácia por campo</div>
          <div style={{ fontSize: 11.8, color: T.t3, marginBottom: 12 }}>
            Parcial vale meio acerto. "n/a" fica fora do denominador.
          </div>
          {resumo.length === 0 ? (
            <div style={{ fontSize: 12.8, color: T.label }}>
              Nenhuma revisão ainda. Comece pelo anúncio abaixo.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 7 }}>
              {resumo.map(r => {
                const pct = r.acuracia_pct;
                const cor = pct == null ? T.label : pct >= 90 ? T.green : pct >= 75 ? T.yellow : T.red;
                return (
                  <div key={r.campo} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12.9 }}>
                    <span style={{ minWidth: 128, color: T.t2 }}>
                      {CAMPOS.find(c => c.id === r.campo)?.nome ?? r.campo}
                    </span>
                    <div style={{ flex: 1, height: 6, background: T.bg3, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct ?? 0}%`, height: "100%", background: cor }} />
                    </div>
                    <span style={{ minWidth: 42, textAlign: "right", color: cor, fontWeight: 640, fontVariantNumeric: "tabular-nums" }}>
                      {pct == null ? "—" : `${pct}%`}
                    </span>
                    <span style={{ minWidth: 82, fontSize: 11.3, color: T.t3, textAlign: "right" }}>
                      {r.revisados} revisado{r.revisados === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {resumo.length > 0 && resumo.some(r => (r.revisados ?? 0) < 10) && (
            <div style={{ fontSize: 11.8, color: T.yellow, marginTop: 12, lineHeight: 1.5 }}>
              Menos de 10 revisões num campo é amostra pequena demais para tirar
              conclusão. O número aparece, mas ainda não significa muito.
            </div>
          )}
        </Card>

        {/* ── Navegação ───────────────────────────────────────────────── */}
        {carregando ? (
          <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>
        ) : ads.length === 0 ? (
          <Card><div style={{ fontSize: 12.9, color: T.t2, lineHeight: 1.6 }}>
            Nenhum anúncio <strong>analisado</strong> para revisar ainda.
            {contexto && (
              <> A base tem {contexto.total} anúncio(s) real(is)
                {contexto.imagens > 0 && <>, dos quais {contexto.imagens} são de IMAGEM e
                  nunca entram na análise — imagem não tem fala nem cena</>}.
                O resto ainda está na fila do worker.</>
            )}
          </div></Card>
        ) : (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => setIndice(i => Math.max(0, i - 1))} disabled={indice === 0}
                style={{
                  background: "transparent", color: indice === 0 ? T.label : T.t2,
                  border: `1px solid ${T.b2}`, borderRadius: 8, padding: "7px 13px",
                  fontSize: 12.5, fontFamily: F, cursor: indice === 0 ? "not-allowed" : "pointer",
                }}>← anterior</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 640, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ad?.headline || ad?.ad_archive_id}
                </div>
                <div style={{ fontSize: 11.8, color: T.t3, marginTop: 3 }}>
                  {indice + 1} de {ads.length} analisado{ads.length === 1 ? "" : "s"}
                  {contexto && contexto.total > ads.length && (
                    <span title={`${contexto.imagens} de imagem + os que ainda estão na fila`}>
                      {" "}(de {contexto.total} na base)
                    </span>
                  )} · {revisadosDoAd(ad?.id)} de {CAMPOS.length} campos revisados
                  {ad?.analysis_status !== "completed" && (
                    <span style={{ color: T.yellow, marginLeft: 8 }}>
                      análise {ad?.analysis_status ?? "pendente"}
                    </span>
                  )}
                </div>
              </div>
              <a href={`/ci/anuncio/${ad?.id}`} target="_blank" rel="noreferrer"
                 style={{ color: T.blue, fontSize: 12.6, textDecoration: "none" }}>
                abrir o anúncio ↗
              </a>
              <button onClick={() => setIndice(i => Math.min(ads.length - 1, i + 1))}
                disabled={indice >= ads.length - 1}
                style={{
                  background: T.violet, color: "#0B0713", border: "none", borderRadius: 8,
                  padding: "7px 14px", fontSize: 12.5, fontWeight: 620, fontFamily: F,
                  cursor: indice >= ads.length - 1 ? "not-allowed" : "pointer",
                  opacity: indice >= ads.length - 1 ? 0.4 : 1,
                }}>próximo →</button>
            </div>

            <div style={{ fontSize: 11.8, color: T.t3, marginBottom: 14, lineHeight: 1.5 }}>
              Abra o anúncio numa aba ao lado para conferir. Um clique quando está
              certo; o campo de correção só aparece quando você marca errado ou parcial.
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {CAMPOS.map(campo => {
                const chave = `${ad?.id}|${campo.id}`;
                const rev = revisoes[chave];
                const precisaCorrecao = rev && (rev.veredito === "errado" || rev.veredito === "parcial");
                return (
                  <div key={campo.id} style={{
                    background: T.bg2, borderRadius: 9, padding: "11px 13px",
                    border: `1px solid ${rev ? T.b1 : "transparent"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 150 }}>
                        <div style={{ fontSize: 13, color: T.t1 }}>{campo.nome}</div>
                        {campo.ajuda && (
                          <div style={{ fontSize: 11.3, color: T.t3, marginTop: 2 }}>{campo.ajuda}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        {VEREDITOS.map(v => {
                          const ativo = rev?.veredito === v.id;
                          return (
                            <button key={v.id} onClick={() => julgar(campo.id, v.id)} style={{
                              background: ativo ? v.cor : "transparent",
                              color: ativo ? "#0B0713" : v.cor,
                              border: `1px solid ${ativo ? v.cor : T.b2}`,
                              borderRadius: 7, padding: "5px 11px", fontSize: 12,
                              fontWeight: ativo ? 660 : 500, fontFamily: F, cursor: "pointer",
                            }}>{v.rotulo}</button>
                          );
                        })}
                      </div>
                    </div>
                    {precisaCorrecao && (
                      <input
                        value={correcao[chave] ?? rev.valor_correto ?? ""}
                        onChange={e => setCorrecao(c => ({ ...c, [chave]: e.target.value }))}
                        onBlur={() => rev && julgar(campo.id, rev.veredito)}
                        placeholder="Qual era o correto? (opcional — vira material para ajustar o prompt)"
                        style={{
                          width: "100%", marginTop: 9, background: T.bg3,
                          border: `1px solid ${T.b2}`, borderRadius: 7, padding: "8px 11px",
                          color: T.t1, fontSize: 12.5, fontFamily: F, outline: "none",
                        }} />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <div style={{
          marginTop: 4, fontSize: 12, color: T.t3, lineHeight: 1.55,
        }}>
          Revisar 30 a 50 anúncios é suficiente para saber em que confiar. Não é
          avaliação de modelo — é o mínimo para não apresentar um campo de 60%
          com a mesma cara de um de 100%.
        </div>
    </LayoutCI>
  );
}
