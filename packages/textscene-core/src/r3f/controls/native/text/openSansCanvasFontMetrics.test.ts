/**
 * The load-bearing property here is NEGATIVE: these metrics must NOT come
 * from `runtimeFontMetrics.ts`'s `measureText` path. A canvas measurement is
 * a float; the baked table is the font's own integer `hmtx` value, which
 * `fontMetrics.ts` then quantizes exactly as FreeType/HarfBuzz do. Shaping
 * against measured advances would drift from every 2D Control caller and
 * from Godot, so every advance below is pinned to the baked table AND to
 * independently-read `hmtx` literals.
 */
import { describe, expect, it } from 'vitest';
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { OPEN_SANS_METRICS } from './openSansMetrics';
import { getFontGlyphAdvancePx } from './fontMetrics';

const BAKED_CHARSET = Object.keys(OPEN_SANS_METRICS.advanceWidths);

/**
 * `hmtx` advance widths, design units, read independently of this repo's
 * bake: `fontkit` over the vendored `.woff2` (decompressed with `wawoff2`),
 * exactly as `scripts/fonts/bake-metrics.mjs` reads the font but through a
 * separate read, so this asserts against the FONT rather than against
 * whatever the generated module happens to say.
 */
const INDEPENDENT_HMTX_UNITS: Record<string, number> = {
  ' ': 532,
  '.': 561,
  '1': 1171,
  A: 1354,
  W: 1936,
  i: 571,
  m: 1954,
  é: 1180,
  '…': 1672,
};

describe('createOpenSansCanvasFontMetrics', () => {
  const metrics = createOpenSansCanvasFontMetrics('tscn-bundled-font-test');

  it('is canvas-kind and carries the CSS family it was registered under', () => {
    expect(metrics.kind).toBe('canvas');
    expect(metrics.cssFontFamily).toBe('tscn-bundled-font-test');
  });

  it('reports the font\'s own integer hmtx advances, read independently of the bake', () => {
    for (const [ch, units] of Object.entries(INDEPENDENT_HMTX_UNITS)) {
      expect(metrics.getGlyphAdvanceUnits(ch)).toBe(units);
    }
  });

  it('reports a whole-number design-unit advance for every baked character — a measureText-derived advance would be a float', () => {
    for (const ch of BAKED_CHARSET) {
      expect(Number.isInteger(metrics.getGlyphAdvanceUnits(ch))).toBe(true);
    }
  });

  it('advances identically to the baked atlas metrics, in design units and in quantized px at every size', () => {
    for (const ch of BAKED_CHARSET) {
      expect(metrics.getGlyphAdvanceUnits(ch)).toBe(OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits(ch));
      for (const size of [14, 16, 28]) {
        expect(getFontGlyphAdvancePx(metrics, ch, size)).toBe(getFontGlyphAdvancePx(OPEN_SANS_FONT_METRICS, ch, size));
      }
    }
  });

  it('carries the baked scalars and kerning, not a measured approximation of them', () => {
    expect(metrics.unitsPerEm).toBe(2048);
    expect(metrics.ascent).toBe(2189);
    expect(metrics.descent).toBe(600);
    expect(metrics.averageAdvanceUnits).toBe(1214);
    expect(metrics.getKerningAdjustmentUnits('A', 'V')).toBe(OPEN_SANS_FONT_METRICS.getKerningAdjustmentUnits('A', 'V'));
  });

  it('returns null for a character the font has no glyph for, so a shaper falls back to averageAdvanceUnits', () => {
    expect(metrics.getGlyphAdvanceUnits('中')).toBeNull();
  });
});
