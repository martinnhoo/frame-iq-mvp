export class RecoverableAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoverableAiError";
  }
}

export class InvalidAiJsonError extends RecoverableAiError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiJsonError";
  }
}

export function parseJsonLoose(text: string) {
  try {
    return JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
  } catch {
    throw new InvalidAiJsonError(`IA devolveu resposta não-JSON: ${text.slice(0, 300)}`);
  }
}