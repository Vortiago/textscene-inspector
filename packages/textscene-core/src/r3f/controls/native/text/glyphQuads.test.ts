/**
 * `buildGlyphQuadArrays`: the MSDF painter's merged glyph quads at a `shapeText` layout's
 * positions, read straight off the buffers with no renderer.
 */
import { describe, expect, it } from 'vitest';
import { buildGlyphQuadArrays } from './glyphQuads';
import { withVariation } from './fontMetrics';
import { shapeText } from './textLayout';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

const SCALE = 16 / OPEN_SANS_ATLAS_INFO.fontSize;

function layoutFor(text: string, uppercase = false) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    uppercase,
    lineSpacingPx: 3,
  });
}

describe('buildGlyphQuadArrays', () => {
  it('emits one quad (4 verts) per visible glyph, skipping a zero-size atlas entry like space', () => {
    const arrays = buildGlyphQuadArrays(layoutFor('A B'), 16, 0);
    expect(arrays.positions.length / 3).toBe(2 * 4);
    expect(arrays.indices.length).toBe(2 * 6);
  });

  it("places the first glyph's left edge from its own xoffset, with no left-edge contribution from the previous glyph", () => {
    const arrays = buildGlyphQuadArrays(layoutFor('AB'), 16, 0);
    // Vertex order per quad: TL, TR, BL, BR (x,y,z each) -- TL.x is vertex 0.
    const aLeft = arrays.positions[0]!;
    const bLeft = arrays.positions[4 * 3 + 0]!;
    const a = OPEN_SANS_ATLAS_GLYPHS.A!;
    const b = OPEN_SANS_ATLAS_GLYPHS.B!;
    expect(aLeft).toBeCloseTo(0 + a.xoffset * SCALE, 6);
    // B's pen x is A's advance; B's left edge adds B's own xoffset on top.
    const layout = layoutFor('AB');
    const penB = layout.lines[0]!.glyphs[1]!.x;
    expect(bLeft).toBeCloseTo(penB + b.xoffset * SCALE, 6);
  });

  it('renders the UPPERCASED glyph a layout already transformed to, not the source casing', () => {
    const lower = buildGlyphQuadArrays(layoutFor('a'), 16, 0);
    const upper = buildGlyphQuadArrays(layoutFor('a', true), 16, 0);
    const aGlyph = OPEN_SANS_ATLAS_GLYPHS.a!;
    const AGlyph = OPEN_SANS_ATLAS_GLYPHS.A!;
    const lowerWidth = lower.positions[1 * 3]! - lower.positions[0]!; // TR.x - TL.x
    const upperWidth = upper.positions[1 * 3]! - upper.positions[0]!;
    expect(lowerWidth).toBeCloseTo(aGlyph.width * SCALE, 6);
    expect(upperWidth).toBeCloseTo(AGlyph.width * SCALE, 6);
  });

  it('shears the bitmap by a DIFFERENT amount at its top vs. its bottom edge, proving a real per-vertex shear rather than a uniform per-glyph translation', () => {
    const straight = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    const skewed = buildGlyphQuadArrays(layoutFor('A'), 16, 0.2);
    // Vertex layout per quad: 0=TL,1=TR,2=BL,3=BR ; x is index*3.
    const topDx = skewed.positions[0]! - straight.positions[0]!;
    const bottomDx = skewed.positions[2 * 3]! - straight.positions[2 * 3]!;
    expect(topDx).not.toBe(0);
    expect(topDx).not.toBeCloseTo(bottomDx, 6);
  });

  it("shears each vertex around the glyph's baseline, not the line's top edge", () => {
    // FreeType's FT_Outline_Transform (text_server_adv.cpp:1318-1320, :3621-3623) runs on the
    // outline FT_Load_Glyph loads, whose origin is the baseline pen position. A vertex on the
    // baseline stays put and an ascender moves right. A top-edge pivot would move it left.
    // 'A' at 16 (bake size 42, SCALE = 16/42): yoffset 12.8916015625, height 34,
    // `base` 44.8916015625, so `base - yoffset` = 32. baselineOffsetPx = ceil(2189 *
    // 16/2048) = 18, topPx = 18 - 32*(16/42) = 5.809523809..., bottomPx = topPx +
    // 34*(16/42) = 18.761904761..., 2 bake px of AA padding below the baseline.
    const skewed = buildGlyphQuadArrays(layoutFor('A'), 16, 0.2);
    const straight = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    const topDx = skewed.positions[0]! - straight.positions[0]!;
    const bottomDx = skewed.positions[2 * 3]! - straight.positions[2 * 3]!;
    // -0.2 * (5.809523809 - 18) = 2.438095238...
    expect(topDx).toBeCloseTo(2.4380952, 5);
    // -0.2 * (18.761904761 - 18) = -0.152380952...
    expect(bottomDx).toBeCloseTo(-0.1523809, 5);
  });

  it("anchors a line at its baseline and folds in the bake's own line-top anchor", () => {
    // The baseline sits `layout.baselineOffsetPx` below the line's box top. The MSDF bake measures
    // every `yoffset` from `OPEN_SANS_ATLAS_INFO.base`, so the builder reconciles the two and a
    // caller positions a line by its box-top Y alone.
    const layout = layoutFor('A');
    const a = OPEN_SANS_ATLAS_GLYPHS.A!;
    const arrays = buildGlyphQuadArrays(layout, 16, 0);
    // TL.y is float index 1; geometry Y is negated Godot px.
    const topPx = -arrays.positions[1]!;
    expect(layout.baselineOffsetPx).toBe(18);
    expect(topPx).toBeCloseTo(18 - (OPEN_SANS_ATLAS_INFO.base - a.yoffset) * SCALE, 6);
    // The reconciliation is nonzero: the bake anchor and the shaped ascent are
    // different quantities, so a painter that ignored one is wrong on every line.
    expect(OPEN_SANS_ATLAS_INFO.base * SCALE).not.toBeCloseTo(layout.baselineOffsetPx, 3);
    // `base` is msdf-bmfont-xml's `baseline` (`index.js:346`), `os2.sTypoAscender *
    // (42 / unitsPerEm)`, and OpenSans_SemiBold's `sTypoAscender` equals its hhea ascent
    // (2189). So the reconciliation is Godot's ceiling remainder (`text_server_adv.cpp:1515-1516`):
    // `ceil(2189*16/2048) - 2189*16/2048 = 18 - 17.1015625 = 0.8984375`, whatever the bake size.
    expect(OPEN_SANS_ATLAS_INFO.base * (2048 / 42)).toBe(2189);
    expect(18 - OPEN_SANS_ATLAS_INFO.base * SCALE).toBeCloseTo(0.8984375, 10);
  });

  it('places line N exactly one linePitchPx below line N-1, with the same per-line baseline anchor', () => {
    const layout = shapeText('A\nA', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
    });
    const arrays = buildGlyphQuadArrays(layout, 16, 0);
    const firstTop = -arrays.positions[1]!;
    const secondTop = -arrays.positions[4 * 3 + 1]!;
    expect(secondTop - firstTop).toBeCloseTo(layout.linePitchPx, 5);
  });

  it('returns empty buffers for a layout with no visible glyph (edge case)', () => {
    const arrays = buildGlyphQuadArrays(layoutFor('   '), 16, 0);
    expect([arrays.positions.length, arrays.uvs.length, arrays.indices.length]).toEqual([0, 0, 0]);
  });
});

// `FT_Outline_Embolden` keeps the left and bottom edges of the ink and grows it right and up by
// `embolden * size / 16` px (`text_server_adv.cpp:1314-1315`). The MSDF bias grows it on every
// side, so the quad moves half the growth right and up to land the same ink.
describe('buildGlyphQuadArrays — embolden', () => {
  function boldLayoutFor(text: string, embolden: number) {
    return shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
      fontMetrics: withVariation(OPEN_SANS_FONT_METRICS, { embolden }),
    });
  }

  it('moves an emboldened glyph right and up by half the outline growth', () => {
    const plain = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    const bold = buildGlyphQuadArrays(boldLayoutFor('A', 1.2), 16, 0);
    const halfGrowthPx = (1.2 * 16) / 16 / 2;
    expect(bold.positions[0]! - plain.positions[0]!).toBeCloseTo(halfGrowthPx, 6);
    // Y is negated into three's Y-up, so up is a larger y.
    expect(bold.positions[1]! - plain.positions[1]!).toBeCloseTo(halfGrowthPx, 6);
  });

  it("keeps the quad size, since the growth is the material's bias", () => {
    const plain = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    const bold = buildGlyphQuadArrays(boldLayoutFor('A', 1.2), 16, 0);
    expect(bold.positions[3]! - bold.positions[0]!).toBeCloseTo(plain.positions[3]! - plain.positions[0]!, 4);
  });

  it('leaves a glyph with no embolden where it was', () => {
    const arrays = buildGlyphQuadArrays(layoutFor('A'), 16, 0);
    expect(arrays.positions[0]).toBeCloseTo(OPEN_SANS_ATLAS_GLYPHS.A!.xoffset * SCALE, 6);
  });
});
