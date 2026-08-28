import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __v5Test } from "./v5Renderer.mjs";

test("V5.2 preserves pauses by default and retimes words monotonically", () => {
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
        content_timeline: [{ start: 0, end: 3.2, purpose: "story" }],
        pacing: { silence_trim: true, pause_threshold: 0.42 },
      },
      words,
      4,
    ),
  );
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
  assert.ok(ranges[0].end >= 3.19);
  const mapped = __v5Test.retimeWords(words, ranges);
  assert.equal(mapped.length, 5);
  for (let i = 1; i < mapped.length; i += 1) {
    assert.ok(mapped[i].start >= mapped[i - 1].start);
  }
});

test("V5.2 only trims long pauses with explicit aggressive opt-in", () => {
  const transcript = {
    words: [
      { word: "antes", start: 0.20, end: 0.50 },
      { word: "depois", start: 2.80, end: 3.10 },
    ],
  };
  const words = __v5Test.relativeWords(transcript, 0, 4);
  const ranges = __v5Test.normalizeContentRanges(
    {
      content_timeline: [{ start: 0, end: 3.4, purpose: "build" }],
      pacing: {
        silence_trim: true,
        aggressive_silence_trim: true,
        pause_threshold: 1.4,
      },
    },
    words,
    4,
  );
  assert.ok(ranges.length >= 2);
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


test("V5.1 caption groups never mix speakers", () => {
  const words = [
    { word: "Assim,", start: 0.0, end: 0.35, speaker_id: "A" },
    { word: "titio", start: 0.36, end: 0.72, speaker_id: "A" },
    { word: "ele", start: 0.75, end: 0.95, speaker_id: "B" },
    { word: "meteu", start: 0.96, end: 1.25, speaker_id: "B" },
  ];

  const groups = __v5Test.groupWords(words, 5, 32, 2.15);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map((word) => word.word), ["Assim,", "titio"]);
  assert.deepEqual(groups[1].map((word) => word.word), ["ele", "meteu"]);
  assert.ok(groups.every((group) => new Set(group.map((word) => word.speaker_id)).size === 1));
});

test("V5.1 preserves diarized speaker IDs through retiming", () => {
  const words = [
    { index: 0, word: "Assim,", start: 0.0, end: 0.3, speaker_id: "A" },
    { index: 1, word: "titio", start: 0.31, end: 0.65, speaker_id: "A" },
  ];
  const ranges = __v5Test.addOutputOffsets([
    { start: 0, end: 0.8, purpose: "hook", reason: "" },
  ]);
  const mapped = __v5Test.retimeWords(words, ranges);
  assert.equal(mapped[0].speaker_id, "A");
  assert.equal(mapped[1].speaker_id, "A");
});


test("V5.1.1 caption scheduler has zero overlap", () => {
  const words = [
    { word: "Você", start: 0.00, end: 0.22, speaker_id: "A" },
    { word: "não", start: 0.23, end: 0.38, speaker_id: "A" },
    { word: "vai", start: 0.39, end: 0.52, speaker_id: "A" },
    { word: "fazer", start: 0.53, end: 0.72, speaker_id: "A" },
    { word: "o", start: 0.73, end: 0.80, speaker_id: "B" },
    { word: "quê?", start: 0.81, end: 1.02, speaker_id: "B" },
  ];

  const groups = __v5Test.groupWords(words, 4, 28, 1.9);
  assert.ok(groups.every((group) => group.length <= 4));
  assert.equal(groups.length, 2);

  const schedule = __v5Test.buildCaptionSchedule(groups, 1.2);
  assert.equal(schedule.overlap_count, 0);
  for (let index = 1; index < schedule.events.length; index += 1) {
    assert.ok(
      schedule.events[index].start_cs >=
      schedule.events[index - 1].end_cs,
    );
  }
});

test("V5.1.1 headline layouts match the three editorial presets", () => {
  for (const preset of ["news_page", "viral_headline", "media_split"]) {
    const layout = __v5Test.buildHeadlineLayout({
      enabled: true,
      preset,
      text: "Lucas surpreendeu todo mundo",
      emoji: "😳",
      duration: 2.7,
    });
    assert.equal(layout.enabled, true);
    assert.equal(layout.preset, preset);
    assert.ok(layout.lines.length >= 1);
    assert.ok(layout.lines.length <= (preset === "news_page" ? 3 : 2));
    assert.equal(layout.safe, true);
  }
});

test("V5.1.1 media split chooses a grounded clip frame", () => {
  const time = __v5Test.selectSupportingFrameTime(
    { beats: [{ type: "reaction", time: 2.4, strength: 0.9 }] },
    { camera: [{ time: 1.2, confidence: 0.95 }] },
    8,
  );
  assert.equal(time, 2.4);
});


test("V5.3 writes real ASS newlines and control tags", async () => {
  const dir = await mkdtemp(join(tmpdir(), "frameiq-v53-ass-"));
  try {
    const outputPath = join(dir, "captions.ass");
    const meta = await __v5Test.writeV5Ass({
      outputPath,
      words: [
        { word: "isso", start: 0.10, end: 0.35, speaker_id: "A" },
        { word: "funciona", start: 0.36, end: 0.72, speaker_id: "A" },
      ],
      plan: {
        captions: { preset: "dynamic_active_word", max_words: 4, position: "center_low" },
        headline: { enabled: true, preset: "viral_headline", text: "TESTE REAL", duration: 1.0 },
      },
      duration: 1.2,
    });
    const ass = await readFile(outputPath, "utf8");
    assert.ok(ass.includes("\n[V4+ Styles]\n"));
    assert.ok(ass.includes(String.raw`{\c&H0000D8FF&}`));
    assert.ok(ass.includes("ViralHeadline"));
    assert.equal(meta.headline.enabled, true);
    assert.equal(meta.caption_overlap_count, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
