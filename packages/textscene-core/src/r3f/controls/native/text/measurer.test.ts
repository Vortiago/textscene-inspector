/**
 * `measureText`, the Control rect solver's `TextMeasurer`. Like Godot's
 * `TextServer::get_string_size`, it gives the unwrapped natural size, one line
 * unless the text holds an explicit newline.
 */
import { describe, expect, it } from 'vitest';
import { measureText } from './measurer';
import { shapeText, AutowrapMode } from './textLayout';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { FontMetrics } from './fontMetrics';

/** A `FontMetrics` unlike Open Sans: every advance is 2x an 'A', so a caller that drops `fontMetrics` measures a different width. */
const WIDE_FONT_METRICS: FontMetrics = {
  kind: 'atlas',
  unitsPerEm: 1000,
  ascent: 1000,
  descent: 300,
  getGlyphAdvanceUnits: () => 900,
  getKerningAdjustmentUnits: () => 0,
  averageAdvanceUnits: 900,
};

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
    // Ascent 18 + descent 5 = 23 at size 16, each ceiled to whole pixels. A single
    // line carries no `line_spacing` gap below it: Godot's `font->get_height()`,
    // which a widget floors on.
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
      lineSpacingPx: 3,
    });
    expect(layout.lines).toHaveLength(1);
    expect(size.x).toBe(layout.widthPx);
  });

  it('reports a taller size across an explicit multi-paragraph string', () => {
    const one = measureText('one line', 16);
    const two = measureText('one line\nanother line', 16);
    expect(two.y).toBe(one.y * 2);
  });

  it('scales with font size — but NOT proportionally once Godot stops positioning glyphs subpixel-precisely', () => {
    // 'A'/'B' advance 1354/1350 units at 2048 per em: 677/64 + 675/64 = 21.125 at 16.
    // At 32 they are 21.15625 and 21.09375, but above `SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE`
    // each rounds with the remainder carried: 21 (carry +0.15625), then
    // round(21.09375 + 0.15625) = 21. 42, not 42.25.
    const small = measureText('AB', 16);
    const large = measureText('AB', 32);
    expect(small.x).toBe(21.125);
    expect(large.x).toBe(42);
    expect(large.y).toBeGreaterThan(small.y);
  });

  it('shapes against a caller-supplied fontMetrics instead of the OPEN_SANS default', () => {
    const openSans = measureText('AB', 16);
    const wide = measureText('AB', 16, 0, WIDE_FONT_METRICS);
    expect(wide.x).not.toBeCloseTo(openSans.x, 5);
    expect(wide).toEqual({
      x: shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics: WIDE_FONT_METRICS }).widthPx,
      y: shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics: WIDE_FONT_METRICS }).heightPx,
    });
  });

  it('omitting fontMetrics keeps shaping against the OPEN_SANS default, unchanged from before this parameter existed', () => {
    expect(measureText('AB', 16)).toEqual(measureText('AB', 16, 0, OPEN_SANS_FONT_METRICS));
  });
});
