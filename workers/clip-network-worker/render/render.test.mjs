import test from "node:test";
import assert from "node:assert/strict";
import { aggregateVariantProgress, normalizeRenderSettings, revisionStoragePath, VARIANT_KEYS } from "./config.mjs";
import { buildAssDocument, buildCaptionCues } from "./captions.mjs";
import { buildAudioFilter, buildVideoFilter } from "./filters.mjs";

test("os presets têm exatamente as três variant keys", () => {
  assert.deepEqual(VARIANT_KEYS, ["blur_caption", "zoom_caption", "zoom_clean"]);
});

test("os caminhos de revisão são imutáveis e versionados", () => {
  assert.equal(revisionStoragePath("user", "clip", "zoom_caption", 2), "user/clip/zoom_caption/v2.mp4");
});

test("blur preserva foreground, usa fundo desfocado e legenda ASS", () => {
  const settings = normalizeRenderSettings("blur_caption", {}, { start_seconds: 10, end_seconds: 30 });
  const filter = buildVideoFilter({ variantKey: "blur_caption", settings, assPath: "/tmp/a.ass", fps: 30, source: { width: 1920, height: 1080 } });
  assert.match(filter, /boxblur/);
  assert.match(filter, /force_original_aspect_ratio=decrease/);
  assert.match(filter, /ass=/);
});

test("zoom com e sem legenda compartilham framing e punch-in", () => {
  const caption = normalizeRenderSettings("zoom_caption", {}, { start_seconds: 0, end_seconds: 20 });
  const clean = normalizeRenderSettings("zoom_clean", {}, { start_seconds: 0, end_seconds: 20 });
  const withCaption = buildVideoFilter({ variantKey: "zoom_caption", settings: caption, assPath: "/tmp/a.ass", fps: 30, source: { width: 1920, height: 1080 } });
  const withoutCaption = buildVideoFilter({ variantKey: "zoom_clean", settings: clean, assPath: null, fps: 30, source: { width: 1920, height: 1080 } });
  assert.match(withCaption, /zoompan/);
  assert.match(withCaption, /ass=/);
  assert.match(withoutCaption, /zoompan/);
  assert.doesNotMatch(withoutCaption, /ass=/);
});

test("legendas preservam aspas, ficam em no máximo duas linhas e na safe area", () => {
  const cues = buildCaptionCues({ segments: [{ start: 0, end: 4, text: 'Falei: "Não, pode ser por isso."' }] }, 0, 4);
  assert.ok(cues.length >= 2);
  assert.ok(cues.every((cue) => cue.text.split("\n").length <= 2));
  assert.match(cues.map((cue) => cue.text).join(" "), /"Não,/);
  const ass = buildAssDocument(cues, { scale: 1, position: "lower" });
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /,330,1/);
});

test("agregação distingue 0, 1, 2 e 3 de 3", () => {
  for (let ready = 0; ready <= 3; ready += 1) {
    const variants = VARIANT_KEYS.map((variant_key, index) => ({ variant_key, render_status: index < ready ? "ready" : "pending" }));
    const result = aggregateVariantProgress(variants);
    assert.equal(result.ready, ready);
    assert.equal(result.status, ready === 3 ? "ready" : "pending");
  }
});

test("áudio usa loudnorm social e fades discretos", () => {
  const filter = buildAudioFilter(30);
  assert.match(filter, /I=-16/);
  assert.match(filter, /TP=-1.5/);
  assert.match(filter, /afade/);
});
