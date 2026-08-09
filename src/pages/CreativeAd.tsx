/**
 * /ci/anuncio/:id — a unidade atômica de inspeção
 *
 * É aqui que alguém verifica se a análise está certa. Todas as outras telas
 * apontam para esta: quando o painel diz "este hook aparece em 14 anúncios",
 * é aqui que se confere se aquilo é mesmo um hook, olhando o frame e a fala.
 *
 * ── A regra desta tela ────────────────────────────────────────────────────
 * Nenhuma classificação aparece sem a evidência ao lado. Não é decoração: o
 * produto inteiro se apoia em "isto foi observado, e aqui está onde". Uma tela
 * que mostrasse só os rótulos pediria confiança cega — que é exatamente o que
 * o rodapé do painel promete não fazer.
 *
 * ── Sobre a mídia ─────────────────────────────────────────────────────────
 * O bucket é privado. As URLs são assinadas na hora, com validade de 1 hora, e
 * nunca ficam gravadas em lugar nenhum. Se a assinatura falhar, o card diz que
 * falhou em vez de mostrar imagem quebrada.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { T, F, Card } from "@/ci/tema";

type Row = Record<string, any>;

const KIND_ROTULO: Record<string, string> = {
  hook: "Hook", hook_visual: "Hook visual", hook_written: "Hook escrito",
  angle: "Ângulo", promise: "Promessa", proof: "Prova",
  demonstration: "Demonstração", objection: "Objeção", offer: "Oferta",
  cta: "CTA", product: "Produto", product_type: "Tipo de produto",
  mechanism: "Mecanismo", scenario: "Cenário", story_structure: "Estrutura",
  emotional_tone: "Tom", visual_style: "Estilo visual", editing_rhythm: "Ritmo",
};
const KIND_COR: Record<string, string> = {
  hook: T.blue, hook_visual: T.blue, hook_written: T.blue,
  angle: T.violet, promise: T.green, proof: T.teal, demonstration: T.teal,
  objection: T.red, offer: T.yellow, cta: T.yellow,
};

const FUNCAO_CENA: Record<string, string> = {
  hook: "Hook", problem: "Problema", product: "Produto",
  demonstration: "Demonstração", proof: "Prova", benefit: "Benefício",
  offer: "Oferta", objection: "Objeção", solution: "Solução",
  testimonial: "Depoimento", cta: "CTA", close: "Fechamento",
};

const tempo = (s: unknown) => {
  const n = Number(s);
  return Number.isFinite(n) ? `${n.toFixed(1)}s` : "—";
};


const Head = ({ children, nota }: { children: React.ReactNode; nota?: string }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 14.5, fontWeight: 640 }}>{children}</div>
    {nota && <div style={{ fontSize: 11.8, color: T.t3, marginTop: 4, lineHeight: 1.5 }}>{nota}</div>}
  </div>
);

const Vazio = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    background: T.bg2, border: `1px dashed ${T.b2}`, borderRadius: 9,
    padding: "13px 14px", fontSize: 12.6, color: T.t2, lineHeight: 1.55,
  }}>{children}</div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function CreativeAd() {
  const { id } = useParams<{ id: string }>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [d, setD] = useState<Row | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [falhaMidia, setFalhaMidia] = useState<string | null>(null);

  const carregar = useCallback(async (adId: string) => {
    setCarregando(true); setErro(null);
    try {
      const { data: ad, error: e1 } = await supabase
        .from("ci_ads").select("*").eq("id", adId).maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!ad) { setErro("Anúncio não encontrado, ou não pertence a esta conta."); return; }

      const { data: vinculos } = await supabase
        .from("ci_ad_assets").select("asset_id,role").eq("ad_id", adId);
      const assetIds = (vinculos ?? []).map((v: Row) => v.asset_id);

      const nada = { data: [] as Row[] };
      const [assets, keyframes, cenas, transcripts, onscreen, taxo] = assetIds.length
        ? await Promise.all([
            supabase.from("ci_assets")
              .select("id,storage_key,duration_seconds,width,height,fps,has_audio,media_type,file_ext,analysis_status,sha256")
              .in("id", assetIds),
            supabase.from("ci_keyframes")
              .select("id,asset_id,frame_index,timestamp_s,storage_key,reason")
              .in("asset_id", assetIds).order("frame_index"),
            supabase.from("ci_scenes")
              .select("id,asset_id,scene_index,start_seconds,end_seconds,setting,description,scene_function,camera_style,framing,action,product_visible,confidence")
              .in("asset_id", assetIds).order("scene_index"),
            supabase.from("ci_transcripts")
              .select("id,asset_id,full_text,language,engine_model,word_count,duration_seconds")
              .in("asset_id", assetIds),
            supabase.from("ci_onscreen_text")
              .select("id,asset_id,track_index,start_seconds,end_seconds,text,confidence,model_version")
              .in("asset_id", assetIds).order("track_index"),
            supabase.from("ci_ad_taxonomy")
              .select("term_id,confidence,evidence,evidence_kind,timestamp_s,source,model_version")
              .eq("ad_id", adId),
          ])
        : [nada, nada, nada, nada, nada, nada];

      const termIds = (taxo.data ?? []).map((t: Row) => t.term_id);
      const termos = termIds.length
        ? await supabase.from("ci_taxonomy_terms").select("id,kind,label,slug").in("id", termIds)
        : nada;

      const trIds = (transcripts.data ?? []).map((t: Row) => t.id);
      const segs = trIds.length
        ? await supabase.from("ci_transcript_segments")
            .select("segment_index,start_seconds,end_seconds,text,confidence")
            .in("transcript_id", trIds).order("segment_index")
        : nada;

      setD({
        ad, assets: assets.data ?? [], keyframes: keyframes.data ?? [],
        cenas: cenas.data ?? [], transcripts: transcripts.data ?? [],
        segmentos: segs.data ?? [], onscreen: onscreen.data ?? [],
        taxo: taxo.data ?? [], termos: termos.data ?? [],
      });

      // ── Mídia assinada ──────────────────────────────────────────────────
      //
      // Assinada pela edge function ci-sign-media, não pelo navegador.
      //
      // Assinar no cliente exige policy de leitura em storage.objects, e essa
      // policy não funcionou: ela existe, é permissiva, o predicado avaliado à
      // mão devolve TRUE, não há policy restritiva, o dono confere — e o
      // usuário via 0 de 356 objetos. Em vez de seguir caçando, a autorização
      // passou para o servidor, que já sabe fazê-la e onde dá para depurar.
      const chaves: string[] = [];
      const asset = (assets.data ?? [])[0];
      if (asset?.storage_key) chaves.push(asset.storage_key);
      const kfs = ((keyframes.data ?? []) as Row[]).filter(k => k.storage_key).slice(0, 24);
      for (const k of kfs) chaves.push(k.storage_key);

      if (chaves.length) {
        const { data: sessao } = await supabase.auth.getSession();
        const token = sessao?.session?.access_token;
        const r = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ci-sign-media`,
          { method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ keys: chaves, expires_in: 3600 }) });

        if (!r.ok) {
          const txt = await r.text();
          setFalhaMidia(`assinatura falhou (${r.status}): ${txt.slice(0, 200)}`);
        } else {
          const { urls, falhas } = await r.json() as
            { urls: Record<string, string>; falhas: Record<string, string> };
          if (asset?.storage_key) {
            if (urls[asset.storage_key]) setVideoUrl(urls[asset.storage_key]);
            else setFalhaMidia(falhas?.[asset.storage_key] ?? "sem URL para o vídeo");
          }
          const mapa: Record<string, string> = {};
          for (const k of kfs) if (urls[k.storage_key]) mapa[k.id] = urls[k.storage_key];
          setUrls(mapa);
        }
      }
    } catch (e: any) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { if (id) carregar(id); }, [id, carregar]);

  if (carregando) {
    return <div style={{ minHeight: "100vh", background: T.bg0, color: T.t3, fontFamily: F, padding: 40 }}>
      Carregando…
    </div>;
  }
  if (erro || !d) {
    return <div style={{ minHeight: "100vh", background: T.bg0, color: T.t1, fontFamily: F, padding: 40 }}>
      <a href="/ci" style={{ color: T.blue, fontSize: 13.5, textDecoration: "none" }}>← Visão geral</a>
      <Card style={{ marginTop: 16, borderColor: "rgba(248,113,113,.4)" }}>
        <div style={{ color: T.red, fontSize: 13.5 }}>{erro ?? "Sem dados."}</div>
      </Card>
    </div>;
  }

  const ad: Row = d.ad;
  const asset: Row | undefined = d.assets[0];
  const transcript: Row | undefined = d.transcripts[0];
  const termoDe = (termId: string) => (d.termos as Row[]).find(t => t.id === termId);

  // Classificações agrupadas por tipo, cada uma com sua evidência.
  const porKind = new Map<string, Row[]>();
  for (const v of d.taxo as Row[]) {
    const t = termoDe(v.term_id);
    if (!t) continue;
    const lista = porKind.get(t.kind) ?? [];
    lista.push({ ...v, label: t.label, slug: t.slug });
    porKind.set(t.kind, lista);
  }
  const kindsOrdenados = [...porKind.keys()].sort((a, b) => {
    const ordem = ["hook", "hook_written", "hook_visual", "angle", "promise",
      "proof", "demonstration", "objection", "offer", "cta"];
    const ia = ordem.indexOf(a), ib = ordem.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const semAnalise = (d.taxo as Row[]).length === 0;

  return (
    <LayoutCI ativo="anuncios" brandId={ad?.brand_id} larguraMax={1180}>

        <div style={{ margin: "14px 0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
              {ad.headline || ad.page_name || "Anúncio"}
            </h1>
            {ad.is_demo && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: T.yellow,
                border: `1px solid ${T.yellow}`, borderRadius: 5, padding: "2px 7px",
              }}>DEMONSTRAÇÃO</span>
            )}
            {ad.is_active && (
              <span style={{ fontSize: 11.5, color: T.green }}>● no ar</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.t3, marginTop: 6 }}>
            {[ad.ad_archive_id, ad.display_format,
              ad.running_days != null && `${ad.running_days} dias no ar`,
              (ad.countries ?? []).join(", ")].filter(Boolean).join(" · ")}
          </div>
        </div>

        {semAnalise && (
          <Card style={{ borderColor: "rgba(251,191,36,.38)", background: "rgba(251,191,36,.045)" }}>
            <div style={{ color: T.yellow, fontWeight: 620, fontSize: 13.5, marginBottom: 4 }}>
              Este anúncio ainda não foi analisado
            </div>
            <div style={{ color: T.t2, fontSize: 13, lineHeight: 1.55 }}>
              O vídeo pode já estar no armazenamento, mas as classificações só
              aparecem depois que o worker termina os 11 estágios. Status do asset:{" "}
              <strong>{asset?.analysis_status ?? "sem asset"}</strong>.
            </div>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)", gap: 14, alignItems: "start" }}>

          {/* ── Coluna esquerda: a mídia ────────────────────────────────── */}
          <div>
            <Card>
              <Head nota="Servido do bucket privado por URL assinada, válida por 1 hora.">Vídeo</Head>
              {falhaMidia ? (
                <Vazio>
                  Não foi possível assinar a URL do vídeo: {falhaMidia}. Isso costuma
                  ser a policy de leitura do bucket faltando.
                </Vazio>
              ) : videoUrl ? (
                <video src={videoUrl} controls playsInline
                       style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 460 }} />
              ) : (
                <Vazio>Nenhum vídeo armazenado para este anúncio ainda.</Vazio>
              )}
              {asset && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 11.8, color: T.t3 }}>
                  {asset.duration_seconds != null && <span>{tempo(asset.duration_seconds)}</span>}
                  {asset.width && <span>{asset.width}×{asset.height}</span>}
                  {asset.fps && <span>{Math.round(Number(asset.fps))} fps</span>}
                  <span>{asset.has_audio ? "com áudio" : "sem áudio"}</span>
                  {asset.sha256 && <span title="Identidade do arquivo. A deduplicação é por este hash, não por URL.">
                    sha {String(asset.sha256).slice(0, 10)}
                  </span>}
                </div>
              )}
            </Card>

            <Card>
              <Head nota="Um por cena, mais a capa e o fim. É o que o modelo viu.">
                Keyframes ({d.keyframes.length})
              </Head>
              {d.keyframes.length === 0 ? (
                <Vazio>Nenhum keyframe extraído ainda.</Vazio>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                  {(d.keyframes as Row[]).slice(0, 24).map(k => (
                    <div key={k.id}>
                      {urls[k.id]
                        ? <img src={urls[k.id]} alt={`${tempo(k.timestamp_s)}`} style={{
                            width: "100%", aspectRatio: "9/16", objectFit: "cover",
                            borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg3,
                          }} />
                        : <div style={{
                            width: "100%", aspectRatio: "9/16", borderRadius: 7,
                            background: T.bg3, border: `1px dashed ${T.b2}`,
                          }} />}
                      <div style={{ fontSize: 10, color: T.t3, marginTop: 3, textAlign: "center" }}>
                        {tempo(k.timestamp_s)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── Coluna direita: o que a análise extraiu ─────────────────── */}
          <div>
            <Card>
              <Head nota="Toda classificação vem com a evidência que a sustenta. Item sem evidência é descartado antes de chegar aqui — de propósito.">
                Classificações ({(d.taxo as Row[]).length})
              </Head>
              {kindsOrdenados.length === 0 ? (
                <Vazio>Nenhuma classificação ainda.</Vazio>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {kindsOrdenados.map(kind => (
                    <div key={kind}>
                      <div style={{
                        fontSize: 11, letterSpacing: ".07em", textTransform: "uppercase",
                        color: KIND_COR[kind] ?? T.label, fontWeight: 660, marginBottom: 7,
                      }}>{KIND_ROTULO[kind] ?? kind}</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(porKind.get(kind) ?? []).map((v, i) => (
                          <div key={i} style={{
                            background: T.bg2, border: `1px solid ${T.b1}`,
                            borderRadius: 9, padding: "10px 12px",
                          }}>
                            <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                              <span style={{ flex: 1, fontSize: 13.2 }}>{v.label}</span>
                              {v.timestamp_s != null && (
                                <span style={{ fontSize: 11, color: T.t3 }}>{tempo(v.timestamp_s)}</span>
                              )}
                              <span title="Confiança do modelo nesta classificação"
                                    style={{ fontSize: 11, color: T.label, fontVariantNumeric: "tabular-nums" }}>
                                {(Number(v.confidence) * 100).toFixed(0)}%
                              </span>
                            </div>
                            {v.evidence && (
                              <div style={{
                                fontSize: 12, color: T.t2, marginTop: 6, paddingLeft: 10,
                                borderLeft: `2px solid ${KIND_COR[kind] ?? T.b2}`, lineHeight: 1.5,
                              }}>
                                {v.evidence}
                                {v.evidence_kind && (
                                  <span style={{ color: T.label, marginLeft: 6, fontSize: 11 }}>
                                    ({v.evidence_kind})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <Head nota="Detectadas pelo corte do ffmpeg; a descrição vem do modelo.">
                Cenas ({d.cenas.length})
              </Head>
              {d.cenas.length === 0 ? (
                <Vazio>Nenhuma cena detectada ainda.</Vazio>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {(d.cenas as Row[]).map(c => (
                    <div key={c.id} style={{
                      background: T.bg2, borderRadius: 9, padding: "10px 12px", fontSize: 12.6,
                    }}>
                      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                        <span style={{ color: T.t3, fontVariantNumeric: "tabular-nums", minWidth: 76 }}>
                          {tempo(c.start_seconds)}–{tempo(c.end_seconds)}
                        </span>
                        {c.scene_function && (
                          <span style={{
                            fontSize: 10.5, color: T.violet, border: "1px solid rgba(167,139,250,.4)",
                            borderRadius: 5, padding: "2px 7px",
                          }}>{FUNCAO_CENA[c.scene_function] ?? c.scene_function}</span>
                        )}
                        {c.product_visible && (
                          <span style={{ fontSize: 10.5, color: T.green }}>produto à vista</span>
                        )}
                      </div>
                      {(c.description || c.setting) && (
                        <div style={{ color: T.t2, marginTop: 5, lineHeight: 1.5 }}>
                          {c.description || c.setting}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <Head nota={transcript
                ? `${transcript.engine_model ?? "whisper"} · ${transcript.language ?? "?"} · ${transcript.word_count ?? 0} palavras`
                : undefined}>
                Transcrição
              </Head>
              {!transcript ? (
                <Vazio>
                  {asset?.has_audio === false
                    ? "Vídeo sem trilha de áudio — não há o que transcrever."
                    : "Ainda não transcrito."}
                </Vazio>
              ) : (d.segmentos as Row[]).length === 0 ? (
                <div style={{ fontSize: 12.8, color: T.t2, lineHeight: 1.6 }}>{transcript.full_text}</div>
              ) : (
                <div style={{ display: "grid", gap: 5, maxHeight: 300, overflowY: "auto" }}>
                  {(d.segmentos as Row[]).map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                      <span style={{ color: T.t3, fontVariantNumeric: "tabular-nums", minWidth: 42 }}>
                        {tempo(s.start_seconds)}
                      </span>
                      <span style={{ color: T.t2, lineHeight: 1.5 }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <Head nota="Faixa temporal: quando cada texto entrou e saiu da tela.">
                Texto na tela ({d.onscreen.length})
              </Head>
              {d.onscreen.length === 0 ? (
                <Vazio>
                  Nenhum texto lido. Pode ser que o anúncio não tenha texto sobreposto,
                  ou que o estágio de OCR tenha sido pulado — nesse caso ele aparece em
                  amarelo na visão geral.
                </Vazio>
              ) : (
                <div style={{ display: "grid", gap: 5 }}>
                  {(d.onscreen as Row[]).map(o => (
                    <div key={o.id} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                      <span style={{ color: T.t3, fontVariantNumeric: "tabular-nums", minWidth: 76 }}>
                        {tempo(o.start_seconds)}–{tempo(o.end_seconds)}
                      </span>
                      <span style={{ color: T.t2, flex: 1 }}>{o.text}</span>
                      <span style={{ color: T.label, fontSize: 11 }}>
                        {(Number(o.confidence) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {ad.body_text && (
              <Card>
                <Head>Texto do anúncio</Head>
                <div style={{ fontSize: 12.8, color: T.t2, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {ad.body_text}
                </div>
                {ad.cta && (
                  <div style={{ marginTop: 10, fontSize: 12.3, color: T.t3 }}>
                    CTA: <span style={{ color: T.yellow }}>{ad.cta}</span>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.b1}`,
          fontSize: 12, color: T.t3, lineHeight: 1.55,
        }}>
          Tudo nesta página foi observado no criativo público. Nada aqui é desempenho,
          ROAS ou CPA, e nada vem da conta de anúncios da marca.
        </div>
    </LayoutCI>
  );
}
