import assert from "node:assert/strict";
import test from "node:test";
import { enforceMinimumDuration, MediaResolverError } from "./mediaResolver.mjs";

test("rejects a YouTube source below the long-form threshold", () => {
  assert.throws(
    () => enforceMinimumDuration({ duration: 180 }, 181),
    (error) => error instanceof MediaResolverError
      && error.code === "source_too_short"
      && error.retryable === false,
  );
});

test("accepts a source at the long-form threshold", () => {
  assert.equal(enforceMinimumDuration({ duration: 181 }, 181), 181);
});

test("does not discard a source when metadata has no valid duration", () => {
  assert.equal(enforceMinimumDuration({}, 181), null);
  assert.equal(enforceMinimumDuration({ duration: "unknown" }, 181), null);
});
