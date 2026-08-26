import { describe, expect, it } from "vitest";
import { applyFeedbackChanges, parseDeterministicFeedback } from "../../supabase/functions/_shared/clip-feedback";

describe("feedback determinístico da Rede de Cortes", () => {
  it("interpreta corte de 3 segundos do começo sem rota semântica", () => {
    const action = parseDeterministicFeedback("corta 3 segundos do começo");
    expect(action?.feedback_type).toBe("trim_start");
    expect(action?.changes).toContainEqual({ type: "trim_start", seconds: 3 });
    const next = applyFeedbackChanges({ start_seconds: 10, end_seconds: 40 }, action!);
    expect(next.start_seconds).toBe(13);
    expect(next.end_seconds).toBe(40);
  });

  it("desliga captions em nova revisão", () => {
    const action = parseDeterministicFeedback("quero essa versão sem legenda");
    const next = applyFeedbackChanges({ start_seconds: 0, end_seconds: 30, captions: { enabled: true, scale: 1 } }, action!);
    expect(next.captions.enabled).toBe(false);
  });

  it("combina trim e estilo em uma única interpretação", () => {
    const action = parseDeterministicFeedback("no Zoom + legenda, corta 3s do começo e deixa a legenda menor");
    expect(action?.changes).toHaveLength(2);
    expect(action?.summary).toContain("legenda menor");
  });

  it("encaminha instrução semântica sem tentar adivinhar", () => {
    expect(parseDeterministicFeedback("começa quando ele diz \"eu nunca faria isso\"" )).toBeNull();
    expect(parseDeterministicFeedback("esse momento não funciona, procura outro parecido")).toBeNull();
  });
});
