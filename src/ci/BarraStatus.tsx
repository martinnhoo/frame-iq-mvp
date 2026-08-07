/**
 * Barra de status — o que está acontecendo agora, em toda tela do CI.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * Até aqui, saber se o worker estava trabalhando exigia abrir /ci/saude, ou
 * pior, rodar SQL. O trabalho é assíncrono e demorado: quem manda analisar
 * quarenta vídeos precisa ver o progresso de onde estiver, sem trocar de tela e
 * perder o que estava fazendo.
 *
 * ── O que ela NÃO faz ─────────────────────────────────────────────────────
 * Não some quando está tudo parado. Uma barra que só aparece durante o trabalho
 * treina o usuário a não olhar para aquele espaço, e aí o dia em que algo
 * emperra ela aparece e ninguém vê. Parada, ela diz "fila vazia" — informação,
 * não decoração.
 *
 * ── O botão de reanalisar ─────────────────────────────────────────────────
 * Fica aqui porque é onde a informação que justifica o clique já está. O botão
 * diz o número ANTES de clicar ("Reanalisar 40"), calculado por dry_run, e
 * desaparece quando não há nada desatualizado — botão que não faz nada é pior
 * que botão ausente.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const T = {
  bg1: "#0D1117", bg2: "#161B22",
  b1: "rgba(240,246,252,0.07)", b2: "rgba(240,246,252,0.12)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  blue: "#0ea5e9", green: "#4ADE80", red: "#F87171", yellow: "#FBBF24", violet: "#A78BFA",
};

/**
 * Uma linha, vinda pronta do banco.
 *
 * A primeira versão lia a coluna `status` de ci_analysis_jobs e
 * ci_download_jobs INTEIRAS e contava aqui no navegador. Com 40 jobs dava na
 * mesma; com 50.000, a barra — que existe para ser barata e estar sempre
 * visível — viraria a consulta mais cara do produto, batendo no banco oito
 * vezes por minuto por aba, exatamente quando o worker está competindo por ele.
 */
type Estado = {
  analise_rodando: number;  analise_fila: number;
  analise_falhou: number;   analise_total: number;
  download_rodando: number; download_fila: number;
  download_falhou: number;  download_total: number;
  ultimo_evento_seg: number | null;
};

function Ponto({ cor, pulsando }: { cor: string; pulsando?: boolean }) {
  return (
    <span style={{
      width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0,
      boxShadow: pulsando ? `0 0 0 3px ${cor}22` : undefined,
      animation: pulsando ? "ci-pulso 1.6s ease-in-out infinite" : undefined,
    }} />
  );
}

export function BarraStatus({ brandId, en = false }: { brandId?: string | null; en?: boolean }) {
  const [e, setE] = useState<Estado | null>(null);
  const [aRefazer, setARefazer] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const montado = useRef(true);

  useEffect(() => () => { montado.current = false; }, []);

  const ler = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("ci_queue_status", {
        p_brand_id: brandId ?? null,
      });
      if (error) throw error;
      const linha = (Array.isArray(data) ? data[0] : data) as Estado | undefined;
      if (montado.current && linha) setE(linha);
    } catch { /* barra de status não derruba a tela em que está */ }
  }, [brandId]);

  // Quanto há para reanalisar. dry_run: pergunta sem mexer.
  const conferirDesatualizados = useCallback(async () => {
    if (!brandId) return;
    try {
      const { data, error } = await supabase.functions.invoke("ci-requeue-analysis", {
        body: { brand_id: brandId, dry_run: true },
      });
      if (error) throw error;
      if (montado.current) setARefazer(data?.a_refazer ?? 0);
    } catch {
      // A função pode ainda não estar publicada. Silêncio aqui é correto: o
      // botão simplesmente não aparece, em vez de a barra mostrar um erro que
      // não é do usuário.
      if (montado.current) setARefazer(null);
    }
  }, [brandId]);

  useEffect(() => {
    void ler();
    void conferirDesatualizados();
    // 5s enquanto há trabalho seria melhor, mas o intervalo é fixo de propósito:
    // acelerar a leitura quando a fila enche faz a página bater no banco
    // justamente quando o worker está competindo por ele.
    const t = window.setInterval(ler, 8000);
    return () => window.clearInterval(t);
  }, [ler, conferirDesatualizados]);

  const reanalisar = useCallback(async () => {
    if (!brandId || ocupado) return;
    setOcupado(true); setAviso(null);
    try {
      const { data, error } = await supabase.functions.invoke("ci-requeue-analysis", {
        body: { brand_id: brandId },
      });
      if (error) throw error;
      setAviso(en
        ? `${data?.atualizados ?? 0} ads back in queue`
        : `${data?.atualizados ?? 0} anúncios de volta na fila`);
      setARefazer(0);
      void ler();
    } catch (err: any) {
      setAviso(err?.message ?? (en ? "could not requeue" : "não deu para recolocar na fila"));
    } finally {
      setOcupado(false);
    }
  }, [brandId, ocupado, en, ler]);

  const rodando = e ? e.analise_rodando + e.download_rodando : 0;
  const esperando = e ? e.analise_fila + e.download_fila : 0;
  const falhos = e ? e.analise_falhou + e.download_falhou : 0;
  const trabalhando = rodando > 0;

  // Vivo = deu sinal nos últimos 2 minutos. O cron religa a máquina nesse
  // intervalo, então silêncio maior que isso já é sintoma, não espera normal.
  const vivo = e?.ultimo_evento_seg != null && e.ultimo_evento_seg < 120;
  const paradoComFila = !trabalhando && esperando > 0 && !vivo;

  const Item = ({ cor, rotulo, valor, pulsando }: {
    cor: string; rotulo: string; valor: number; pulsando?: boolean;
  }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Ponto cor={cor} pulsando={pulsando} />
      <span style={{ fontSize: 12.4, color: T.t2, fontVariantNumeric: "tabular-nums" }}>
        <strong style={{ color: T.t1, fontWeight: 640 }}>{valor}</strong> {rotulo}
      </span>
    </div>
  );

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 40,
      background: "rgba(13,17,23,0.92)", backdropFilter: "blur(8px)",
      borderBottom: `1px solid ${paradoComFila ? "rgba(251,191,36,0.34)" : T.b1}`,
      padding: "9px 14px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
    }}>
      <style>{`@keyframes ci-pulso{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Ponto cor={trabalhando ? T.green : vivo ? T.blue : T.label} pulsando={trabalhando} />
        <span style={{ fontSize: 12.6, fontWeight: 640, color: T.t1 }}>
          {trabalhando
            ? (en ? "Processing" : "Processando")
            : esperando > 0
              ? (en ? "Waiting" : "Aguardando")
              : (en ? "Idle" : "Fila vazia")}
        </span>
      </div>

      {e && (
        <>
          {rodando > 0 && <Item cor={T.green} rotulo={en ? "running" : "rodando"} valor={rodando} pulsando />}
          {esperando > 0 && <Item cor={T.blue} rotulo={en ? "in queue" : "na fila"} valor={esperando} />}
          {falhos > 0 && <Item cor={T.red} rotulo={en ? "failed" : "falharam"} valor={falhos} />}
          {rodando === 0 && esperando === 0 && falhos === 0 && (
            <span style={{ fontSize: 12.2, color: T.t3 }}>
              {en ? "nothing to process" : "nada para processar"}
            </span>
          )}
        </>
      )}

      {/* Este é o aviso que mais importa: fila cheia e worker calado. Sem ele o
          usuário fica olhando um número que não anda, sem saber se é lentidão
          ou máquina desligada. */}
      {paradoComFila && (
        <span style={{
          fontSize: 11.6, color: T.yellow, background: "rgba(251,191,36,0.09)",
          border: "1px solid rgba(251,191,36,0.28)", borderRadius: 7, padding: "3px 8px",
        }}>
          {en
            ? "worker silent for over 2 min — the cron should restart it"
            : "worker calado há mais de 2 min — o cron deve religar"}
        </span>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {aviso && <span style={{ fontSize: 11.8, color: T.t3 }}>{aviso}</span>}

        {/* Some quando não há nada desatualizado. Botão que não faz nada é pior
            que botão ausente — ensina a clicar sem consequência. */}
        {aRefazer != null && aRefazer > 0 && (
          <button
            onClick={reanalisar}
            disabled={ocupado}
            title={en
              ? `${aRefazer} ads were analysed with an older prompt. Re-running costs Gemini only — no SpreshApp credits, no re-download, no re-transcription.`
              : `${aRefazer} anúncios foram analisados com um prompt anterior. Refazer custa só Gemini — nenhum crédito SpreshApp, sem rebaixar vídeo nem retranscrever.`}
            style={{
              background: ocupado ? T.bg2 : "rgba(167,139,250,0.12)",
              border: `1px solid ${ocupado ? T.b2 : "rgba(167,139,250,0.36)"}`,
              color: ocupado ? T.t3 : T.violet,
              borderRadius: 8, padding: "5px 11px", fontSize: 12.2, fontWeight: 620,
              cursor: ocupado ? "default" : "pointer",
            }}
          >
            {ocupado
              ? (en ? "queueing…" : "enfileirando…")
              : (en ? `Re-analyse ${aRefazer}` : `Reanalisar ${aRefazer}`)}
          </button>
        )}

        <a href="/ci/saude" style={{ fontSize: 11.8, color: T.t3, textDecoration: "none" }}>
          {en ? "details ›" : "detalhes ›"}
        </a>
      </div>
    </div>
  );
}
