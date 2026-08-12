import { describe, expect, it } from "vitest";

import {
  contextHash,
  importRequestFingerprint,
  replayAdsFromPages,
} from "../../supabase/functions/_shared/ci-contract";

describe("creative execution and import contract", () => {
  const baseContext = {
    body_text: "  Stop rolling leggings  ",
    headline: "A smoother fit",
    description: null,
    cta: "SHOP_NOW",
    landing_page: "https://example.test/products/shape",
    display_format: "VIDEO",
    languages: ["en"],
  };

  it("hashes canonical ad context deterministically and distinguishes executions", async () => {
    const first = await contextHash(baseContext);
    const same = await contextHash({ ...baseContext });
    const different = await contextHash({ ...baseContext, headline: "A different promise" });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(same).toBe(first);
    expect(different).not.toBe(first);
  });

  it("removes volatile landing-page tracking without erasing meaningful query context", async () => {
    const tracked = await contextHash({
      ...baseContext,
      landing_page: "https://example.test/products/shape?utm_source=meta&size=m&fbclid=volatile&color=black#reviews",
    });
    const canonical = await contextHash({
      ...baseContext,
      landing_page: "https://example.test/products/shape?color=black&size=m",
    });
    const otherOffer = await contextHash({
      ...baseContext,
      landing_page: "https://example.test/products/shape?color=beige&size=m",
    });

    expect(tracked).toBe(canonical);
    expect(otherOffer).not.toBe(canonical);
  });

  it("fingerprints idempotent imports and replays persisted pages locally", async () => {
    const request = {
      brand_id: "33333333-3333-4333-8333-333333333333",
      page_id: "page-1",
      filters: { country: "US", display_format: "VIDEO", sort: "newest" },
      max_ads: 20,
      cursor: null,
    };
    expect(await importRequestFingerprint(request)).toBe(
      await importRequestFingerprint({ ...request, filters: { ...request.filters } }),
    );

    const ads = replayAdsFromPages([
      { page_index: 1, response_payload: { ads: [{ ad_archive_id: "a" }] } },
      { page_index: 0, response_payload: { ads: [{ ad_archive_id: "b" }] } },
    ]);
    expect(ads.map((ad) => ad.ad_archive_id)).toEqual(["b", "a"]);
  });
});
