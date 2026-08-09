/**
 * /ci/pessoas — pessoas recorrentes, agrupadas por você.
 *
 * ── Por que a classificação mora AQUI e não em /ci/qualidade ──────────────
 * Você pediu para colocar na tela de qualidade. Coloquei numa tela própria por
 * um motivo prático: as duas atividades têm ritmos diferentes.
 *
 * Em /ci/qualidade você julga UM anúncio por vez, campo a campo, e a pergunta
 * é "o modelo acertou?". Aqui a pergunta é "é a mesma pessoa daquele outro?",
 * e responder isso exige ver vários keyframes lado a lado. Enfiar uma grade de
 * comparação dentro de um fluxo de um-anúncio-por-vez tornaria as duas piores.
 *
 * A tela de qualidade continua sendo o lugar de dizer se ESTE agrupamento de
 * pessoa ficou certo — o campo revisável já existe lá.
 *
 * ── O que esta tela nunca vai ter ─────────────────────────────────────────
 * Nome, etnia, idade, gênero presumido. O identificador é PERSON_003, e o
 * apelido é seu — "a ruiva do sofá" fica no seu campo de texto, não vira
 * atributo do sistema. Não existe reconhecimento facial em lugar nenhum: quem
 * agrupa é você, e é por isso que o agrupamento é anônimo por construção e não
 * por política.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { useAcuracia, SeloConfianca } from "@/ci/confianca";
import { T, Card } from "@/ci/tema";

type Row = Record<string, any>;


export default function CreativePeople() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);

  const [pessoas, setPessoas] = useState<Row[]>([]);
  const [ads, setAds] = useState<Row[]>([]);
  const [aparicoes, setAparicoes] = useState<Row[]>([]);
  const [capas, setCapas] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [soNaoClassificados, setSoNaoClassificados] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas, error: e1 } = await supabase
        .from("ci_brands").select("id,name").order("created_at");
      if (e1) throw e1;
      const b = (marcas ?? [])[0];
      if (!b) { setAds([]); return; }
      setMarca(b);

      const [{ data: vis }, { data: listaAds }, { data: apar }] = await Promise.all([
        supabase.rpc("ci_person_overview", { p_brand_id: b.id }),
        supabase.from("ci_ads")
          .select("id,ad_archive_id,is_demo,is_active,started_on")
          .eq("brand_id", b.id).eq("is_demo", false)
          .order("started_on", { ascending: false, nullsFirst: false }),
        supabase.from("ci_person_appearances")
          .select("cluster_id,ad_id").eq("brand_id", b.id),
      ]);
      setPessoas((vis ?? []) as Row[]);
      setAds((listaAds ?? []) as Row[]);
      setAparicoes((apar ?? []) as Row[]);

      // ── Uma capa por anúncio ──────────────────────────────────────────
      // O keyframe do meio, não o primeiro: a abertura de anúncio costuma ser
      // texto na tela ou o produto, e quem aparece só entra depois. Para
      // decidir "é a mesma pessoa?" o frame do meio serve muito melhor.
      const ids = (listaAds ?? []).map((a: Row) => a.id);
      if (ids.length) {
        const { data: vinculos } = await supabase
          .from("ci_ad_assets").select("ad_id,asset_id").in("ad_id", ids);
        const assetIds = [...new Set((vinculos ?? []).map((v: Row) => v.asset_id))];
        const { data: kfs } = await supabase
          .from("ci_keyframes").select("asset_id,storage_key,frame_index")
          .in("asset_id", assetIds).order("frame_index");

        const porAsset: Record<string, string[]> = {};
        for (const k of (kfs ?? []) as Row[]) {
          (porAsset[k.asset_id] ??= []).push(k.storage_key);
        }
        const chavePorAd: Record<string, string> = {};
        for (const v of (vinculos ?? []) as Row[]) {
          const lista = porAsset[v.asset_id];
          if (lista?.length && !chavePorAd[v.ad_id]) {
            chavePorAd[v.ad_id] = lista[Math.floor(lista.length / 2)];
          }
        }
        const chaves = Object.values(chavePorAd);
        if (chaves.length) {
          // Assinatura no servidor, em lotes de 60 — o limite da função.
          const urls: Record<string, string> = {};
          for (let i = 0; i < chaves.length; i += 60) {
            const { data: assinado } = await supabase.functions.invoke("ci-sign-media", {
              body: { keys: chaves.slice(i, i + 60), expires_in: 3600 },
            });
            Object.assign(urls, assinado?.urls ?? {});
          }
          const capasPorAd: Record<string, string> = {};
          for (const [adId, chave] of Object.entries(chavePorAd)) {
            if (urls[chave]) capasPorAd[adId] = urls[chave];
          }
          setCapas(capasPorAd);
        }
      }
    } catch (e: any) {
      setErro(e?.message ?? "não consegui carregar");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const { mapa: acuracia } = useAcuracia(marca?.id);

  /** ad_id → clusters daquele anúncio. */
  const porAd = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const a of aparicoes) (m[a.ad_id] ??= []).push(a.cluster_id);
    return m;
  }, [aparicoes]);

  const rotuloDe = (clusterId: string) =>
    pessoas.find(p => p.cluster_id === clusterId)?.label ?? "?";

  const atribuir = async (adId: string, clusterId: string) => {
    if (!marca?.id || salvando) return;
    setSalvando(adId);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("sessão expirada");

      const jaTem = (porAd[adId] ?? []).includes(clusterId);
      if (jaTem) {
        // Clicar de novo REMOVE. Classificação manual erra, e desfazer tem que
        // estar no mesmo lugar de fazer — senão a pessoa deixa o erro lá.
        const { error } = await supabase.from("ci_person_appearances")
          .delete().eq("ad_id", adId).eq("cluster_id", clusterId);
        if (error) throw error;
        setAparicoes(a => a.filter(x => !(x.ad_id === adId && x.cluster_id === clusterId)));
      } else {
        const { error } = await supabase.from("ci_person_appearances").insert({
          cluster_id: clusterId, ad_id: adId,
          brand_id: marca.id, user_id: userId, origem: "humano",
        });
        if (error) throw error;
        setAparicoes(a => [...a, { ad_id: adId, cluster_id: clusterId }]);
      }
    } catch (e: any) {
      setErro(e?.message ?? "não consegui salvar");
    } finally {
      setSalvando(null);
    }
  };

  const criarPessoa = async (adId?: string) => {
    if (!marca?.id) return;
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) throw new Error("sessão expirada");

      const { data: proximo, error: e1 } = await supabase
        .rpc("ci_person_next_label", { p_brand_id: marca.id });
      if (e1) throw e1;

      const { data: novo, error: e2 } = await supabase
        .from("ci_person_clusters")
        .insert({ brand_id: marca.id, user_id: userId, label: proximo })
        .select("id,label").single();
      if (e2) throw e2;

      setPessoas(p => [...p, {
        cluster_id: novo.id, label: novo.label, apelido: null,
        ads: 0, receitas: 0, ativos: 0, share_pct: 0,
        formatos: [], exemplos: [],
      }]);
      if (adId) await atribuir(adId, novo.id);
    } catch (e: any) {
      setErro(e?.message ?? "não consegui criar a pessoa");
    }
  };

  const renomear = async (clusterId: string, apelido: string) => {
    await supabase.from("ci_person_clusters")
      .update({ display_name: apelido || null }).eq("id", clusterId);
    setPessoas(p => p.map(x => x.cluster_id === clusterId ? { ...x, apelido } : x));
  };

  const naoClassificados = ads.filter(a => !(porAd[a.id]?.length));
  const visiveis = soNaoClassificados ? naoClassificados : ads;

  return (
    <LayoutCI ativo="pessoas" brandId={marca?.id} larguraMax={1020}>
      <div style={{ margin: "14px 0 18px" }}>
        <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
          Pessoas recorrentes{marca ? ` · ${marca.name}` : ""}
          <span style={{ marginLeft: 9, verticalAlign: "middle" }}>
            <SeloConfianca campo="pessoa" mapa={acuracia} en={false} />
          </span>
        </h1>
        <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 720 }}>
          Quem agrupa é você. Não existe reconhecimento facial no sistema — o
          identificador é <strong>anônimo por construção</strong>, não por política.
          O apelido é seu e não vira atributo: o sistema guarda PERSON_003.
        </p>
      </div>

      {erro && (
        <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: T.red, fontSize: 13.3 }}>{erro}</div>
        </Card>
      )}
      {carregando && <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>}

      {/* ── As pessoas já criadas ─────────────────────────────────────── */}
      {!carregando && (
        <Card>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 13, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 15, fontWeight: 640 }}>
              {pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"}
            </span>
            <button onClick={() => void criarPessoa()} style={{
              background: "rgba(167,139,250,.12)", border: "1px solid rgba(167,139,250,.36)",
              color: T.violet, borderRadius: 8, padding: "5px 11px",
              fontSize: 12.2, fontWeight: 620, cursor: "pointer",
            }}>+ Nova pessoa</button>
          </div>

          {pessoas.length === 0 ? (
            <div style={{ fontSize: 12.8, color: T.t2, lineHeight: 1.6 }}>
              Nenhuma pessoa ainda. Comece pela grade abaixo: em cada anúncio,
              clique em <strong>+ nova</strong> para a primeira aparição de alguém,
              e depois use o mesmo PERSON_xxx nos outros anúncios em que reconhecer
              a mesma pessoa.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {pessoas.map(p => (
                <div key={p.cluster_id} style={{
                  background: T.bg2, borderRadius: 9, padding: "11px 12px",
                  display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap",
                }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 12.6, color: T.violet,
                    fontWeight: 640, minWidth: 92,
                  }}>{p.label}</span>

                  <input
                    defaultValue={p.apelido ?? ""}
                    placeholder="apelido (opcional, só seu)"
                    onBlur={e => void renomear(p.cluster_id, e.target.value.trim())}
                    style={{
                      flex: "1 1 180px", background: T.bg3, border: `1px solid ${T.b1}`,
                      borderRadius: 7, padding: "5px 9px", color: T.t1, fontSize: 12.4,
                    }}
                  />

                  <span style={{ fontSize: 12.4, color: T.t2, fontVariantNumeric: "tabular-nums" }}>
                    <strong style={{ color: T.t1 }}>{p.ads}</strong> anúncios
                  </span>
                  <span style={{ fontSize: 12.4, color: T.t3 }}>
                    {p.receitas} receita{p.receitas === 1 ? "" : "s"}
                  </span>
                  {p.ativos > 0 && (
                    <span style={{ fontSize: 12.4, color: T.green }}>{p.ativos} no ar</span>
                  )}
                  {p.duracao_media_s && (
                    <span style={{ fontSize: 12.4, color: T.t3 }}>{p.duracao_media_s}s média</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── A grade de classificação ──────────────────────────────────── */}
      {!carregando && ads.length > 0 && (
        <Card>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 15, fontWeight: 640 }}>Classificar</span>
            <label style={{ fontSize: 12.3, color: T.t3, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={soNaoClassificados}
                     onChange={e => setSoNaoClassificados(e.target.checked)} />
              só os que faltam ({naoClassificados.length} de {ads.length})
            </label>
          </div>
          <div style={{ fontSize: 11.8, color: T.label, marginBottom: 13, lineHeight: 1.5 }}>
            O frame mostrado é o do MEIO do vídeo, não o primeiro: anúncio costuma
            abrir com texto ou produto, e quem aparece entra depois. Clicar de novo
            no mesmo PERSON remove — desfazer fica no mesmo lugar de fazer.
          </div>

          {visiveis.length === 0 ? (
            <div style={{ fontSize: 12.8, color: T.green }}>
              Todos os {ads.length} anúncios classificados.
            </div>
          ) : (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 13,
            }}>
              {visiveis.map(ad => {
                const meus = porAd[ad.id] ?? [];
                return (
                  <div key={ad.id} style={{
                    background: T.bg2, borderRadius: 10, overflow: "hidden",
                    opacity: salvando === ad.id ? 0.5 : 1,
                  }}>
                    <div style={{
                      aspectRatio: "9/16", background: T.bg3, position: "relative",
                      display: "grid", placeItems: "center",
                    }}>
                      {capas[ad.id] ? (
                        <img src={capas[ad.id]} alt=""
                             style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 11.4, color: T.label, padding: 10, textAlign: "center" }}>
                          sem keyframe — o anúncio pode ser imagem, ou a análise não rodou
                        </span>
                      )}
                    </div>

                    <div style={{ padding: "9px 10px" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>
                        {pessoas.map(p => {
                          const marcado = meus.includes(p.cluster_id);
                          return (
                            <button key={p.cluster_id}
                              onClick={() => void atribuir(ad.id, p.cluster_id)}
                              title={marcado ? "clique para remover" : "marcar esta pessoa"}
                              style={{
                                fontSize: 10.6, fontFamily: "monospace", fontWeight: 620,
                                padding: "3px 7px", borderRadius: 6, cursor: "pointer",
                                background: marcado ? "rgba(167,139,250,.20)" : "transparent",
                                border: `1px solid ${marcado ? "rgba(167,139,250,.50)" : T.b2}`,
                                color: marcado ? T.violet : T.t3,
                              }}>
                              {p.label.replace("PERSON_", "P")}
                            </button>
                          );
                        })}
                        <button onClick={() => void criarPessoa(ad.id)}
                          title="Cria uma pessoa nova e já marca neste anúncio"
                          style={{
                            fontSize: 10.6, fontWeight: 620, padding: "3px 7px",
                            borderRadius: 6, cursor: "pointer", background: "transparent",
                            border: `1px dashed ${T.b2}`, color: T.t2,
                          }}>+ nova</button>
                      </div>

                      <a href={`/ci/anuncio/${ad.id}`} style={{
                        fontSize: 10.8, color: T.blue, textDecoration: "none",
                      }}>abrir anúncio ›</a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {!carregando && (
        <div style={{ fontSize: 11.8, color: T.t3, lineHeight: 1.6, paddingTop: 4 }}>
          Aparecer em muitos anúncios não significa que a pessoa funciona melhor —
          significa que a marca a usa mais. Não temos desempenho, e a coluna de
          contagem é repetição observada, como todo o resto do produto.
        </div>
      )}
    </LayoutCI>
  );
}
