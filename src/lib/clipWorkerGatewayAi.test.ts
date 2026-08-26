import { describe, expect, it } from "vitest";

import {
  InvalidAiJsonError,
  RecoverableAiError,
  parseJsonLoose,
} from "../../supabase/functions/clip-worker-gateway/ai-json";

describe("clip-worker-gateway AI JSON", () => {
  it("preserves quotes inside structured transcription text", () => {
    const lines = [
      'Falei: "Não, pode ser por isso."',
      'Ela respondeu: "sim" e perguntou: "por quê?"',
      'O título era "Saúde, foco e disciplina".',
    ];
    const response = JSON.stringify({
      segments: lines.map((text, index) => ({ start: index, end: index + 1, text })),
    });

    expect(parseJsonLoose(response).segments.map((segment: { text: string }) => segment.text)).toEqual(lines);
  });

  it("classifies malformed structured output as recoverable AI JSON", () => {
    const malformed = '{"segments":[{"start":3.2,"end":4.58,"text":"Falei: "Não, pode ser por isso.""}]}';

    expect(() => parseJsonLoose(malformed)).toThrow(InvalidAiJsonError);
    expect(() => parseJsonLoose(malformed)).toThrow(RecoverableAiError);
  });
});
