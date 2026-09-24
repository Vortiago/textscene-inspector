/**
 * The shared units-to-pixels quantisation of `fontMetrics.ts`, against the sources
 * Godot vendors (`thirdparty/freetype/src/base/ftobjs.c:3257-3320,3350-3361`,
 * `thirdparty/freetype/src/base/ftadvanc.c:52`, `thirdparty/harfbuzz/src/hb-ft.cc:519,523`,
 * `modules/text_server_adv/text_server_adv.cpp:6936`, `servers/text/text_server.h:172`).
 */
// Godot's `ThemeDB.fallback_font.get_char_size(c, 16).x` reports 15.125 for 'W' (1936
// units), 10.578125 for 'A' (1354) and 14.75 for 'M' (1888): each `ceil(units / 2) / 64`.
import { describe, expect, it } from 'vitest';
import {
  fontUsesSubpixelPositioning,
  getFontAscentPx,
  getFontGlyphAdvancePx,
  getFontKerningAdjustmentPx,
  getFontLinePitchPx,
  type FontMetrics,
} from './fontMetrics';

/** Open Sans SemiBold's scalars with an odd and an even advance, since only an odd one moves under 26.6 quantisation at size 16. */
const METRICS: FontMetrics = {
  kind: 'atlas',
  unitsPerEm: 2048,
  ascent: 2189,
  descent: 600,
  getGlyphAdvanceUnits: (ch) => ({ A: 1354, l: 571, T: 1157 })[ch] ?? null,
  getKerningAdjustmentUnits: (a, b) => (a + b === 'AV' ? -256 : 0),
  averageAdvanceUnits: 1214,
};

describe('getFontGlyphAdvancePx', () => {
  it('quantizes an ODD design-unit advance UP to the next 1/64 px, where a continuous scale would land between two', () => {
    // 'l', 571 units. x_scale is 0.5 in 16.16 at size 16, so the chain reduces
    // to ceil(571/2)/64 = 286/64 = 4.46875, the advance Godot reports, against a
    // continuous 571*16/2048 = 4.4609375.
    expect(getFontGlyphAdvancePx(METRICS, 'l', 16)).toBe(4.46875);
    expect(getFontGlyphAdvancePx(METRICS, 'T', 16)).toBe(9.046875);
  });

  it('leaves an EVEN design-unit advance exactly where a continuous scale puts it — there is nothing to round', () => {
    expect(getFontGlyphAdvancePx(METRICS, 'A', 16)).toBe(10.578125);
    expect(getFontGlyphAdvancePx(METRICS, 'A', 16)).toBe((1354 * 16) / 2048);
  });

  it('re-derives x_scale per size, so the same glyph quantizes differently at a different one', () => {
    // Size 18: x_scale 0.5625, 16.16 advance 779904, (779904 + 512) >> 10 =
    // 762 -> 11.90625, where a continuous scale gives 11.900390625.
    expect(getFontGlyphAdvancePx(METRICS, 'A', 18)).toBe(762 / 64);
    // Size 32: x_scale is exactly 1.0, so the 26.6 advance is the design
    // units and the quantization is again a no-op.
    expect(getFontGlyphAdvancePx(METRICS, 'A', 32)).toBe(1354 / 64);
  });

  it('falls back to averageAdvanceUnits — through the SAME quantization — for a character the font has no glyph for', () => {
    // 1214 units, even: ceil(1214/2)/64 = 607/64 = 9.484375.
    expect(getFontGlyphAdvancePx(METRICS, 'Ω', 16)).toBe(9.484375);
  });

  it('collapses an advance finer than the 26.6 grid to zero, and both roundings are half UP', () => {
    const hairline: FontMetrics = { ...METRICS, getGlyphAdvanceUnits: () => 1 };
    // 1 design unit at size 16 is 1/2048 em = exactly half of 1/64 px, and
    // both FT_MulFix and hb-ft's shift round half up, so it lifts to 1/64
    // rather than vanishing.
    expect(getFontGlyphAdvancePx(hairline, 'A', 16)).toBe(1 / 64);
    // At size 1 the same unit is 1/2048 px, well under half the grid step, so
    // FreeType reports zero: the grid is the engine's, not an approximation.
    expect(getFontGlyphAdvancePx(hairline, 'A', 1)).toBe(0);
    expect(getFontGlyphAdvancePx({ ...METRICS, getGlyphAdvanceUnits: () => 0 }, 'A', 16)).toBe(0);
  });
});

describe('fontUsesSubpixelPositioning', () => {
  it('is true at and below SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE — every Godot theme default sits here', () => {
    expect(fontUsesSubpixelPositioning(16)).toBe(true);
    expect(fontUsesSubpixelPositioning(20)).toBe(true);
  });

  it('is false above it, which is where Godot starts rounding advances to whole pixels', () => {
    expect(fontUsesSubpixelPositioning(21)).toBe(false);
    expect(fontUsesSubpixelPositioning(28)).toBe(false);
  });

  it('is true for a FRACTIONAL size at any magnitude — Godot\'s own int64_t size API cannot express one, and `scale != 1.0` is the branch it would take', () => {
    expect(fontUsesSubpixelPositioning(28.5)).toBe(true);
  });
});

describe('getFontAscentPx / getFontLinePitchPx', () => {
  it('ceils ascent and descent to whole pixels INDEPENDENTLY before summing', () => {
    expect(getFontAscentPx(METRICS, 16)).toBe(18);
    // ceil(2189*16/2048) + ceil(600*16/2048) + 3 = 18 + 5 + 3.
    expect(getFontLinePitchPx(METRICS, 16, 3)).toBe(26);
    // The same at 28, the size the composition fixture's heading uses:
    // ceil(29.93) + ceil(8.20) = 30 + 9.
    expect(getFontLinePitchPx(METRICS, 28, 0)).toBe(39);
  });
});

describe('getFontKerningAdjustmentPx', () => {
  it('scales a pair adjustment to the target size', () => {
    expect(getFontKerningAdjustmentPx(METRICS, 'A', 'V', 16)).toBe(-2);
  });

  it('short-circuits to 0 for a pair the font has no entry for', () => {
    expect(getFontKerningAdjustmentPx(METRICS, 'A', 'A', 16)).toBe(0);
  });
});
