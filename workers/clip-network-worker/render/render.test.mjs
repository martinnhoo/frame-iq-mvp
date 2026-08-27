import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateVariantProgress,
  normalizeRenderSettings,
  revisionStoragePath,
  RENDER_CONFIG,
  VARIANT_KEYS,
} from "./config.mjs";

import { buildRemotionCaptionPages } from "./captions.mjs";
import { buildAudioFilter, buildBaseVideoFilter } from "./filters.mjs";

test("v2 usa editorial_master", () => {
  assert.deepEqual(VARIANT_KEYS, ["editorial_master"]);
});

test("storage path editorial master", () => {
  assert.equal(
    revisionStoragePath("u", "c", "editorial_master", 2),
    "u/c/editorial_master/v2.mp4",
  );
});

test("base vertical sem zoompan", () => {
  const filter = buildBaseVideoFilter();
  assert.match(filter, /crop=1080:1920/);
  assert.doesNotMatch(filter, /zoompan/);
});

test("captions word-level", () => {
  const pages = buildRemotionCaptionPages(
    {
      words: [
        { word: "isso", start: 10, end: 10.24 },
        { word: "e", start: 10.31, end: 10.42 },
        { word: "muito", start: 10.51, end: 10.80 },
        { word: "bom", start: 10.86, end: 11.12 },
      ],
    },
    10,
    12,
  );

  assert.ok(pages.length >= 1);
  assert.ok(pages.every(page => page.tokens.length <= 4));
});

test("editorial master le edit plan", () => {
  const settings = normalizeRenderSettings(
    "editorial_master",
    {
      start_seconds: 4,
      end_seconds: 24,
      captions: { enabled: true, position: "lower_mid", scale: 0.95 },
      camera: [
        { start: 0, end: 2, scale_from: 1.05, scale_to: 1.1 },
      ],
    },
    { start_seconds: 0, end_seconds: 30 },
  );

  assert.equal(settings.startSeconds, 4);
  assert.equal(settings.endSeconds, 24);
  assert.equal(settings.captions.position, "lower_mid");
  assert.equal(settings.editPlan.camera.length, 1);
});

test("active word amarelo", () => {
  assert.equal(RENDER_CONFIG.captions.activeColour, "#FFD800");
});

test("audio normalizado", () => {
  const filter = buildAudioFilter(30);
  assert.match(filter, /I=-16/);
  assert.match(filter, /TP=-1.5/);
});

test("progress v2", () => {
  assert.equal(
    aggregateVariantProgress([
      { variant_key: "editorial_master", render_status: "ready" },
    ]).ready,
    1,
  );
});
