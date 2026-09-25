/**
 * A deterministic `'canvas'`-kind `FontMetrics` (`text/runtimeFontMetrics.ts`) for
 * a painter's scene-font path. Under vitest `peekSceneFontMetrics` returns the
 * atlas font, so a test stubs it: `vi.spyOn(sceneFontLoader,
 * 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS)`.
 */
// Round scalars, so each pixel value is a hand check: at 16px the ascent is
// `ceil(800*16/1000)` = 13 and the descent `ceil(200*16/1000)` = 4, so the line
// pitch is 17 plus `line_spacing`. Every character advances `500*16/1000` = 8 px.
import { createRuntimeFontMetrics, type CanvasFontMetrics } from '../text/runtimeFontMetrics';

/** `unitsPerEm`: the denominator every scalar below is scaled by. */
export const TEST_SCENE_FONT_UNITS_PER_EM = 1000;
/** Ascent, design units: `ceil(800 * fontSizePx / 1000)` px. */
export const TEST_SCENE_FONT_ASCENT_UNITS = 800;
/** Descent, design units: `ceil(200 * fontSizePx / 1000)` px. */
export const TEST_SCENE_FONT_DESCENT_UNITS = 200;
/** Every character's advance, design units: a run's width is `chars * 500 * fontSizePx / 1000`. */
export const TEST_SCENE_FONT_ADVANCE_UNITS = 500;

export const TEST_SCENE_FONT_METRICS: CanvasFontMetrics = createRuntimeFontMetrics({
  scalars: {
    unitsPerEm: TEST_SCENE_FONT_UNITS_PER_EM,
    ascent: TEST_SCENE_FONT_ASCENT_UNITS,
    descent: TEST_SCENE_FONT_DESCENT_UNITS,
  },
  measureWidthUnits: (text) => text.length * TEST_SCENE_FONT_ADVANCE_UNITS,
  cssFontFamily: 'tscn-test-scene-font',
});
