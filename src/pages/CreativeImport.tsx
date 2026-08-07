/**
 * /importar — Importação por nome da marca
 *
 * O fluxo inteiro numa tela: digita o nome, escolhe a página oficial, vê quanto
 * vai custar, importa, e acompanha a fila até o fim. Sem console, sem SQL.
 *
 * ── Duas decisões que valem explicação ────────────────────────────────────
 *
 * 1. O ensaio é obrigatório, não opcional. Toda importação passa por dry_run
 *    antes, e o botão de importar de verdade só aparece depois que o custo foi
 *    mostrado. Crédito é dinheiro do usuário; gastar sem ele ter visto o número
 *    seria uma escolha de produto, não um detalhe de implementação.
 *
 * 2. O relatório de importação aparece SEMPRE, inclusive no sucesso. Uma
 *    importação que devolve 200 e cria zero anúncios é indistinguível de uma
 *    que funcionou, se a tela só mostrar "concluído" — foi exatamente assim que
 *    a primeira execução real passou despercebida. Aqui, ads_returned,
 *    credits_spent e os itens recusados com motivo ficam na cara.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  b1: "rgba(240,246,252,0.07)", b2: "rgba(240,246,252,0.12)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  blue: "#0ea5e9", green: "#4ADE80", red: "#F87171", yellow: "#FBBF24", purple: "#A78BFA",
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

type Row = Record<string, any>;

interface PageOption {
  page_id: string; name: string; category: string | null; likes: number | null;
  verification: string | null; ig_username: string | null; ig_followers: number | null;
  image_uri: string | null; official_score: number; is_likely_official: boolean;
}

const num = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString("pt-BR") : "—";

async function callFn<T = any>(fn: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada. Faça login de novo.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = { error: "resposta_invalida", message: text.slice(0, 400) }; }
  return { ok: r.ok, data: parsed };
}

// ── Peças visuais ───────────────────────────────────────────────────────────

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 14,
    padding: 22, marginBottom: 18, ...style,
  }}>{children}</div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 11, letterSpacing: ".09em", textTransform: "uppercase",
    color: T.label, fontWeight: 600, marginBottom: 12,
  }}>{children}</div>
);

const Stat = ({ k, v, tone }: { k: string; v: React.ReactNode; tone?: string }) => (
  <div style={{ minWidth: 108 }}>
    <div style={{ fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase", color: T.label, marginBottom: 5 }}>{k}</div>
    <div style={{ fontSize: 21, fontWeight: 650, color: tone ?? T.t1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
  </div>
);

const Btn = ({ children, onClick, disabled, tone = T.blue, ghost }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: string; ghost?: boolean;
}) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: ghost ? "transparent" : disabled ? T.bg3 : tone,
    color: ghost ? T.t2 : disabled ? T.t3 : "#04121C",
    border: ghost ? `1px solid ${T.b2}` : "none",
    borderRadius: 9, padding: "11px 20px", fontSize: 14, fontWeight: 620,
    fontFamily: F, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
  }}>{children}</button>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function CreativeImport() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [brand, setBrand] = useState<Row | null>(null);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<Row | null>(null);
  const [report, setReport] = useState<Row | null>(null);
  const [fila, setFila] = useState<{ downloads: Row[]; analises: Row[] } | null>(null);

  // ALL e não VIDEO.
  //
  // Medido em 06/08 contra a página oficial da Shapermint: display_format=VIDEO
  // devolve ZERO anúncios e cobra ZERO créditos, terminando com
  // stop_reason "no_more_pages" — indistinguível de "essa marca não anuncia".
  // O mesmo pedido com ALL devolveu 10 anúncios, todos com mídia de vídeo.
  // O filtro de formato da SpreshApp não faz o que o nome promete; filtrar por
  // vídeo é trabalho nosso, depois, olhando media_type do que veio.
  const [formato, setFormato] = useState<"VIDEO" | "IMAGE" | "ALL">("ALL");
  // 2 caracteres cortava "ALL", que é justamente o valor para não filtrar país.
  const [pais, setPais] = useState("US");
  const [maxAds, setMaxAds] = useState(20);

  const timer = useRef<number | null>(null);

  // ── 1. Buscar a marca ─────────────────────────────────────────────────────
  const buscar = async () => {
    setErro(null); setBusy("busca");
    setBrand(null); setPages([]); setChosen(null); setEstimate(null); setReport(null);
    try {
      const { ok, data } = await callFn("ci-brand-search", { query: query.trim() });
      if (!ok) throw new Error(data?.message || data?.error || "falha na busca");
      setBrand(data.brand);
      setPages(data.pages ?? []);
      // Pré-seleciona a mais provável, mas NÃO decide sozinho: importar da
      // página errada gasta crédito e polui a base da marca.
      const provavel = (data.pages ?? []).find((p: PageOption) => p.is_likely_official);
      if (provavel) setChosen(provavel.page_id);
    } catch (e: any) { setErro(e.message); }
    finally { setBusy(null); }
  };

  // ── 2. Confirmar a página e pedir a estimativa ────────────────────────────
  const estimar = async () => {
    if (!brand || !chosen) return;
    setErro(null); setBusy("estimativa"); setReport(null);
    try {
      const sel = await callFn("ci-brand-search", { brand_id: brand.id, select_page_id: chosen });
      if (!sel.ok) throw new Error(sel.data?.message || "não foi possível marcar a página");

      const { ok, data } = await callFn("ci-import-run", {
        brand_id: brand.id, max_ads: maxAds, dry_run: true,
        filters: { display_format: formato, country: pais, sort: "longest_running" },
      });
      if (!ok) throw new Error(data?.message || data?.error || "falha na estimativa");
      setEstimate(data);
    } catch (e: any) { setErro(e.message); }
    finally { setBusy(null); }
  };

  // ── 3. Importar de verdade ────────────────────────────────────────────────
  //
  // `continuar` decide entre começar do zero e retomar do cursor da execução
  // anterior. Sem esse parâmetro, TODA execução recomeça da primeira página —
  // e como a API cobra por anúncio devolvido, rodar de novo repaga tudo o que
  // já veio. Medido em 07/08: 20 créditos gastos para trazer 20 anúncios que
  // já estavam no banco, com "Criados: 0" no relatório.
  //
  // A tela dizia "rodar de novo continua de onde parou" antes de isto existir.
  // O texto estava certo sobre a intenção e errado sobre o código, que é a
  // pior combinação possível: promete e cobra.
  const importar = async (continuar = false) => {
    if (!brand) return;
    setErro(null); setBusy("importacao");
    try {
      const { ok, data } = await callFn("ci-import-run", {
        brand_id: brand.id, max_ads: maxAds,
        ...(continuar && report?.run_id ? { resume_run_id: report.run_id } : {}),
        filters: { display_format: formato, country: pais, sort: "longest_running" },
      });
      if (!ok) throw new Error(data?.message || data?.error || "falha na importação");
      setReport(data);
    } catch (e: any) { setErro(e.message); }
    finally { setBusy(null); }
  };

  // ── 4. Acompanhar a fila ──────────────────────────────────────────────────
  const lerFila = useCallback(async (brandId: string) => {
    const [d, a] = await Promise.all([
      supabase.from("ci_download_jobs")
        .select("id,status,stage,progress,error,attempts").eq("brand_id", brandId),
      supabase.from("ci_analysis_jobs")
        .select("id,status,stage,progress,error,attempts,completed_stages,skipped_stages")
        .eq("brand_id", brandId),
    ]);
    setFila({ downloads: d.data ?? [], analises: a.data ?? [] });
  }, []);

  useEffect(() => {
    if (!brand?.id) return;
    lerFila(brand.id);
    timer.current = window.setInterval(() => lerFila(brand.id), 4000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [brand?.id, report, lerFila]);

  const contar = (rows: Row[], s: string) => rows.filter(r => r.status === s).length;

  // ═════════════════════════════════════════════════════════════════════════

  return (
    <LayoutCI ativo="marcas" brandId={brand?.id} larguraMax={860}>

        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 27, fontWeight: 680, margin: 0, letterSpacing: "-.02em" }}>
            Importar anúncios de uma marca
          </h1>
          <p style={{ color: T.t3, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            Digite o nome, confirme a página oficial e veja o custo antes de gastar crédito.
            O worker baixa e analisa cada vídeo sozinho depois disso.
          </p>
        </div>

        {erro && (
          <Card style={{ borderColor: "rgba(248,113,113,.4)", background: "rgba(248,113,113,.06)" }}>
            <div style={{ color: T.red, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Não deu certo</div>
            <div style={{ color: T.t2, fontSize: 13.5, lineHeight: 1.55 }}>{erro}</div>
          </Card>
        )}

        {/* ── Busca ──────────────────────────────────────────────────────── */}
        <Card>
          <Label>1 · Marca</Label>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && query.trim().length >= 2 && buscar()}
              placeholder="Shapermint"
              style={{
                flex: 1, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 9,
                padding: "11px 14px", color: T.t1, fontSize: 15, fontFamily: F, outline: "none",
              }}
            />
            <Btn onClick={buscar} disabled={query.trim().length < 2 || busy === "busca"}>
              {busy === "busca" ? "Buscando…" : "Buscar"}
            </Btn>
          </div>
          <div style={{ color: T.label, fontSize: 12, marginTop: 9 }}>
            A busca de marca custa 1 crédito por consulta.
          </div>
        </Card>

        {/* ── Escolha da página ──────────────────────────────────────────── */}
        {pages.length > 0 && (
          <Card>
            <Label>2 · Qual página é a oficial</Label>
            <div style={{ display: "grid", gap: 8 }}>
              {pages.map(p => {
                const sel = chosen === p.page_id;
                return (
                  <button key={p.page_id} onClick={() => setChosen(p.page_id)} style={{
                    display: "flex", alignItems: "center", gap: 13, textAlign: "left",
                    background: sel ? "rgba(14,165,233,.09)" : T.bg2,
                    border: `1px solid ${sel ? T.blue : T.b1}`,
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: F,
                  }}>
                    {p.image_uri
                      ? <img src={p.image_uri} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover" }} />
                      : <div style={{ width: 38, height: 38, borderRadius: 8, background: T.bg3 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 620, color: T.t1, display: "flex", alignItems: "center", gap: 7 }}>
                        {p.name}
                        {p.verification === "BLUE_VERIFIED" && (
                          <span style={{ fontSize: 10, color: T.blue, border: `1px solid ${T.blue}`, borderRadius: 4, padding: "1px 5px" }}>verificada</span>
                        )}
                        {p.is_likely_official && (
                          <span style={{ fontSize: 10, color: T.green, border: `1px solid rgba(74,222,128,.5)`, borderRadius: 4, padding: "1px 5px" }}>provável oficial</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.t3, marginTop: 3 }}>
                        {[p.category, p.likes != null && `${num(p.likes)} curtidas`,
                          p.ig_username && `@${p.ig_username}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginTop: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: T.label, marginBottom: 6 }}>FORMATO</div>
                <select value={formato} onChange={e => setFormato(e.target.value as any)} style={{
                  background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 8,
                  padding: "9px 11px", color: T.t1, fontSize: 13.5, fontFamily: F,
                }}>
                  <option value="VIDEO">Vídeo</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="ALL">Todos</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.label, marginBottom: 6 }}>PAÍS</div>
                <input value={pais} onChange={e => setPais(e.target.value.toUpperCase().slice(0, 3))} style={{
                  width: 72, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 8,
                  padding: "9px 11px", color: T.t1, fontSize: 13.5, fontFamily: F, outline: "none",
                }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.label, marginBottom: 6 }}>MÁXIMO DE ANÚNCIOS</div>
                <input type="number" min={1} max={200} value={maxAds}
                  onChange={e => setMaxAds(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                  style={{
                    width: 72, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 8,
                    padding: "9px 11px", color: T.t1, fontSize: 13.5, fontFamily: F, outline: "none",
                  }} />
              </div>
              <Btn onClick={estimar} disabled={!chosen || busy === "estimativa"}>
                {busy === "estimativa" ? "Calculando…" : "Ver quanto custa"}
              </Btn>
            </div>
            <div style={{ color: T.label, fontSize: 12, marginTop: 11, lineHeight: 1.5 }}>
              O teto real é do servidor (SPRESHAPP_MAX_ADS_PER_RUN e _MAX_CREDITS_PER_RUN). Pedir mais aqui não
              aumenta o gasto — a função corta.
            </div>
          </Card>
        )}

        {/* ── Estimativa ─────────────────────────────────────────────────── */}
        {estimate && (
          <Card style={{ borderColor: "rgba(14,165,233,.35)" }}>
            <Label>3 · Custo estimado</Label>
            <div style={{ display: "flex", gap: 30, flexWrap: "wrap", marginBottom: 16 }}>
              <Stat k="Créditos" v={
                estimate.estimated_credits?.max != null
                  ? `${estimate.estimated_credits.min}–${estimate.estimated_credits.max}`
                  : num(estimate.estimated_credits)
              } tone={T.blue} />
              <Stat k="Teto da execução" v={num(estimate.max_credits)} />
              <Stat k="Já importados" v={num(estimate.already_imported)} />
            </div>
            {estimate.estimated_credits?.explanation && (
              <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.55, marginBottom: 10 }}>
                {estimate.estimated_credits.explanation}
              </div>
            )}
            {estimate.caveat && (
              <div style={{
                fontSize: 12.5, color: T.t3, lineHeight: 1.55, background: T.bg2,
                border: `1px solid ${T.b1}`, borderRadius: 9, padding: "11px 13px", marginBottom: 16,
              }}>{estimate.caveat}</div>
            )}
            <Btn onClick={() => importar(false)} disabled={busy === "importacao"} tone={T.green}>
              {busy === "importacao" ? "Importando…" : "Importar agora"}
            </Btn>
            {report?.can_resume && (
              <div style={{ marginTop: 11, fontSize: 12.3, color: T.yellow, lineHeight: 1.5 }}>
                Atenção: este botão começa da PRIMEIRA página e a API cobra por anúncio
                devolvido — o que já veio seria pago de novo. Para seguir de onde parou,
                use “Continuar de onde parou” no relatório abaixo.
              </div>
            )}
          </Card>
        )}

        {/* ── Relatório ──────────────────────────────────────────────────── */}
        {report && (() => {
          const vazio = (report.ads_created ?? 0) === 0 && (report.ads_updated ?? 0) === 0;
          return (
            <Card style={{ borderColor: vazio ? "rgba(251,191,36,.4)" : "rgba(74,222,128,.35)" }}>
              <Label>4 · O que a importação fez</Label>

              {vazio && (
                <div style={{
                  background: "rgba(251,191,36,.07)", border: "1px solid rgba(251,191,36,.3)",
                  borderRadius: 9, padding: "12px 14px", marginBottom: 18,
                  fontSize: 13.5, color: T.yellow, lineHeight: 1.55,
                }}>
                  A execução terminou sem erro, mas <strong>nenhum anúncio entrou</strong>. Os números
                  abaixo dizem por quê: se <code>ads_returned</code> for 0, a SpreshApp não devolveu
                  nada para esse filtro. Se for maior que 0, o problema está na normalização e os
                  itens recusados aparecem no fim com o motivo.
                </div>
              )}

              <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginBottom: 20 }}>
                <Stat k="Devolvidos" v={num(report.ads_returned)}
                      tone={report.ads_returned ? T.t1 : T.yellow} />
                <Stat k="Criados" v={num(report.ads_created)}
                      tone={report.ads_created ? T.green : T.yellow} />
                <Stat k="Atualizados" v={num(report.ads_updated)} />
                <Stat k="Já conhecidos" v={num(report.ads_already_known)} />
                <Stat k="Mídias achadas" v={num(report.media_urls_found)}
                      tone={report.media_urls_found ? T.t1 : T.yellow} />
                <Stat k="Downloads na fila" v={num(report.downloads_queued)} />
                <Stat k="Créditos gastos" v={num(report.credits_spent)}
                      tone={report.credits_overspent ? T.red : T.t1} />
              </div>

              {report.credits_overspent > 0 && (
                <div style={{ color: T.red, fontSize: 13, marginBottom: 14 }}>
                  Gasto acima do teto: {num(report.credits_overspent)} créditos. A página devolvida
                  veio maior que o limite e a cobrança já tinha acontecido.
                </div>
              )}

              {report.stop_reason && (
                <div style={{ fontSize: 13, color: T.t2, marginBottom: 12 }}>
                  <span style={{ color: T.label }}>Parou porque:</span> {report.stop_reason}
                </div>
              )}

              {Array.isArray(report.rejected) && report.rejected.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, color: T.label, marginBottom: 8 }}>
                    RECUSADOS ({report.rejected.length}) — nada é descartado em silêncio
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {report.rejected.map((r: Row, i: number) => (
                      <div key={i} style={{
                        background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 8,
                        padding: "9px 12px", fontSize: 12.5,
                      }}>
                        <span style={{ color: T.red }}>{r.reason}</span>
                        <span style={{ color: T.t3, marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>
                          {String(r.snippet ?? "").slice(0, 110)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.can_resume && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: T.t2, marginBottom: 10, lineHeight: 1.55 }}>
                    Há mais anúncios além deste lote. Este botão retoma do cursor gravado —
                    a API não devolve de novo o que já veio, então não há cobrança repetida.
                  </div>
                  <Btn onClick={() => importar(true)} disabled={busy === "importacao"} tone={T.blue}>
                    {busy === "importacao" ? "Continuando…" : "Continuar de onde parou"}
                  </Btn>
                </div>
              )}
            </Card>
          );
        })()}

        {/* ── Fila ───────────────────────────────────────────────────────── */}
        {fila && (fila.downloads.length > 0 || fila.analises.length > 0) && (
          <Card>
            <Label>5 · Fila do worker · atualiza sozinho</Label>
            {[["Downloads", fila.downloads], ["Análises", fila.analises]].map(([titulo, rows]) => {
              const list = rows as Row[];
              if (!list.length) return null;
              const falhas = list.filter(r => r.status === "failed" || r.status === "dead");
              return (
                <div key={titulo as string} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 620, marginBottom: 9 }}>{titulo as string}</div>
                  <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 10 }}>
                    <Stat k="Na fila" v={contar(list, "queued")} />
                    <Stat k="Rodando" v={contar(list, "running")} tone={T.blue} />
                    <Stat k="Prontos" v={contar(list, "completed")} tone={T.green} />
                    <Stat k="Falharam" v={falhas.length} tone={falhas.length ? T.red : T.t3} />
                  </div>
                  {falhas.slice(0, 5).map(f => (
                    <div key={f.id} style={{
                      background: "rgba(248,113,113,.06)", border: "1px solid rgba(248,113,113,.25)",
                      borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: T.t2, marginBottom: 6,
                    }}>
                      <span style={{ color: T.red }}>{f.stage}</span> · tentativa {f.attempts} · {f.error}
                    </div>
                  ))}
                </div>
              );
            })}
            <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.55 }}>
              Cada vídeo leva ~30s. Se o worker do Fly estiver desligado, os jobs ficam em
              <span style={{ color: T.yellow }}> na fila</span> sem sair do lugar — não é travamento.
            </div>
            <div style={{ marginTop: 14 }}>
              <a href="/shapermint" style={{ color: T.blue, fontSize: 13.5, textDecoration: "none" }}>
                Ver o que já foi analisado →
              </a>
            </div>
          </Card>
        )}

    </LayoutCI>
  );
}
