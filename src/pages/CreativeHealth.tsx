/**
 * /ci/saude — o que está funcionando e o que está zerado
 *
 * ── Por que esta tela existe ──────────────────────────────────────────────
 * Toda falha do dia 07/08 foi INVISÍVEL até alguém ir cavar em log:
 *
 *   · o filtro display_format=VIDEO devolvia lista vazia, sem erro
 *   · a paginação parava na primeira página, e a execução dizia "concluída"
 *   · o estilo visual era extraído e nunca chegava à tabela que a UI lê
 *   · a fila baixava os 30 antes de analisar o primeiro
 *
 * Nenhuma delas apareceu como erro. Todas apareceram como "está vazio" — e
 * vazio é ambíguo: pode ser que não haja o que mostrar, ou que o caminho
 * esteja quebrado. Esta tela desfaz a ambiguidade, dizendo quantos registros
 * cada etapa produziu e apontando o que está zerado quando não deveria.
 *
 * A regra aqui é oposta à do painel: o painel esconde o encanamento, esta
 * mostra só o encanamento.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";

const T = {
  bg0: "#080B11", bg1: "#0D1117", bg2: "#161B22", bg3: "#1C2128",
  b1: "rgba(240,246,252,0.07)", b2: "rgba(240,246,252,0.12)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  blue: "#0ea5e9", green: "#4ADE80", red: "#F87171", yellow: "#FBBF24", violet: "#A78BFA",
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
type Row = Record<string, any>;

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 13,
    padding: 18, marginBottom: 14, ...style,
  }}>{children}</div>
);

/**
 * Uma etapa do encanamento.
 *
 * `esperado` responde a pergunta que zero sozinho não responde: "isto deveria
 * ter dado alguma coisa?". Quando o pré-requisito existe e a saída é zero, a
 * linha fica vermelha — é aí que mora o bug.
 */
const Etapa = ({ nome, n, prereq, nota }: {
  nome: string; n: number; prereq?: number; nota?: string;
}) => {
  const suspeito = n === 0 && (prereq ?? 0) > 0;
  const cor = suspeito ? T.red : n > 0 ? T.green : T.label;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 0", borderTop: `1px solid ${T.b1}`,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: cor, marginTop: 6, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.2, color: T.t1 }}>{nome}</div>
        {(nota || suspeito) && (
          <div style={{ fontSize: 11.6, color: suspeito ? T.red : T.t3, marginTop: 3, lineHeight: 1.5 }}>
            {suspeito
              ? `Zerado, mas há ${prereq} registro(s) na etapa anterior. Isto é um caminho quebrado, não falta de dado.`
              : nota}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 16, fontWeight: 660, color: cor, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right",
      }}>{n}</span>
    </div>
  );
};

export default function CreativeHealth() {
  const [d, setD] = useState<Row | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const conta = async (tabela: string, filtro?: [string, any]) => {
        let q: any = (supabase.from as any)(tabela).select("id", { count: "exact", head: true });
        if (filtro) q = q.eq(filtro[0], filtro[1]);
        const { count, error } = await q;
        if (error) throw new Error(`${tabela}: ${error.message}`);
        return count ?? 0;
      };

      const [
        marcas, ads, adsReais, assets, assetsOk, cenas, cenasComFuncao,
        keyframes, transcripts, segmentos, onscreen, termos, vinculos,
        conceitos, membros, pessoas, runs,
      ] = await Promise.all([
        conta("ci_brands"), conta("ci_ads"), conta("ci_ads", ["is_demo", false]),
        conta("ci_assets"), conta("ci_assets", ["analysis_status", "completed"]),
        conta("ci_scenes"), conta("ci_scenes", ["source", "ffmpeg+semantic"]),
        conta("ci_keyframes"), conta("ci_transcripts"), conta("ci_transcript_segments"),
        conta("ci_onscreen_text"), conta("ci_taxonomy_terms"), conta("ci_ad_taxonomy"),
        conta("ci_concepts"), conta("ci_concept_members"), conta("ci_person_clusters"),
        conta("ci_import_runs"),
      ]);

      // Termos por tipo: é aqui que "o formato não é identificado" aparece
      // como um zero numa linha, em vez de um card vazio sem explicação.
      const { data: porTipo } = await supabase
        .from("ci_taxonomy_terms").select("kind");
      const kinds: Record<string, number> = {};
      for (const t of (porTipo ?? []) as Row[]) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;

      const filaDe = async (tabela: string) => {
        const { data } = await (supabase.from as any)(tabela).select("status");
        const m: Record<string, number> = {};
        for (const j of (data ?? []) as Row[]) m[j.status] = (m[j.status] ?? 0) + 1;
        return m;
      };
      const [filaDown, filaAn] = await Promise.all([
        filaDe("ci_download_jobs"), filaDe("ci_analysis_jobs"),
      ]);

      /**
       * Violações do contrato com o modelo.
       *
       * Desde que a chamada ao Gemini passou a usar `response_schema`, isto
       * DEVERIA ficar sempre em zero — campo com enum não consegue voltar
       * inválido. É exatamente por isso que vale contar: no dia em que sair de
       * zero, o contrato deixou de valer (modelo trocado, campo renomeado,
       * schema não enviado) e alguém precisa saber no primeiro anúncio, não
       * depois de quarenta e de uma tela estranha.
       *
       * Foi assim que o "hook|problem" passou despercebido: nada contava.
       */
      const { data: resultados } = await supabase
        .from("ci_analysis_results")
        .select("prompt_version,normalized_output")
        .eq("kind", "semantic")
        .limit(500);
      const violacoes: string[] = [];
      const porVersao: Record<string, number> = {};
      for (const r of (resultados ?? []) as Row[]) {
        porVersao[r.prompt_version ?? "?"] = (porVersao[r.prompt_version ?? "?"] ?? 0) + 1;
        for (const v of (r.normalized_output?.violacoes_de_contrato ?? []) as string[]) {
          if (violacoes.length < 12) violacoes.push(v);
        }
      }

      const { data: ultimaRun } = await supabase.from("ci_import_runs")
        .select("created_at,status,ads_returned,ads_created,credits_spent,stop_reason")
        .order("created_at", { ascending: false }).limit(1);

      setD({
        marcas, ads, adsReais, assets, assetsOk, cenas, cenasComFuncao, keyframes,
        transcripts, segmentos, onscreen, termos, vinculos, conceitos, membros,
        pessoas, runs, kinds, filaDown, filaAn, violacoes, porVersao,
        ultimaRun: (ultimaRun ?? [])[0] ?? null,
      });
    } catch (e: any) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => {
    carregar();
    const t = window.setInterval(carregar, 15000);
    return () => window.clearInterval(t);
  }, [carregar]);

  const KINDS_ESPERADOS = [
    ["hook", "Hooks"], ["angle", "Ângulos"], ["promise", "Promessas"],
    ["proof", "Provas"], ["objection", "Objeções"], ["offer", "Ofertas"],
    ["cta", "CTAs"], ["visual_style", "Estilo visual (formato)"],
    ["story_structure", "Estrutura de história"], ["mechanism", "Mecanismos"],
  ] as const;

  return (
    <LayoutCI ativo="saude" brandId={undefined} larguraMax={900}>

        <div style={{ margin: "14px 0 20px" }}>
          <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
            Saúde do sistema
          </h1>
          <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6, maxWidth: 640 }}>
            Quantos registros cada etapa produziu. Uma linha <span style={{ color: T.red }}>vermelha</span> significa
            zero com pré-requisito existindo — caminho quebrado, não falta de dado.
            Atualiza a cada 15 segundos.
          </p>
        </div>

        {erro && (
          <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
            <div style={{ color: T.red, fontSize: 13.3 }}>{erro}</div>
          </Card>
        )}
        {carregando && !d && <div style={{ color: T.t3, fontSize: 13.5 }}>Carregando…</div>}

        {d && (
          <>
            <Card>
              <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 4 }}>Pipeline</div>
              <div style={{ fontSize: 11.8, color: T.t3, marginBottom: 8 }}>
                Cada etapa depende da anterior. O primeiro zero em vermelho é onde investigar.
              </div>
              <Etapa nome="Marcas" n={d.marcas} />
              <Etapa nome="Anúncios importados" n={d.ads} prereq={d.marcas}
                     nota={d.ads > d.adsReais ? `${d.ads - d.adsReais} de demonstração` : undefined} />
              <Etapa nome="Assets baixados" n={d.assets} prereq={d.adsReais} />
              <Etapa nome="Assets com análise concluída" n={d.assetsOk} prereq={d.assets} />
              <Etapa nome="Cenas detectadas" n={d.cenas} prereq={d.assetsOk} />
              <Etapa nome="Cenas com função atribuída" n={d.cenasComFuncao} prereq={d.cenas}
                     nota="Sem função não há estrutura de roteiro para comparar." />
              <Etapa nome="Keyframes extraídos" n={d.keyframes} prereq={d.assetsOk} />
              <Etapa nome="Transcrições" n={d.transcripts} prereq={d.assetsOk} />
              <Etapa nome="Segmentos de fala" n={d.segmentos} prereq={d.transcripts} />
              <Etapa nome="Texto na tela (OCR)" n={d.onscreen} prereq={d.assetsOk}
                     nota="Zero pode ser legítimo: nem todo anúncio tem texto sobreposto." />
              <Etapa nome="Termos de taxonomia" n={d.termos} prereq={d.assetsOk} />
              <Etapa nome="Vínculos anúncio↔termo" n={d.vinculos} prereq={d.termos} />
              <Etapa nome="Receitas" n={d.conceitos} prereq={d.vinculos}
                     nota="Precisa do botão Montar receitas — não é automático." />
              <Etapa nome="Anúncios dentro de receitas" n={d.membros} prereq={d.conceitos} />
              <Etapa nome="Grupos de pessoas" n={d.pessoas}
                     nota="Ainda não construído — zero é o esperado." />
            </Card>

            <Card>
              <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 4 }}>Termos por tipo</div>
              <div style={{ fontSize: 11.8, color: T.t3, marginBottom: 8 }}>
                Um tipo zerado com os outros preenchidos costuma ser o modelo não devolvendo
                aquele campo, ou o campo não chegando à tabela.
              </div>
              {KINDS_ESPERADOS.map(([k, rotulo]) => (
                <Etapa key={k} nome={rotulo} n={d.kinds[k] ?? 0} prereq={d.termos} />
              ))}
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card style={{
                borderColor: (d.violacoes as string[]).length
                  ? "rgba(248,113,113,.36)" : undefined,
              }}>
                <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 4 }}>
                  Contrato com o modelo
                </div>
                <div style={{ fontSize: 11.8, color: T.t3, marginBottom: 11, lineHeight: 1.5 }}>
                  A chamada ao Gemini manda um schema com listas fechadas. Valor fora
                  da lista não é improvável — é impossível de decodificar. Aqui tem que
                  ser sempre zero; se sair de zero, o contrato deixou de valer.
                </div>

                {(d.violacoes as string[]).length === 0 ? (
                  <div style={{ fontSize: 12.8, color: T.green }}>
                    Nenhuma violação nos últimos 500 resultados.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 5 }}>
                    <div style={{ fontSize: 12.6, color: T.red, fontWeight: 620, marginBottom: 3 }}>
                      {(d.violacoes as string[]).length} violação(ões) — o schema não está
                      sendo aplicado
                    </div>
                    {(d.violacoes as string[]).map((v, i) => (
                      <div key={i} style={{
                        fontSize: 11.8, color: T.t2, background: T.bg2,
                        borderRadius: 6, padding: "5px 8px", fontFamily: "monospace",
                      }}>{v}</div>
                    ))}
                  </div>
                )}

                {/* Qual versão de prompt gerou o que está no banco. Sem isto,
                    "por que a tela mudou?" não tem resposta. */}
                <div style={{
                  marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.b1}`,
                  display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.2,
                }}>
                  {Object.entries(d.porVersao as Record<string, number>)
                    .sort((a, b) => b[1] - a[1])
                    .map(([v, n]) => (
                      <span key={v} style={{ color: T.t3 }}>
                        <strong style={{ color: T.t1 }}>{n}</strong> em{" "}
                        <span style={{ fontFamily: "monospace" }}>{v}</span>
                      </span>
                    ))}
                </div>
              </Card>

              {([["Fila de download", d.filaDown], ["Fila de análise", d.filaAn]] as const).map(([titulo, fila]) => {
                const total = Object.values(fila as Record<string, number>).reduce((a, b) => a + b, 0);
                const travados = (fila as Row).queued ?? 0;
                return (
                  <Card key={titulo}>
                    <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 10 }}>{titulo}</div>
                    {total === 0 ? (
                      <div style={{ fontSize: 12.6, color: T.label }}>Vazia.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        {Object.entries(fila as Record<string, number>).map(([status, n]) => (
                          <div key={status} style={{ display: "flex", fontSize: 12.8 }}>
                            <span style={{
                              flex: 1,
                              color: status === "failed" ? T.red
                                : status === "running" ? T.blue
                                : status === "completed" ? T.green : T.t2,
                            }}>{status}</span>
                            <span style={{ fontVariantNumeric: "tabular-nums" }}>{n}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {travados > 0 && (
                      <div style={{ fontSize: 11.6, color: T.yellow, marginTop: 10, lineHeight: 1.5 }}>
                        {travados} esperando. Se este número não cair, a máquina do worker
                        está desligada — o cron deve religar em até 2 minutos.
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {d.ultimaRun && (
              <Card>
                <div style={{ fontSize: 14.5, fontWeight: 640, marginBottom: 10 }}>Última importação</div>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12.8, color: T.t2 }}>
                  <span>{new Date(d.ultimaRun.created_at).toLocaleString("pt-BR")}</span>
                  <span style={{ color: d.ultimaRun.status === "empty" ? T.yellow : T.t2 }}>
                    {d.ultimaRun.status}
                  </span>
                  <span>devolvidos {d.ultimaRun.ads_returned ?? 0}</span>
                  <span>criados {d.ultimaRun.ads_created ?? 0}</span>
                  <span>créditos {d.ultimaRun.credits_spent ?? 0}</span>
                  {d.ultimaRun.stop_reason && <span style={{ color: T.t3 }}>parou: {d.ultimaRun.stop_reason}</span>}
                </div>
              </Card>
            )}
          </>
        )}
    </LayoutCI>
  );
}
