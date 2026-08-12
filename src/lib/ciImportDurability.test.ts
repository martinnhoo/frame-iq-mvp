import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string[]) => readFileSync(resolve(process.cwd(), ...path), "utf8");

describe("paid import durability", () => {
  it("awaits page persistence before adding ads to the transform collection", () => {
    const client = read(["supabase", "functions", "_shared", "spreshapp", "client.ts"]);
    expect(client.indexOf("await params.onPage?.")).toBeGreaterThan(-1);
    expect(client.indexOf("await params.onPage?.")).toBeLessThan(client.indexOf("collected.push(...page.ads)"));
  });

  it("supports provider-free replay and idempotent request identity", () => {
    const importer = read(["supabase", "functions", "ci-import-run", "index.ts"]);
    expect(importer).toContain("replayAdsFromPages(persistedPages)");
    expect(importer).toContain("idempotency_conflict");
    expect(importer).toContain("body.replay_run_id ? null : Deno.env.get");
  });
});
