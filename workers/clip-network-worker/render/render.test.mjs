import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateVariantProgress,
  normalizeRenderSettings,
  revisionStoragePath,
  VARIANT_KEYS,
} from "./config.mjs";

import {
  buildAssDocument,
  buildCaptionCues,
} from "./captions.mjs";

import {
  buildAudioFilter,
  buildVideoFilter,
} from "./filters.mjs";

test(
  "mantém exatamente as três variantes",
  () => {
    assert.deepEqual(
      VARIANT_KEYS,
      [
        "blur_caption",
        "zoom_caption",
        "zoom_clean",
      ],
    );
  },
);

test(
  "caminhos de revisão são versionados",
  () => {
    assert.equal(
      revisionStoragePath(
        "user",
        "clip",
        "zoom_caption",
        2,
      ),
      "user/clip/zoom_caption/v2.mp4",
    );
  },
);

test(
  "todas as variantes usam crop vertical estático sem zoompan nem blur",
  () => {
    for (
      const key of VARIANT_KEYS
    ) {
      const settings =
        normalizeRenderSettings(
          key,
          {},
          {
            start_seconds: 0,
            end_seconds: 20,
          },
        );

      const filter =
        buildVideoFilter({
          variantKey: key,
          settings,
          assPath:
            settings.captions.enabled
              ? "/tmp/a.ass"
              : null,

          fps: 30,

          source: {
            width: 1920,
            height: 1080,
          },
        });

      assert.match(
        filter,
        /force_original_aspect_ratio=increase/,
      );

      assert.match(
        filter,
        /crop=1080:1920/,
      );

      assert.doesNotMatch(
        filter,
        /zoompan/,
      );

      assert.doesNotMatch(
        filter,
        /boxblur/,
      );
    }
  },
);

test(
  "usa timestamps reais por palavra",
  () => {
    const cues =
      buildCaptionCues(
        {
          words: [
            {
              word: "isso",
              start: 10.00,
              end: 10.24,
            },
            {
              word: "é",
              start: 10.31,
              end: 10.42,
            },
            {
              word: "muito",
              start: 10.51,
              end: 10.80,
            },
            {
              word: "bom",
              start: 10.86,
              end: 11.12,
            },
          ],
        },
        10,
        12,
      );

    assert.ok(cues.length >= 4);

    assert.equal(
      cues[0].start,
      0,
    );

    assert.ok(
      Math.abs(
        cues[1].start - 0.31
      ) < 0.001,
    );

    assert.equal(
      cues[1].activeIndex,
      1,
    );
  },
);

test(
  "kinetic caption usa caixa alta e destaque amarelo",
  () => {
    const cues =
      buildCaptionCues(
        {
          words: [
            {
              word: "ainda",
              start: 0,
              end: 0.3,
            },
            {
              word: "nesse",
              start: 0.35,
              end: 0.6,
            },
            {
              word: "vídeo",
              start: 0.65,
              end: 1,
            },
          ],
        },
        0,
        2,
      );

    const ass =
      buildAssDocument(
        cues,
        {
          scale: 1,
          position: "lower",
          style: "kinetic",
        },
      );

    assert.match(
      ass,
      /Nimbus Sans Narrow/,
    );

    assert.match(
      ass,
      /&H0000D8FF/,
    );

    assert.match(
      ass,
      /AINDA/,
    );

    assert.match(
      ass,
      /\\t\(0,110/,
    );
  },
);

test(
  "clean caption não usa animação da palavra ativa",
  () => {
    const cues =
      buildCaptionCues(
        {
          words: [
            {
              word: "teste",
              start: 0,
              end: 0.4,
            },
            {
              word: "clean",
              start: 0.5,
              end: 0.9,
            },
          ],
        },
        0,
        1,
      );

    const ass =
      buildAssDocument(
        cues,
        {
          scale: 1,
          position: "lower",
          style: "clean",
        },
      );

    assert.doesNotMatch(
      ass,
      /\\t\(0,110/,
    );
  },
);

test(
  "áudio continua normalizado para social",
  () => {
    const filter =
      buildAudioFilter(30);

    assert.match(
      filter,
      /I=-16/,
    );

    assert.match(
      filter,
      /TP=-1.5/,
    );
  },
);

test(
  "progresso continua 0 a 3",
  () => {
    for (
      let ready = 0;
      ready <= 3;
      ready += 1
    ) {
      const variants =
        VARIANT_KEYS.map(
          (variant_key,index) => ({
            variant_key,
            render_status:
              index < ready
                ? "ready"
                : "pending",
          }),
        );

      const result =
        aggregateVariantProgress(
          variants
        );

      assert.equal(
        result.ready,
        ready,
      );
    }
  },
);
