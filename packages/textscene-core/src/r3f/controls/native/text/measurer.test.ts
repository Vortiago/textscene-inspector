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
    const layout = shapeText('AAAA BBBB CCCC', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
    expect(size).toEqual({ x: layout.widthPx, y: layout.heightPx });
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
