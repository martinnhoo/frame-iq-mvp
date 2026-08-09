/**
 * /shapermint — Creative Intelligence
 *
 * Primeira tela do módulo. Lê DIRETO das tabelas ci_* pelo client do Supabase;
 * a RLS já garante que cada usuário só vê o que é dele, então não há endpoint
 * intermediário nem risco de vazar dado de outra conta.
 *
 * ── O que ela é e o que não é ─────────────────────────────────────────────
 * É funcional: todo número aqui vem de uma consulta real, e quando não há dado
 * ela diz isso em vez de mostrar zero como se fosse resultado. Não é a UI
 * definitiva — não tem filtro, ordenação nem paginação, e o layout é uma
 * coluna. A prioridade agora é ver o que o pipeline produziu.
 *
 * Os tokens de cor são os do CLAUDE.md, que é o que as páginas do dashboard
 * realmente usam.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { T } from "@/ci/tema";


type Row = Record<string, any>;

interface Data {
  brand: Row | null;
  page: Row | null;
  ads: Row[];
  assets: Row[];
  scenes: Row[];
  keyframes: Row[];
  transcripts: Row[];
  segments: Row[];
  onscreen: Row[];
  results: Row[];
  terms: Row[];
  taxonomy: Row[];
  dlJobs: Row[];
  anJobs: Row[];
  runs: Row[];
  events: Row[];
  storage: Row[];
}

const EMPTY: Data = {
  brand: null, page: null, ads: [], assets: [], scenes: [], keyframes: [],
  transcripts: [], segments: [], onscreen: [], results: [], terms: [],
  taxonomy: [], dlJobs: [], anJobs: [], runs: [], events: [], storage: [],
};

export default function Shapermint() {
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) { setAuthed(false); setLoading(false); return; }
      setAuthed(true);

      const q = (t: string, sel = "*", order?: string) => {
        let b = (supabase.from(t as any).select(sel) as any);
        if (order) b = b.order(order);
        return b;
      };

      const [brands, pages, ads, assets, scenes, keyframes, transcripts,
             segments, onscreen, results, terms, taxonomy,
             dl, an, runs, events, storage] = await Promise.all([
        q("ci_brands"), q("ci_brand_pages"), q("ci_ads"), q("ci_assets"),
        q("ci_scenes", "*", "scene_index"), q("ci_keyframes", "*", "frame_index"),
        q("ci_transcripts"), q("ci_transcript_segments", "*", "segment_index"),
        q("ci_onscreen_text", "*", "track_index"), q("ci_analysis_results"),
        q("ci_taxonomy_terms"), q("ci_ad_taxonomy"),
        q("ci_download_jobs"), q("ci_analysis_jobs"), q("ci_model_runs"),
        q("ci_job_events", "*", "created_at"), q("ci_storage_objects"),
      ]);

      const firstError = [brands, ads, assets].find((r: any) => r.error);
      if (firstError?.error) throw new Error(firstError.error.message);

      setData({
        brand: brands.data?.[0] ?? null,
        page: (pages.data ?? []).find((p: Row) => p.is_selected) ?? pages.data?.[0] ?? null,
        ads: ads.data ?? [], assets: assets.data ?? [], scenes: scenes.data ?? [],
        keyframes: keyframes.data ?? [], transcripts: transcripts.data ?? [],
        segments: segments.data ?? [], onscreen: onscreen.data ?? [],
        results: results.data ?? [], terms: terms.data ?? [],
        taxonomy: taxonomy.data ?? [], dlJobs: dl.data ?? [], anJobs: an.data ?? [],
        runs: runs.data ?? [], events: (events.data ?? []).slice(-25).reverse(),
        storage: storage.data ?? [],
      });

      // URLs assinadas para os keyframes. O bucket é privado — nada é servido
      // por endereço permanente.
      const keys = (keyframes.data ?? []).map((k: Row) => k.storage_key).filter(Boolean);
      const thumb = (assets.data ?? []).map((a: Row) => a.storage_key).filter(Boolean);
      const all = [...keys, ...thumb];
      if (all.length) {
        const { data: urls } = await supabase.storage.from("ci-media").createSignedUrls(all, 3600);
        const map: Record<string, string> = {};
        (urls ?? []).forEach((u: any) => { if (u.signedUrl && !u.error) map[u.path] = u.signedUrl; });
        setSigned(map);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Estados ───────────────────────────────────────────────────────────────
  if (authed === false) return <Shell><Msg title="Faça login" body="Esta página lê os seus dados, então precisa da sua sessão." action={<a href="/login" style={btn}>Entrar</a>} /></Shell>;
  if (loading) return <Shell><Msg title="Carregando…" body="Consultando o banco." /></Shell>;
  if (err) return <Shell><Msg title="Não foi possível carregar" body={err} tone={T.red} action={<button onClick={load} style={btn}>Tentar de novo</button>} /></Shell>;
  if (!data.brand) return <Shell><Msg title="Nenhuma marca ainda" body="Rode a busca de marca para começar. Nada foi importado até agora." /></Shell>;

  const asset = data.assets[0];
  const result = data.results[0];
  const anJob = data.anJobs[0];
  const norm = result?.normalized_output ?? {};
  const bytes = data.storage.reduce((s: number, o: Row) => s + (o.size_bytes ?? 0), 0);
  const cost = data.runs.reduce((s: number, r: Row) => s + Number(r.cost_usd ?? 0), 0);
  const dedupSaved = data.ads.length - data.assets.length;

  return (
    <Shell>
      {/* ── Cabeçalho ── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
          {data.brand.name}
        </h1>
        <span style={{ ...lbl }}>CREATIVE INTELLIGENCE</span>
        <button onClick={load} style={{ ...btn, marginLeft: "auto", padding: "7px 14px", fontSize: 12 }}>
          Atualizar
        </button>
      </div>
      {data.page && (
        <div style={{ color: T.t3, fontSize: 12, marginBottom: 22 }}>
          Página oficial: <b style={{ color: T.t2 }}>{data.page.page_name}</b> · {data.page.page_id}
          {data.page.verification?.includes("BLUE") && <span style={{ color: T.blue }}> · verificada</span>}
          {data.page.likes && <> · {Number(data.page.likes).toLocaleString("pt-BR")} curtidas</>}
        </div>
      )}

      {/* ── Números ── */}
      <Grid>
        <Stat n={data.ads.length} l="Anúncios" />
        <Stat n={data.assets.length} l="Assets únicos" />
        <Stat n={dedupSaved > 0 ? dedupSaved : 0} l="Duplicatas evitadas" tone={dedupSaved > 0 ? T.green : undefined} />
        <Stat n={data.scenes.length} l="Cenas" />
        <Stat n={data.keyframes.length} l="Keyframes" />
        <Stat n={data.terms.length} l="Termos" />
        <Stat n={(bytes / 1048576).toFixed(1) + " MB"} l="Storage" />
        <Stat n={"US$ " + cost.toFixed(4)} l="Custo de IA" tone={T.violet} />
      </Grid>

      {/* ── Pipeline ── */}
      {anJob && (
        <Card title="Pipeline" right={<Badge tone={anJob.status === "completed" ? T.green : anJob.status === "failed" ? T.red : T.yellow}>{anJob.status} · {anJob.progress}%</Badge>}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(anJob.completed_stages ?? []).map((s: string) => {
              const sk = (anJob.skipped_stages ?? []).includes(s);
              return (
                <span key={s} style={{
                  fontSize: 11, padding: "4px 9px", borderRadius: 6,
                  background: sk ? "rgba(251,191,36,0.10)" : "rgba(74,222,128,0.10)",
                  color: sk ? T.yellow : T.green,
                  border: `1px solid ${sk ? "rgba(251,191,36,0.22)" : "rgba(74,222,128,0.22)"}`,
                }}>{sk ? "↷" : "✓"} {s}</span>
              );
            })}
          </div>
          {/* O que foi PULADO importa tanto quanto o que rodou: um anúncio sem
              transcrição precisa ser distinguível de um anúncio mudo. */}
          {(anJob.skipped_stages ?? []).length > 0 && (
            <p style={{ ...small, marginTop: 10 }}>
              Amarelo = estágio pulado. O resultado é parcial, não completo.
            </p>
          )}
          {anJob.llm_provider && (
            <p style={{ ...small, marginTop: 8 }}>
              {anJob.llm_provider} {anJob.llm_model} · {anJob.llm_input_tokens} in / {anJob.llm_output_tokens} out · US$ {anJob.cost_usd}
            </p>
          )}
        </Card>
      )}

      {/* ── Anúncio ── */}
      {data.ads.map((ad: Row) => (
        <Card key={ad.id} title={ad.headline || ad.ad_archive_id}
              right={ad.is_demo ? <Badge tone={T.yellow}>DEMO</Badge> : <Badge tone={T.green}>real</Badge>}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px,280px) 1fr", gap: 20 }}>
            <div>
              {asset && signed[asset.thumbnail_key ?? ""] ? (
                <img src={signed[asset.thumbnail_key]} alt="" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.b1}` }} />
              ) : asset && signed[asset.storage_key] ? (
                <video src={signed[asset.storage_key]} controls style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.b1}`, background: "#000" }} />
              ) : (
                <div style={{ ...empty, height: 150 }}>sem mídia</div>
              )}
              {asset && (
                <p style={{ ...small, marginTop: 8 }}>
                  {asset.duration_seconds}s · {asset.width}×{asset.height} · {asset.aspect_ratio}<br />
                  {asset.video_codec}/{asset.audio_codec ?? "sem áudio"} · {((asset.file_size_bytes ?? 0) / 1024).toFixed(0)} KB<br />
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: T.label }}>
                    sha {String(asset.sha256).slice(0, 16)}…
                  </span>
                </p>
              )}
            </div>
            <div>
              {ad.body_text && <p style={{ color: T.t2, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>{ad.body_text}</p>}
              <p style={small}>
                {ad.page_name} · {ad.media_type} · {ad.is_active ? "ativo" : "inativo"}
                {ad.running_days ? ` · ${ad.running_days} dias no ar` : ""}
                {ad.cta ? ` · ${ad.cta}` : ""}
              </p>
              {result && (
                <p style={{ ...small, marginTop: 10 }}>
                  {result.cut_count} corte(s) · {result.cuts_per_second}/s ·
                  {" "}<span style={{ color: result.fidelity === "full" ? T.green : T.yellow }}>
                    análise {result.fidelity === "full" ? "completa" : "degradada"}
                  </span>
                </p>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* ── Keyframes ── */}
      {data.keyframes.length > 0 && (
        <Card title={`Keyframes (${data.keyframes.length})`}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {data.keyframes.map((k: Row) => (
              <div key={k.id} style={{ flex: "0 0 auto" }}>
                {signed[k.storage_key]
                  ? <img src={signed[k.storage_key]} alt="" style={{ height: 96, borderRadius: 8, border: `1px solid ${T.b1}`, display: "block" }} />
                  : <div style={{ ...empty, width: 150, height: 96 }}>—</div>}
                <p style={{ ...small, marginTop: 5, textAlign: "center" }}>
                  {Number(k.timestamp_s).toFixed(1)}s<br />
                  <span style={{ color: T.label, fontSize: 10 }}>{k.reason}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Cenas ── */}
      {data.scenes.length > 0 && (
        <Card title={`Cenas (${data.scenes.length})`}>
          {data.scenes.map((s: Row) => (
            <div key={s.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.b0}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: T.blue }}>
                  {Number(s.start_seconds).toFixed(1)}s → {Number(s.end_seconds).toFixed(1)}s
                </span>
                {s.scene_function && <Badge tone={T.violet}>{s.scene_function}</Badge>}
                {s.setting && <span style={{ fontSize: 12, color: T.t2 }}>{s.setting}</span>}
              </div>
              {s.description && <p style={{ ...small, marginTop: 5 }}>{s.description}</p>}
            </div>
          ))}
        </Card>
      )}

      {/* ── Taxonomia: sempre com a evidência à vista ── */}
      {data.terms.length > 0 && (
        <Card title={`Taxonomia (${data.terms.length})`}>
          {data.terms.map((t: Row) => {
            const link = data.taxonomy.find((x: Row) => x.term_id === t.id);
            return (
              <div key={t.id} style={{ padding: "10px 0", borderTop: `1px solid ${T.b0}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge tone={T.blue}>{t.kind}</Badge>
                  <b style={{ color: T.t1, fontSize: 13 }}>{t.label}</b>
                  {link && <span style={{ ...small }}>confiança {link.confidence}</span>}
                </div>
                {/* A evidência não é detalhe opcional: é o que permite auditar
                    por que o sistema classificou assim. */}
                {link?.evidence && (
                  <p style={{ ...small, marginTop: 5, borderLeft: `2px solid ${T.b2}`, paddingLeft: 9 }}>
                    {link.evidence}
                    {link.timestamp_s != null && <span style={{ color: T.label }}> · {link.timestamp_s}s</span>}
                    <span style={{ color: T.label }}> · {link.source}/{link.model_version}</span>
                  </p>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Transcrição ── */}
      <Card title="Transcrição">
        {data.segments.length > 0 ? data.segments.map((s: Row) => (
          <div key={s.id} style={{ display: "flex", gap: 10, padding: "5px 0" }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: T.blue, flex: "0 0 auto" }}>
              {Number(s.start_seconds).toFixed(1)}s
            </span>
            <span style={{ fontSize: 13, color: T.t2 }}>{s.text}</span>
          </div>
        )) : (
          <p style={small}>
            Nenhuma fala transcrita.{" "}
            {(anJob?.skipped_stages ?? []).includes("transcription")
              ? "O estágio foi pulado — veja o pipeline acima."
              : "O vídeo pode não ter fala."}
          </p>
        )}
      </Card>

      {/* ── Texto na tela ── */}
      {data.onscreen.length > 0 && (
        <Card title={`Texto na tela (${data.onscreen.length})`}>
          {data.onscreen.map((o: Row) => (
            <div key={o.id} style={{ display: "flex", gap: 10, padding: "5px 0" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: T.blue }}>
                {Number(o.start_seconds).toFixed(1)}–{Number(o.end_seconds).toFixed(1)}s
              </span>
              <span style={{ fontSize: 13, color: T.t2 }}>{o.text}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ── Bruto ── */}
      {result && (
        <Card title="Resultado normalizado">
          <details>
            <summary style={{ cursor: "pointer", color: T.t3, fontSize: 12 }}>
              JSON completo — {norm.terms?.length ?? 0} termos, {norm.scenes?.length ?? 0} cenas
            </summary>
            <pre style={{
              marginTop: 10, fontSize: 11, color: T.t2, background: T.bg0, padding: 12,
              borderRadius: 8, overflowX: "auto", maxHeight: 340, border: `1px solid ${T.b0}`,
            }}>{JSON.stringify(norm, null, 2)}</pre>
          </details>
        </Card>
      )}

      {/* ── Eventos ── */}
      {data.events.length > 0 && (
        <Card title="Últimos eventos">
          {data.events.map((e: Row) => (
            <div key={e.id} style={{ display: "flex", gap: 9, padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: T.label, fontFamily: "monospace", fontSize: 10, flex: "0 0 auto" }}>
                {new Date(e.created_at).toLocaleTimeString("pt-BR")}
              </span>
              <span style={{ color: e.level === "error" ? T.red : e.level === "warn" ? T.yellow : T.t3 }}>
                {e.message}
              </span>
            </div>
          ))}
        </Card>
      )}

      <p style={{ ...small, marginTop: 28, textAlign: "center" }}>
        Tela técnica. Todo número vem de consulta real ao banco — nada é estimado nem simulado.
      </p>
    </Shell>
  );
}

// ── Peças ────────────────────────────────────────────────────────────────────

const lbl = { fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: T.label, textTransform: "uppercase" as const };
const small = { fontSize: 12, color: T.t3, margin: 0, lineHeight: 1.55 };
const empty = { display: "flex", alignItems: "center", justifyContent: "center", background: T.bg2, border: `1px dashed ${T.b1}`, borderRadius: 8, color: T.label, fontSize: 11 };
const btn = { background: T.blue, color: "#fff", border: "none", padding: "9px 18px", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "none", display: "inline-block" };

/**
 * Esta tela é candidata a ser aposentada (T5 do FALTA.md) — ela e /ci mostram
 * a mesma coisa, e manter duas significa que uma delas envelhece. Enquanto
 * existe, compartilha a mesma navegação: uma tela órfã dentro do produto é
 * pior que uma tela redundante.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return <LayoutCI ativo="anuncios" larguraMax={1000}>{children}</LayoutCI>;
}

function Msg({ title, body, tone, action }: { title: string; body: string; tone?: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 12, padding: 34, textAlign: "center", marginTop: 60 }}>
      <h2 style={{ color: tone ?? T.t1, fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{title}</h2>
      <p style={{ color: T.t3, fontSize: 13, margin: "0 0 18px" }}>{body}</p>
      {action}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(132px,1fr))", gap: 10, marginBottom: 20 }}>{children}</div>;
}

function Stat({ n, l, tone }: { n: React.ReactNode; l: string; tone?: string }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 10, padding: "13px 15px" }}>
      <div style={{ fontSize: 21, fontWeight: 700, color: tone ?? T.t1, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={lbl}>{l}</div>
    </div>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h3 style={{ ...lbl, margin: 0 }}>{title}</h3>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      {children}
    </div>
  );
}

function Badge({ children, tone = T.t3 }: { children: React.ReactNode; tone?: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5,
      color: tone, background: `${tone}18`, border: `1px solid ${tone}30`,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>{children}</span>
  );
}
