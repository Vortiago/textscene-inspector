import { describe, expect, it } from 'vitest';
import { OPEN_SANS_METRICS, getKerningAdjustmentUnits, getLinePitchPx } from './openSansMetrics';
import { OPEN_SANS_ATLAS_GLYPHS } from './openSansAtlas';

describe('OPEN_SANS_METRICS', () => {
  it('pins the font-wide scalars independently extracted from the vendored font', () => {
    // Measured with fontkit 2.0.4 against the vendored woff2 (decompressed with wawoff2),
    // apart from the bake script.
    expect(OPEN_SANS_METRICS.unitsPerEm).toBe(2048);
    expect(OPEN_SANS_METRICS.ascent).toBe(2189);
    expect(OPEN_SANS_METRICS.descent).toBe(600);
    expect(OPEN_SANS_METRICS.lineGap).toBe(0);
  });

  it('carries a present-but-empty kerning table for the full baked charset product', () => {
    // The font carries only `mark`/`mkmk` GPOS features and no `kern` table, so 0 pairs is correct.
    // 0xAD SOFT HYPHEN does kern, so the bake excludes it (`LATIN1_SUPPLEMENT_EXCLUDE`).
    // The empty table stays so a different theme font can plug in pairs without a shape change.
    expect(OPEN_SANS_METRICS.kerning).toEqual({});
    expect(getKerningAdjustmentUnits('A', 'V')).toBe(0);
  });

  it('ceiling-rounds ascent and descent to whole pixels independently before summing, at size 16', () => {
    // TextServerAdvanced ceils FreeType's 26.6 ascender and descender to whole pixels before summing
    // (modules/text_server_adv/text_server_adv.cpp:1515-1516): ceil(17.10) + ceil(4.69) = 18 + 5.
    // Label's `line_spacing` is `Math::round(3 * scale)` = 3 (scene/theme/default_theme.cpp:392).
    // 26 px matches Godot's measured line bands. A raw float sum gives 24.79, which rounds to 25.
    expect(getLinePitchPx(16)).toBe(26);
  });

  it('spot-checks glyph advances against values hand-computed from the vendored font\'s own hmtx table', () => {
    // Atlas xadvance is `advanceWidth * (42 / unitsPerEm)`, unrounded (msdf-bmfont-xml `index.js:400`,
    // with `roundDecimal: null` passing `index.js:298`). Each figure is hand-computed as
    // `hmtx units * 42/2048` from fontkit 2.0.4 readings of the woff2:
    // space 532, A 1354, M 1887, W 1936, i 571, period 561.
    expect(OPEN_SANS_ATLAS_GLYPHS[' ']?.xadvance).toBe(10.91015625);
    expect(OPEN_SANS_ATLAS_GLYPHS['A']?.xadvance).toBe(27.767578125);
    expect(OPEN_SANS_ATLAS_GLYPHS['M']?.xadvance).toBe(38.6982421875);
    expect(OPEN_SANS_ATLAS_GLYPHS['W']?.xadvance).toBe(39.703125);
    expect(OPEN_SANS_ATLAS_GLYPHS['i']?.xadvance).toBe(11.7099609375);
    expect(OPEN_SANS_ATLAS_GLYPHS['.']?.xadvance).toBe(11.5048828125);
  });
});
