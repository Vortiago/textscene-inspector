/**
 * A deterministic `'canvas'`-kind `FontMetrics` (`text/runtimeFontMetrics.ts`)
 * for driving a Control painter down its SCENE-FONT path.
 *
 * A painter never picks a font itself — it asks `resolveNodeFontMetrics`,
 * which ends at `sceneFontLoader.ts`'s `peekSceneFontMetrics`, and THAT
 * short-circuits to the bundled atlas font under vitest (no `FontFace`, no
 * canvas measurement under happy-dom — that module's own doc). So a test that
 * wants the canvas painter stubs the peek:
 *
 * ```ts
 * vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
 * ```
 *
 * The scalars are round numbers rather than a real font's, so every derived
 * pixel quantity below is a one-line hand check rather than a lookup:
 * at `fontSizePx` 16, `getFontAscentPx` = `ceil(800*16/1000)` = 13 and the
 * descent = `ceil(200*16/1000)` = 4, so `getFontLinePitchPx` is 17 plus
 * whichever `line_spacing` the widget passes. Every character advances
 * `500*16/1000` = 8 px.
 */
import { createRuntimeFontMetrics, type CanvasFontMetrics } from '../text/runtimeFontMetrics';

/** `unitsPerEm` — the denominator every scalar below is scaled by. */
export const TEST_SCENE_FONT_UNITS_PER_EM = 1000;
/** Ascent, design units — `ceil(800 * fontSizePx / 1000)` px. */
export const TEST_SCENE_FONT_ASCENT_UNITS = 800;
/** Descent, design units — `ceil(200 * fontSizePx / 1000)` px. */
export const TEST_SCENE_FONT_DESCENT_UNITS = 200;
/** Every character's advance, design units — flat, so a run's width is `chars * 500 * fontSizePx / 1000`. */
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
