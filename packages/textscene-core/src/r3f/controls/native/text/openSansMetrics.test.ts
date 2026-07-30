import { describe, expect, it } from 'vitest';
import { OPEN_SANS_METRICS, getKerningAdjustmentUnits, getLinePitchPx } from './openSansMetrics';
import { OPEN_SANS_ATLAS_GLYPHS } from './openSansAtlas';

describe('OPEN_SANS_METRICS', () => {
  it('pins the font-wide scalars independently extracted from the vendored font', () => {
    // Independently measured with fontkit 2.0.4 against OpenSans_SemiBold
    // (decompressed from the vendored woff2 with wawoff2), ahead of and
    // separate from this packet's own bake script — packet P10 spike S2
    // findings, `metrics.json`.
    expect(OPEN_SANS_METRICS.unitsPerEm).toBe(2048);
    expect(OPEN_SANS_METRICS.ascent).toBe(2189);
    expect(OPEN_SANS_METRICS.descent).toBe(600);
    expect(OPEN_SANS_METRICS.lineGap).toBe(0);
  });

  it('carries a present-but-empty kerning table for ASCII x ASCII', () => {
    // This font carries only `mark`/`mkmk` GPOS features, no `kern` feature
    // and no legacy `kern` table (spike S2 finding) — 0 pairs is the correct
    // answer for OpenSans_SemiBold, not a missing feature. The shape must
    // still exist so a synthesized bold/italic, or a different theme font,
    // has somewhere to plug in pairs without a shape change downstream.
    expect(OPEN_SANS_METRICS.kerning).toEqual({});
    expect(getKerningAdjustmentUnits('A', 'V')).toBe(0);
  });

  it('ceiling-rounds ascent and descent to whole pixels independently before summing, at size 16', () => {
    // modules/text_server_adv/text_server_adv.cpp:1515-1516 — Godot's
    // TextServerAdvanced reads FreeType's pixel-quantized 26.6 fixed-point
    // `face->size->metrics.ascender` / `.descender`, NOT a raw float scale of
    // the hhea table. Each must be ceiling-rounded to a whole pixel
    // INDEPENDENTLY before summing:
    //   ceil(2189 * 16/2048) = ceil(17.101...) = 18
    //   ceil(600  * 16/2048) = ceil(4.6875)    = 5
    // scene/theme/default_theme.cpp:392 — Label's `line_spacing` theme
    // constant is `Math::round(3 * scale)` = 3 px at UI scale 1.0.
    //   18 + 5 + 3 = 26 px, matching real Godot pixel measurement (spike S2:
    //   line bands [146,171], [172,197], [198,223] pitch 26px). A naive raw
    //   float sum (17.10 + 4.69 + 3 = 24.79, floored or rounded to 25) is ~1px
    //   short system-wide.
    expect(getLinePitchPx(16)).toBe(26);
  });

  it('spot-checks glyph advances against values independently extracted by a separate msdf-bmfont-xml run', () => {
    // Baked atlas xadvance (at the atlas bake size, 42px) for a handful of
    // representative glyphs, independently produced during the P10 spike
    // (S2 `atlas-tight/OpenSans_SemiBold.json`) from the same vendored font.
    // This packet's own bake run must reproduce the same figures exactly —
    // msdf-bmfont-xml's packing/advance computation is deterministic.
    expect(OPEN_SANS_ATLAS_GLYPHS[' ']?.xadvance).toBe(11);
    expect(OPEN_SANS_ATLAS_GLYPHS['A']?.xadvance).toBe(28);
    expect(OPEN_SANS_ATLAS_GLYPHS['M']?.xadvance).toBe(39);
    expect(OPEN_SANS_ATLAS_GLYPHS['W']?.xadvance).toBe(40);
    expect(OPEN_SANS_ATLAS_GLYPHS['i']?.xadvance).toBe(12);
    expect(OPEN_SANS_ATLAS_GLYPHS['.']?.xadvance).toBe(12);
  });
});
