import { describe, expect, it } from 'vitest';
import { shapeTextLine } from './textLine';

const width = (text: string) => shapeTextLine(text, { fontSizePx: 16 }).widthPx;

describe('shapeTextLine', () => {
  it('keeps a line break inside its one line', () => {
    expect(shapeTextLine('Ab\ncd', { fontSizePx: 16 }).lines.map((line) => line.text)).toEqual(['Ab\ncd']);
  });

  it('gives a line feed, which the face does not map, no advance', () => {
    expect(width('Ab\ncd')).toBe(width('Abcd'));
  });

  // The face maps U+000D to a glyph as wide as its space, and HarfBuzz shapes it (text_server_adv.cpp:7050).
  it("gives a carriage return its face glyph's advance", () => {
    expect(width('Ab\r\ncd')).toBe(width('Ab cd'));
  });
});
