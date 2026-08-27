import test from "node:test";
import assert from "node:assert/strict";
import { __v5Test } from "./v5Renderer.mjs";

test("V5 trims dead pauses and retimes words monotonically", () => {
  const transcript = {
    words: [
      { word: "Hook", start: 0.20, end: 0.55 },
      { word: "forte", start: 0.56, end: 0.90 },
      { word: "continua", start: 1.00, end: 1.40 },
      { word: "depois", start: 2.20, end: 2.55 },
      { word: "payoff", start: 2.56, end: 3.05 },
    ],
  };
  const words = __v5Test.relativeWords(transcript, 0, 4);
  const ranges = __v5Test.addOutputOffsets(
    __v5Test.normalizeContentRanges(
      {
        content_timeline: [{ start: 0, end: 3.2, purpose: "build" }],
        pacing: { silence_trim: true, pause_threshold: 0.42 },
      },
      words,
      4,
    ),
  );
  assert.ok(ranges.length >= 2);
  const mapped = __v5Test.retimeWords(words, ranges);
  assert.equal(mapped.length, 5);
  for (let i = 1; i < mapped.length; i += 1) {
    assert.ok(mapped[i].start >= mapped[i - 1].start);
  }
  assert.ok(ranges.at(-1).output_end < 3.2);
});

test("V5 creates hard-cut shots around speaker switches and emphasis", () => {
  const ranges = __v5Test.addOutputOffsets([
    { start: 0, end: 6, purpose: "build", reason: "" },
  ]);
  const vision = {
    camera: [
      { time: 0, focus_x: 0.30, focus_y: 0.45, mode: "speaker", speaker_id: 1, confidence: 0.9 },
      { time: 1.5, focus_x: 0.30, focus_y: 0.45, mode: "speaker", speaker_id: 1, confidence: 0.9 },
      { time: 2.2, focus_x: 0.70, focus_y: 0.44, mode: "speaker", speaker_id: 2, confidence: 0.9 },
      { time: 4.0, focus_x: 0.70, focus_y: 0.44, mode: "speaker", speaker_id: 2, confidence: 0.9 },
      { time: 6.0, focus_x: 0.70, focus_y: 0.44, mode: "speaker", speaker_id: 2, confidence: 0.9 },
    ],
  };
  const plan = {
    editing_style: "high_energy",
    beats: [
      { time: 4.4, type: "punch_in", strength: 0.9 },
    ],
    pacing: { target_shot_max: 2.8 },
    headline: { enabled: true, duration: 2.5 },
  };
  const shots = __v5Test.buildShots(
    ranges,
    vision,
    plan,
    { width: 1920, height: 1080 },
  );
  assert.ok(shots.length >= 3);
  assert.ok(shots.some((shot) => shot.speaker_id === 2));
  assert.ok(shots.some((shot) => shot.zoom >= 1.1));
  for (const shot of shots) {
    assert.ok(shot.cropW > 0 && shot.cropH > 0);
    assert.ok(shot.x >= 0 && shot.y >= 0);
  }
});
