import { describe, expect, it } from "vitest";

import {
  patternScopeFilters,
  resolveAuthenticatedTenant,
} from "../../supabase/functions/_shared/tenant-boundary";
import {
  assertWorkerOperationAllowed,
  isWorkerStorageKeyAllowed,
} from "../../supabase/functions/_shared/ci-worker-policy";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("creative-loop tenant boundary", () => {
  it("accepts the verified tenant and rejects a body-spoofed foreign tenant", () => {
    expect(resolveAuthenticatedTenant(USER_A, USER_A)).toBe(USER_A);
    expect(() => resolveAuthenticatedTenant(USER_A, USER_B)).toThrow(/tenant/i);
    expect(() => resolveAuthenticatedTenant(null, USER_A)).toThrow(/authenticated/i);
  });

  it("builds explicit, non-overlapping tenant and benchmark scopes", () => {
    expect(patternScopeFilters(USER_A)).toEqual({
      tenant: { user_id: USER_A, scope: "tenant" },
      global: { user_id: null, scope: "global_benchmark" },
    });
  });
});

describe("worker service-role boundary", () => {
  it("rejects generic ci_* CRUD and unscoped mutation", () => {
    expect(() => assertWorkerOperationAllowed({
      action: "insert",
      table: "ci_import_runs",
      rows: { user_id: USER_A },
    })).toThrow(/not allowed/i);

    expect(() => assertWorkerOperationAllowed({
      action: "update",
      table: "ci_assets",
      patch: { analysis_status: "completed" },
      match: { brand_id: "eq.33333333-3333-4333-8333-333333333333" },
    })).toThrow(/identity/i);
  });

  it("allows only job-scoped worker operations and brand-scoped storage keys", () => {
    expect(() => assertWorkerOperationAllowed({
      action: "update",
      table: "ci_assets",
      patch: { analysis_status: "completed" },
      match: { id: "eq.44444444-4444-4444-8444-444444444444" },
    })).not.toThrow();

    expect(isWorkerStorageKeyAllowed(
      "brands/33333333-3333-4333-8333-333333333333/originals/video.mp4",
    )).toBe(true);
    expect(isWorkerStorageKeyAllowed("../profiles/export.json")).toBe(false);
  });
});
