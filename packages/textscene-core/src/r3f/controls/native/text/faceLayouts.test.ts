import { describe, expect, it } from 'vitest';
import { shapeText } from './textLayout';
import { faceLayouts } from './faceLayouts';
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

const CJK: FontMetrics = { ...OPEN_SANS_FONT_METRICS, kind: 'canvas', hasGlyph: (ch) => ch === '一' };
const FACE = { ...OPEN_SANS_FONT_METRICS, fallbacks: [CJK] };

function shape(text: string, fontMetrics: FontMetrics) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
  });
}

describe('faceLayouts', () => {
  it('is the layout itself where every glyph draws in its face', () => {
    const layout = shape('AB', FACE);
    expect(faceLayouts(layout)).toEqual([layout]);
  });

  it('gives each face its own layout, with only its glyphs at their places', () => {
    const layout = shape('A一B', FACE);
    const [latin, cjk] = faceLayouts(layout);
    expect(latin!.lines[0]!.glyphs.map((glyph) => glyph.char).join('')).toBe('AB');
    expect(cjk!.fontMetrics).toBe(CJK);
    expect(cjk!.lines[0]!.glyphs.map((glyph) => [glyph.char, glyph.x])).toEqual([
      ['一', layout.lines[0]!.glyphs[1]!.x],
    ]);
  });

  it('answers the same layouts for the same layout, so a memo on them keeps its hits', () => {
    const layout = shape('A一', FACE);
    expect(faceLayouts(layout)).toBe(faceLayouts(layout));
  });
});
