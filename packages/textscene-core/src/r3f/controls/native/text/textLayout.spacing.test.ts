import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { getFontChainHeightPx, type FontMetrics } from './fontMetrics';
import { withSpacing, type FaceSpacing } from './fontSpacing';
import { shapeText, type TextLineLayout } from './textLayout';

/** At 20 px every glyph advances 10 px, with an ascent of 16 px and a descent of 4 px. */
const FACE: FontMetrics = {
  kind: 'canvas',
  unitsPerEm: 1000,
  ascent: 800,
  descent: 200,
  hasGlyph: () => true,
  getGlyphAdvanceUnits: () => 500,
  getKerningAdjustmentUnits: () => 0,
  averageAdvanceUnits: 500,
};

function spaced(spacing: Partial<FaceSpacing['spacing']>, baselineOffset = 0): FontMetrics {
  return withSpacing(FACE, {
    spacing: { top: 0, bottom: 0, space: 0, glyph: 0, ...spacing },
    baselineOffset,
  });
}

function lineOf(text: string, fontMetrics: FontMetrics): TextLineLayout {
  return shapeText(text, {
    fontSizePx: 20,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
  }).lines[0]!;
}

function advancesOf(line: TextLineLayout): Record<string, number> {
  return Object.fromEntries(line.glyphs.filter((g) => g.char !== '​').map((g) => [g.char, g.advance]));
}

describe('shapeText — the extra spacing of a face', () => {
  it('adds the glyph spacing to every glyph but the last', () => {
    expect(advancesOf(lineOf('abc', spaced({ glyph: 4 })))).toEqual({ a: 14, b: 14, c: 10 });
  });

  it('adds the glyph spacing to a space when the face sets no space spacing', () => {
    expect(advancesOf(lineOf('a b', spaced({ glyph: 4 })))).toEqual({ a: 14, ' ': 14, b: 10 });
  });

  it('adds the space spacing in place of the glyph spacing to a space', () => {
    expect(advancesOf(lineOf('a b', spaced({ glyph: 4, space: 12 })))).toEqual({ a: 14, ' ': 22, b: 10 });
  });

  it('leaves the logically first glyph of a right-to-left text unspaced, last in its buffer', () => {
    expect(advancesOf(lineOf('אבג', spaced({ glyph: 4 })))).toEqual({ א: 10, ב: 14, ג: 14 });
  });

  it('widens the line by the spacing', () => {
    expect(lineOf('abc', spaced({ glyph: 4 })).widthPx).toBe(38);
  });

  it('grows the ascent by the top spacing and the descent by the bottom spacing', () => {
    const line = lineOf('ab', spaced({ top: 10, bottom: 6 }));
    expect([line.ascentPx, line.descentPx]).toEqual([26, 10]);
  });

  it('adds the top and bottom spacing to the height of the font', () => {
    expect(getFontChainHeightPx(spaced({ top: 10, bottom: 6 }), 20)).toBe(36);
  });
});

describe('shapeText — the baseline offset of a face', () => {
  it('moves each glyph down by the offset times the ascent plus descent', () => {
    const line = lineOf('ab', spaced({}, 0.2));
    expect(line.glyphs.filter((g) => g.char !== '​').map((g) => g.yOffset)).toEqual([4, 4]);
  });

  it('keeps the shift unrounded, as a float', () => {
    const line = lineOf('a', spaced({}, Math.fround(0.13)));
    expect(line.glyphs[0]!.yOffset).toBe(Math.fround(Math.fround(0.13) * 20));
  });

  it('grows the descent where a glyph moves below it', () => {
    expect(lineOf('ab', spaced({}, 0.5)).descentPx).toBe(10);
  });

  it('grows the ascent where a glyph moves above it', () => {
    expect(lineOf('ab', spaced({}, -1)).ascentPx).toBe(20);
  });
});
