import { describe, expect, it } from 'vitest';
import type { TextLineLayout } from './textLayout';
import { glyphOriginsPx } from './glyphPen';

const itemSummedOriginsPx = (line: TextLineLayout, originXPx: number) =>
  glyphOriginsPx(line, originXPx, 'fromItemPosition');
const lineSummedOriginsPx = (line: TextLineLayout, originXPx: number) =>
  glyphOriginsPx(line, originXPx, 'alongLine');

/** A space of the bundled face at 16 px, grown by a third of a pixel as a FILL line grows it. */
const GROWN_SPACE_PX = 4.15625 + 1 / 3;

function lineOf(advances: readonly number[]): TextLineLayout {
  let x = 0;
  const glyphs = advances.map((advance) => {
    const glyph = { char: ' ', x, advance };
    x += advance;
    return glyph;
  });
  return { text: '', glyphs, widthPx: x, paragraphIndex: 0 } as unknown as TextLineLayout;
}

describe("glyphOriginsPx 'fromItemPosition'", () => {
  it('sums the pen in 32-bit float, as `Vector2 offset_step` does (label.h:199)', () => {
    const origins = itemSummedOriginsPx(lineOf(Array(13).fill(GROWN_SPACE_PX)), 0);
    expect(origins[12]).toBe(53.874996185302734);
  });

  it('starts the sum at the line origin in its canvas item', () => {
    expect(itemSummedOriginsPx(lineOf([1.5, 1.5]), 0.25)).toEqual([0.25, 1.75]);
  });

  it("adds the glyph's own offset to its pen", () => {
    const line = lineOf([2, 2]);
    line.glyphs[1]!.xOffset = 0.5;
    expect(itemSummedOriginsPx(line, 0)).toEqual([0, 2.5]);
  });
});

describe("glyphOriginsPx 'alongLine'", () => {
  it('sums from zero along the line, then adds the line origin (text_server.cpp:1755,1810)', () => {
    const line = lineOf(Array(13).fill(GROWN_SPACE_PX));
    expect(itemSummedOriginsPx(line, 100.25)[12]).toBe(154.12498474121094);
    expect(lineSummedOriginsPx(line, 100.25)[12]).toBe(154.125);
  });

  it('adds the line origin to the pen a holder kept on each glyph (rich_text_label.cpp:1357)', () => {
    const line = lineOf([2, 2]);
    line.glyphs[0]!.linePenPx = 3.25;
    line.glyphs[1]!.linePenPx = 5.5;
    expect(lineSummedOriginsPx(line, 10)).toEqual([13.25, 15.5]);
  });

  it("adds the glyph's own offset after the line origin", () => {
    const line = lineOf([2, 2]);
    line.glyphs[1]!.xOffset = 0.5;
    expect(lineSummedOriginsPx(line, 1)).toEqual([1, 3.5]);
  });
});
