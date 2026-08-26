import { describe, expect, it } from "vitest";

import {
  chooseFallbackAccount,
  hasTemporalConflict,
  selectDistinctOpportunities,
} from "../../supabase/functions/clip-worker-gateway/clip-opportunities";

describe("clip opportunity selection", () => {
  it("keeps ten globally distinct moments and removes shifted variants", () => {
    const distributed = Array.from({ length: 10 }, (_, index) => ({
      start_seconds: index * 300 + 20,
      end_seconds: index * 300 + 55,
      score: 90 - index,
      topic: `momento-${index}`,
    }));
    const variants = [
      { start_seconds: 15, end_seconds: 55, score: 99, topic: "mesmo começo antecipado" },
      { start_seconds: 20, end_seconds: 70, score: 98, topic: "mesma conversa, outro final" },
      { start_seconds: 20, end_seconds: 55, score: 97, topic: "mesmo momento, outra conta" },
    ];

    const selected = selectDistinctOpportunities([...distributed, ...variants], 3_000, 10);

    expect(selected).toHaveLength(10);
    for (let index = 0; index < selected.length; index += 1) {
      for (let other = index + 1; other < selected.length; other += 1) {
        expect(hasTemporalConflict(selected[index], selected[other])).toBe(false);
      }
    }
    expect(new Set(selected.map((clip) => Math.floor(clip.start_seconds / 300))).size).toBe(10);
  });

  it("uses an explicit/general account and safely falls back to the first active account", () => {
    const fitness = { id: "fitness", label: "Fitness Cariani", active: true };
    const general = { id: "general", label: "Cariani Geral", active: true };
    const explicit = { id: "fallback", label: "Editorial", active: true, rules: { fallback: true } };

    expect(chooseFallbackAccount([fitness, general]).id).toBe("general");
    expect(chooseFallbackAccount([fitness, general, explicit]).id).toBe("fallback");
    expect(chooseFallbackAccount([{ id: "inactive", active: false }, fitness]).id).toBe("fitness");
  });
});
