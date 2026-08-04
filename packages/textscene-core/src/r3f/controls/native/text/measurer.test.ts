/**
 * `measureText` — the `TextMeasurer` the Control rect solver consumes
 * (`native/solverRegistry.ts`'s `TextMeasurer = (text, fontSize) => Vec2`).
 * Semantics mirror Godot's `TextServer::get_string_size` at its default
 * (unwrapped) usage: the text's own natural size, ignoring any box width —
 * a single line unless the text itself contains an explicit newline.
 */
import { describe, expect, it } from 'vitest';
import { measureText } from './measurer';
import { shapeText, AutowrapMode } from './textLayout';

describe('measureText', () => {
  it('matches shapeText with autowrap OFF and no box width constraint', () => {
    const size = measureText('AAAA BBBB CCCC', 16);
    const layout = shapeText('AAAA BBBB CCCC', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 0,
    });
    expect(size).toEqual({ x: layout.widthPx, y: layout.heightPx });
  });

  it('measures one line as the bare font height, with no trailing line spacing', () => {
    // ascent 18 + descent 5 = 23 at size 16 (each ceil'd to whole pixels
    // independently, per the TextServer's 26.6 size metrics). A single line
    // never carries a `line_spacing` gap below it, whatever the caller asks
    // for — Godot's `font->get_height()`, which is what a widget floors on.
    expect(measureText('One line', 16).y).toBe(23);
    expect(measureText('One line', 16, 3).y).toBe(23);
  });

  it('applies the caller line spacing BETWEEN lines only', () => {
    // Two lines at spacing 3: 23 + 3 + 23 = 49, not 2 * (23 + 3).
    expect(measureText('one\ntwo', 16, 3).y).toBe(49);
    expect(measureText('one\ntwo', 16).y).toBe(46);
  });

  it('never wraps regardless of how long the text is', () => {
    const size = measureText('a very long single line of text indeed', 16);
    const layout = shapeText('a very long single line of text indeed', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
    });
    expect(layout.lines).toHaveLength(1);
    expect(size.x).toBe(layout.widthPx);
  });

  it('reports a taller size across an explicit multi-paragraph string', () => {
    const one = measureText('one line', 16);
    const two = measureText('one line\nanother line', 16);
    expect(two.y).toBe(one.y * 2);
  });

  it('scales with font size', () => {
    const small = measureText('AB', 16);
    const large = measureText('AB', 32);
    expect(large.x).toBeCloseTo(small.x * 2, 10);
    expect(large.y).toBeGreaterThan(small.y);
  });
});
