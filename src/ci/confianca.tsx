/**
 * Confiança por campo — a acurácia medida, aplicada onde o dado é lido.
 *
 * ── O problema que isto resolve ───────────────────────────────────────────
 * /ci/qualidade já mede a acurácia campo a campo. Mas medir e guardar num
 * relatório separado não muda nada: quem abre /ci e lê a lista de provas não
 * vai até outra tela conferir se prova é confiável. A medição só vira produto
 * quando aparece COLADA no dado.
 *
 * "Se proof acerta 60%, não deveria ser apresentado da mesma maneira que
 * duração, que acerta 100%." — é literalmente isso que este módulo faz.
 *
 * ── A decisão mais importante aqui ────────────────────────────────────────
 * NÃO MEDIDO não é verde.
 *
 * A tentação óbvia é mostrar selo só quando a acurácia é ruim, deixando o
 * resto limpo. Isso transforma ausência de medição em aprovação silenciosa —
 * exatamente o erro que a tela de qualidade existe para corrigir, reproduzido
 * um nível acima. Campo sem revisão recebe selo próprio, neutro e visível,
 * dizendo que ninguém conferiu.
 *
 * ── Por que o n aparece ───────────────────────────────────────────────────
 * "90% de acurácia" com dois anúncios revisados não é 90% de nada. O selo
 * mostra o tamanho da amostra sempre, e abaixo de MINIMO_AMOSTRA se apresenta
 * como parcial em vez de fingir precisão que não tem.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nivelDe, MINIMO_AMOSTRA } from "./confianca-regras";
import type { Acuracia, MapaAcuracia, Nivel } from "./confianca-regras";

export {
  MINIMO_AMOSTRA, LIMIAR_FRACO, LIMIAR_BOM, nivelDe, mereceAviso,
} from "./confianca-regras";
export type { Acuracia, MapaAcuracia, Nivel } from "./confianca-regras";

/**
 * Lê ci_quality_summary uma vez por marca.
 *
 * Erro aqui NÃO derruba a tela e NÃO some: o selo passa a dizer "não medido",
 * que é a verdade. Uma tela que quebra inteira porque o medidor de qualidade
 * falhou seria pior que a tela sem medidor.
 */
export function useAcuracia(brandId?: string | null) {
  const [mapa, setMapa] = useState<MapaAcuracia>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!brandId) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.rpc("ci_quality_summary", { p_brand_id: brandId });
      if (error) throw error;
      const m: MapaAcuracia = {};
      for (const linha of (data ?? []) as Acuracia[]) m[linha.campo] = linha;
      setMapa(m);
    } catch (e: any) {
      setErro(e?.message ?? "não foi possível ler a acurácia");
      setMapa({});
    } finally {
      setCarregando(false);
    }
  }, [brandId]);

  useEffect(() => { void carregar(); }, [carregar]);

  return { mapa, carregando, erro, recarregar: carregar };
}

const CORES: Record<Nivel, { fg: string; bg: string; borda: string }> = {
  nao_medido:      { fg: "rgba(240,246,252,0.48)", bg: "rgba(240,246,252,0.05)", borda: "rgba(240,246,252,0.14)" },
  amostra_pequena: { fg: "#A78BFA", bg: "rgba(167,139,250,0.09)",  borda: "rgba(167,139,250,0.30)" },
  fraco:           { fg: "#F87171", bg: "rgba(248,113,113,0.10)",  borda: "rgba(248,113,113,0.34)" },
  razoavel:        { fg: "#FBBF24", bg: "rgba(251,191,36,0.09)",   borda: "rgba(251,191,36,0.30)" },
  bom:             { fg: "#4ADE80", bg: "rgba(74,222,128,0.09)",   borda: "rgba(74,222,128,0.28)" },
};

function textos(campo: string, a: Acuracia | undefined, nivel: Nivel, en: boolean) {
  const n = a?.revisados ?? 0;
  const pct = a?.acuracia_pct ?? null;
  switch (nivel) {
    case "nao_medido":
      return {
        rotulo: en ? "not measured" : "não medido",
        titulo: en
          ? `Nobody has reviewed "${campo}" yet. This is not a good score — it is the absence of one. Review a few ads in /ci/qualidade to find out.`
          : `Ninguém revisou "${campo}" ainda. Isto não é nota boa — é ausência de nota. Revise alguns anúncios em /ci/qualidade para descobrir.`,
      };
    case "amostra_pequena":
      return {
        rotulo: `${pct}% · n=${n}`,
        titulo: en
          ? `${pct}% correct over only ${n} reviewed ads — below ${MINIMO_AMOSTRA}, treat it as a hint, not a measurement.`
          : `${pct}% de acerto em apenas ${n} anúncios revisados — abaixo de ${MINIMO_AMOSTRA}, trate como indício, não como medida.`,
      };
    case "fraco":
      return {
        rotulo: `${pct}% · n=${n}`,
        titulo: en
          ? `${pct}% correct over ${n} reviews. This field gets it wrong often — read what is below with suspicion and check the evidence before using it in a brief.`
          : `${pct}% de acerto em ${n} revisões. Este campo erra com frequência — leia o que está abaixo com desconfiança e confira a evidência antes de usar num briefing.`,
      };
    default:
      return {
        rotulo: `${pct}% · n=${n}`,
        titulo: en
          ? `${pct}% correct over ${n} reviewed ads.`
          : `${pct}% de acerto em ${n} anúncios revisados.`,
      };
  }
}

/**
 * Selo de confiança. Vai ao lado do título do painel que apresenta o campo.
 *
 * `en` recebe o idioma da tela em vez de chamar useIdioma() aqui: assim o
 * componente serve também às telas que ainda não foram ligadas ao provider,
 * sem quebrar.
 */
export function SeloConfianca({ campo, mapa, en = true, compacto = false }: {
  campo: string;
  mapa: MapaAcuracia;
  en?: boolean;
  compacto?: boolean;
}) {
  const a = mapa[campo];
  const nivel = nivelDe(a);
  const c = CORES[nivel];
  const { rotulo, titulo } = textos(campo, a, nivel, en);

  return (
    <span
      title={titulo}
      style={{
        fontSize: compacto ? 9.4 : 10.2,
        fontWeight: 640,
        letterSpacing: ".01em",
        color: c.fg,
        background: c.bg,
        border: `1px solid ${c.borda}`,
        borderRadius: 999,
        padding: compacto ? "1px 6px" : "2px 7px",
        whiteSpace: "nowrap",
        cursor: "help",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {rotulo}
    </span>
  );
}

/**
 * Aviso de bloco inteiro, para quando a acurácia é baixa o bastante para que
 * um selo discreto não baste.
 *
 * Só aparece no nível "fraco". Em "razoável" o selo já diz o número, e encher
 * a tela de avisos faria o usuário parar de lê-los — que é o mesmo que não ter
 * aviso nenhum, com mais ruído.
 */
export function AvisoConfianca({ campo, mapa, en = true }: {
  campo: string; mapa: MapaAcuracia; en?: boolean;
}) {
  const a = mapa[campo];
  if (nivelDe(a) !== "fraco") return null;
  return (
    <div style={{
      background: CORES.fraco.bg,
      border: `1px solid ${CORES.fraco.borda}`,
      borderRadius: 9,
      padding: "8px 10px",
      marginBottom: 11,
      fontSize: 11.6,
      lineHeight: 1.5,
      color: "rgba(240,246,252,0.72)",
    }}>
      <span style={{ color: CORES.fraco.fg, fontWeight: 660 }}>
        {en ? "Measured accuracy: " : "Acurácia medida: "}{a!.acuracia_pct}%
      </span>{" "}
      {en
        ? `over ${a!.revisados} reviews. Check the evidence before taking this to a brief.`
        : `em ${a!.revisados} revisões. Confira a evidência antes de levar isto para um briefing.`}
    </div>
  );
}
