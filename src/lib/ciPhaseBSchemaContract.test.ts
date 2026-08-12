import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(
  resolve(process.cwd(), "supabase", "migrations", name),
  "utf8",
).toLowerCase();

describe("Phase B forward migrations", () => {
  it("models asset observations separately from context executions and keeps history", () => {
    const sql = migration("20260810110000_ci_execution_contract.sql");
    expect(sql).toContain("context_hash");
    expect(sql).toContain("context_hash_snapshot");
    expect(sql).toContain("asset_observation");
    expect(sql).toContain("context_analysis");
    expect(sql).toContain("analysis_contract_version");
    expect(sql).toContain("'asset_semantic'");
    expect(sql).toContain("'context_semantic'");
    expect(sql).toContain("claim_token");
    expect(sql).toContain("lease_generation");
    expect(sql).toContain("is_current");
    expect(sql).toContain("superseded_by_id");
    expect(sql).toContain("create or replace view public.ci_current_ad_taxonomy");
    expect(sql).toContain("create or replace view public.ci_effective_ad_taxonomy");
    expect(sql).toContain("check (claim_scope in ('asset','context','legacy_mixed'))");
    const worker = readFileSync(resolve(process.cwd(), "ci-worker", "worker", "analyze.py"), "utf8");
    expect(worker).toContain('"scope": "legacy_mixed"');
    expect(worker).toContain('"analysis_contract_version": "legacy/semantic-v7"');
  });

  it("enforces composite tenant/brand identity and excludes contaminated legacy assertions", () => {
    const sql = migration("20260810110000_ci_execution_contract.sql");
    expect(sql).toContain("foreign key (ad_id, brand_id, user_id)");
    expect(sql).toContain("foreign key (asset_id, brand_id, user_id)");
    expect(sql).toContain("foreign key (ad_asset_id, ad_id, asset_id, brand_id, user_id)");
    expect(sql).toContain("multiple_distinct_contexts");
    expect(sql).toContain("contaminated");
    expect(sql).toContain("security_invoker = on");
  });

  it("persists paid pages before transform with replay, fingerprint, and cursor identity", () => {
    const sql = migration("20260810120000_ci_import_pages.sql");
    expect(sql).toContain("create table if not exists public.ci_import_pages");
    expect(sql).toMatch(/response_payload\s+jsonb not null/);
    expect(sql).toContain("request_fingerprint");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("cursor_context_hash");
    expect(sql).toContain("replay_of_run_id");
    expect(sql).toContain("paid response identity is immutable");
  });
});
