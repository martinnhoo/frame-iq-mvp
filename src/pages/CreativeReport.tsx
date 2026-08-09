/**
 * /ci/relatorio — Creative Intelligence Report + exportação CSV.
 *
 * ── As duas coisas são diferentes, e é por isso que estão juntas ──────────
 * O CSV é dado bruto: quem quiser cruzar com outra planilha leva daqui. O
 * relatório é leitura: termina em aplicação, não em número.
 *
 *     Para produzir amanhã:
 *       Receita:    Permanece no lugar
 *       Preservar:  produto · ângulo · prova
 *       Variar:     6 hooks · 3 primeiros frames
 *       = 18 combinações possíveis
 *
 * ── Derivado, não gerado ─────────────────────────────────────────────────
 * Nenhuma linha passa por LLM. Um modelo escreveria um relatório mais bonito e
 * ninguém conseguiria dizer de onde saiu cada frase — e a primeira vez que ele
 * inventasse algo plausível, o produto inteiro perderia a credibilidade que a
 * regra da evidência construiu.
 *
 * Aqui cada linha aponta para um número que está no banco, e o que não foi
 * observado aparece como "não observado" em vez de virar recomendação.
 *
 * ── Sobre "combinações possíveis" ────────────────────────────────────────
 * É multiplicação, não previsão. O texto diz isso na tela. Chamar de "12 novos
 * briefs que vão funcionar" seria exatamente o tipo de promessa que não temos
 * dado para fazer.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutCI } from "@/ci/Layout";
import { useAcuracia, SeloConfianca, nivelDe } from "@/ci/confianca";
import { gerarCsv, baixarCsv, nomeArquivo } from "@/ci/csv";
import { T, Card } from "@/ci/tema";

type Row = Record<string, any>;

const KIND_ROTULO: Record<string, string> = {
  product: "produto", product_type: "tipo de produto", angle: "ângulo",
  mechanism: "mecanismo", proof: "prova", promise: "promessa",
  objection: "objeção", offer: "oferta", cta: "CTA", hook: "hook",
  hook_visual: "hook visual", hook_written: "hook escrito",
  visual_style: "estilo visual", story_structure: "estrutura",
  emotional_tone: "tom", editing_rhythm: "ritmo", scenario: "cenário",
};
const rot = (k: string) => KIND_ROTULO[k] ?? k;


const Botao = ({ onClick, children, primario }: {
  onClick: () => void; children: React.ReactNode; primario?: boolean;
}) => (
  <button onClick={onClick} style={{
    background: primario ? "rgba(167,139,250,.12)" : "transparent",
    border: `1px solid ${primario ? "rgba(167,139,250,.36)" : T.b2}`,
    color: primario ? T.violet : T.t2,
    borderRadius: 8, padding: "6px 12px", fontSize: 12.3, fontWeight: 600,
    cursor: "pointer",
  }}>{children}</button>
);

export default function CreativeReport() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Row | null>(null);
  const [receitas, setReceitas] = useState<Row[]>([]);
  const [eixos, setEixos] = useState<Record<string, Row[]>>({});

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data: marcas, error: e1 } = await supabase
        .from("ci_brands").select("id,name").order("created_at");
      if (e1) throw e1;
      const b = (marcas ?? [])[0];
      if (!b) { setReceitas([]); return; }
      setMarca(b);

      const { data, error } = await supabase.rpc("ci_creative_priority", { p_brand_id: b.id });
      if (error) throw error;
      const lista = (data ?? []) as Row[];
      setReceitas(lista);

      // Os eixos das três primeiras. Buscar de todas seria uma chamada por
      // receita — e o relatório é sobre o que a marca mais repete, não sobre
      // a cauda longa.
      const topo = lista.slice(0, 3);
      const mapa: Record<string, Row[]> = {};
      for (const r of topo) {
        const { data: v } = await supabase.rpc("ci_concept_variation", {
          p_concept_id: r.concept_id,
        });
        mapa[r.concept_id] = (v ?? []) as Row[];
      }
      setEixos(mapa);
    } catch (e: any) {
      setErro(e?.message ?? "não consegui montar o relatório");
      setReceitas([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const { mapa: acuracia } = useAcuracia(marca?.id);

  const exportarReceitas = () => {
    baixarCsv(
      nomeArquivo("receitas", marca?.name),
      gerarCsv(
        [
          { chave: "nome", titulo: "Receita" },
          { chave: "ads", titulo: "Anúncios" },
          { chave: "assets_unicos", titulo: "Assets únicos" },
          { chave: "variacoes", titulo: "Variações" },
          { chave: "eixos_variados", titulo: "Eixos variados" },
          { chave: "eixos_mantidos", titulo: "Eixos mantidos" },
          { chave: "ativos", titulo: "No ar" },
          { chave: "dias_no_ar", titulo: "Dias no ar (máx)" },
          { chave: "duracao_min_s", titulo: "Duração mín (s)" },
          { chave: "duracao_max_s", titulo: "Duração máx (s)" },
          { chave: "hook_dominante", titulo: "Hook dominante" },
          { chave: "presenca", titulo: "Presença (repetição)" },
          { chave: "share_pct", titulo: "% dos assets" },
        ],
        receitas,
      ),
    );
  };

  const exportarEixos = () => {
    const linhas: Row[] = [];
    for (const r of receitas.slice(0, 3)) {
      for (const e of eixos[r.concept_id] ?? []) {
        for (const v of (e.valores ?? []) as Row[]) {
          linhas.push({
            receita: r.nome, eixo: rot(e.kind), papel: e.papel,
            valor: v.label, anuncios: v.ads,
            cobertura_pct: e.cobertura_pct, dominancia_pct: e.dominancia_pct,
          });
        }
      }
    }
    baixarCsv(
      nomeArquivo("eixos", marca?.name),
      gerarCsv(
        [
          { chave: "receita", titulo: "Receita" },
          { chave: "eixo", titulo: "Eixo" },
          { chave: "papel", titulo: "Papel" },
          { chave: "valor", titulo: "Valor" },
          { chave: "anuncios", titulo: "Anúncios" },
          { chave: "cobertura_pct", titulo: "Cobertura %" },
          { chave: "dominancia_pct", titulo: "Dominância %" },
        ],
        linhas,
      ),
    );
  };

  const dominante = receitas[0];
  const eixosDominante = dominante ? (eixos[dominante.concept_id] ?? []) : [];
  const mantidos = eixosDominante.filter(e => e.papel === "mantido");
  const variados = eixosDominante.filter(e => e.papel === "variado");
  const semBase = eixosDominante.filter(e => e.papel === "nao_extraido");

  // Multiplicação dos valores distintos de cada eixo variado. É combinatória,
  // e o texto na tela diz isso — não é previsão de desempenho.
  const combinacoes = variados.length
    ? variados.reduce((acc, e) => acc * Math.max(1, e.n_valores), 1)
    : 0;

  const receitaNaoRevisada = nivelDe(acuracia["receita"]) === "nao_medido";

  return (
    <LayoutCI ativo="relatorios" brandId={marca?.id} larguraMax={900}>
      <div style={{ margin: "14px 0 18px", display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 400px" }}>
          <h1 style={{ fontSize: 21, fontWeight: 670, margin: 0, letterSpacing: "-.02em" }}>
            Relatório{marca ? ` · ${marca.name}` : ""}
            <span style={{ marginLeft: 9, verticalAlign: "middle" }}>
              <SeloConfianca campo="receita" mapa={acuracia} en={false} />
            </span>
          </h1>
          <p style={{ color: T.t3, fontSize: 13, marginTop: 7, lineHeight: 1.6 }}>
            Derivado do que foi observado, não escrito por modelo. Cada linha aponta
            para um número que está no banco.
          </p>
        </div>
        {receitas.length > 0 && (
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <Botao onClick={exportarReceitas}>Baixar receitas (CSV)</Botao>
            <Botao onClick={exportarEixos}>Baixar eixos (CSV)</Botao>
          </div>
        )}
      </div>

      {erro && (
        <Card style={{ borderColor: "rgba(248,113,113,.4)" }}>
          <div style={{ color: T.red, fontSize: 13.3, marginBottom: 6 }}>{erro}</div>
          <Botao onClick={() => void carregar()}>Tentar de novo</Botao>
        </Card>
      )}

      {carregando && <div style={{ color: T.t3, fontSize: 13.5 }}>Montando…</div>}

      {!carregando && !erro && receitas.length === 0 && (
        <Card>
          <div style={{ fontSize: 9.5, letterSpacing: ".08em", fontWeight: 700, color: T.yellow, marginBottom: 6 }}>
            SEM RECEITA AINDA
          </div>
          <div style={{ fontSize: 12.9, color: T.t2, lineHeight: 1.6 }}>
            O relatório precisa de receitas montadas. Vá à{" "}
            <a href="/ci" style={{ color: T.blue }}>visão geral</a> e clique em
            <strong> Montar receitas</strong>.
          </div>
        </Card>
      )}

      {/* ── O bloco que faz o relatório valer ───────────────────────────── */}
      {dominante && (
        <Card style={{ borderColor: "rgba(167,139,250,.30)", background: "rgba(167,139,250,.04)" }}>
          <div style={{
            fontSize: 10, letterSpacing: ".09em", fontWeight: 700,
            color: T.violet, marginBottom: 12,
          }}>PARA PRODUZIR AMANHÃ</div>

          <div style={{ display: "grid", gap: 11, fontSize: 13.4 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ color: T.label, width: 84, flexShrink: 0 }}>Receita</span>
              <span style={{ color: T.t1, fontWeight: 620 }}>{dominante.nome}</span>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ color: T.label, width: 84, flexShrink: 0 }}>Preservar</span>
              <span style={{ color: T.teal }}>
                {mantidos.length
                  ? mantidos.map(e => `${rot(e.kind)} (${e.dominante})`).join(" · ")
                  : "nada se manteve estável o bastante para ser preservado"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ color: T.label, width: 84, flexShrink: 0 }}>Variar</span>
              <span style={{ color: T.violet }}>
                {variados.length
                  ? variados.map(e => `${e.n_valores} ${rot(e.kind)}${e.n_valores > 1 ? "s" : ""}`).join(" · ")
                  : "nenhum eixo variou — as execuções são muito próximas"}
              </span>
            </div>

            {semBase.length > 0 && (
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ color: T.label, width: 84, flexShrink: 0 }}>Sem base</span>
                <span style={{ color: T.yellow }}>
                  {semBase.map(e => `${rot(e.kind)} (${e.cobertura_pct}%)`).join(" · ")}
                  <div style={{ fontSize: 11.4, color: T.t3, marginTop: 3 }}>
                    Extraído em poucos anúncios. Não dá para dizer se a marca manteve
                    ou variou — decida você.
                  </div>
                </span>
              </div>
            )}
          </div>

          {combinacoes > 1 && (
            <div style={{
              marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(167,139,250,.20)",
            }}>
              <div style={{ fontSize: 15, color: T.t1, fontWeight: 640 }}>
                = {combinacoes} combinações possíveis
              </div>
              <div style={{ fontSize: 11.6, color: T.t3, marginTop: 4, lineHeight: 1.55 }}>
                É a multiplicação dos valores que a marca já testou em cada eixo,
                mantendo fixo o que ela preserva. <strong>Não é previsão</strong> —
                não temos desempenho, e nenhuma dessas combinações vem com promessa
                de resultado.
              </div>
            </div>
          )}
        </Card>
      )}

      {receitaNaoRevisada && receitas.length > 0 && (
        <Card style={{ borderColor: "rgba(251,191,36,.28)", background: "rgba(251,191,36,.04)" }}>
          <div style={{ fontSize: 12.6, color: T.t2, lineHeight: 1.6 }}>
            <strong style={{ color: T.yellow }}>Nenhuma receita foi revisada por humano.</strong>{" "}
            O agrupamento acima é de máquina e ninguém conferiu se um estrategista
            chamaria aquilo de mesma estratégia criativa. Revise alguns anúncios em{" "}
            <a href="/ci/qualidade" style={{ color: T.blue }}>/ci/qualidade</a> antes de
            levar este relatório para alguém.
          </div>
        </Card>
      )}

      {/* ── A tabela completa ───────────────────────────────────────────── */}
      {receitas.length > 0 && (
        <Card>
          <div style={{ fontSize: 15, fontWeight: 640, marginBottom: 13 }}>
            Todas as receitas
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.6 }}>
            <thead>
              <tr style={{ color: T.label, fontSize: 11, textAlign: "left" }}>
                <th style={{ padding: "0 8px 9px 0", fontWeight: 600 }}>Receita</th>
                <th style={{ padding: "0 8px 9px 0", fontWeight: 600 }}>Assets</th>
                <th style={{ padding: "0 8px 9px 0", fontWeight: 600 }}>Variações</th>
                <th style={{ padding: "0 8px 9px 0", fontWeight: 600 }}>No ar</th>
                <th style={{ padding: "0 0 9px 0", fontWeight: 600 }}>Presença</th>
              </tr>
            </thead>
            <tbody>
              {receitas.map(r => (
                <tr key={r.concept_id} style={{ borderTop: `1px solid ${T.b1}` }}>
                  <td style={{ padding: "9px 8px 9px 0", color: T.t1, maxWidth: 260 }}>{r.nome}</td>
                  <td style={{ padding: "9px 8px 9px 0", color: T.t2, fontVariantNumeric: "tabular-nums" }}>
                    {r.assets_unicos}
                  </td>
                  <td style={{
                    padding: "9px 8px 9px 0", fontVariantNumeric: "tabular-nums",
                    color: r.variacoes > 0 ? T.violet : T.label,
                  }}>{r.variacoes}</td>
                  <td style={{
                    padding: "9px 8px 9px 0", fontVariantNumeric: "tabular-nums",
                    color: r.ativos > 0 ? T.green : T.label,
                  }}>{r.ativos}</td>
                  <td title={r.presenca_motivo} style={{ padding: "9px 0", color: T.t2 }}>
                    {r.presenca}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {receitas.length > 0 && (
        <div style={{ fontSize: 11.8, color: T.t3, lineHeight: 1.6, paddingTop: 4 }}>
          Tudo aqui é sinal público de repetição, tirado da biblioteca de anúncios da
          Meta. Nada é gasto, impressão, ROAS ou CPA, e nada vem da conta de anúncios
          da marca. "No ar" significa publicado — não significa que está funcionando.
        </div>
      )}
    </LayoutCI>
  );
}
