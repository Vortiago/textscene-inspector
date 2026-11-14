/** The rules of the two glyph drawers: which snaps a run's pen to its item pixels (`text_server_adv.cpp:4082-4084`). */
import { describe, expect, it } from 'vitest';
import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { snapsPen } from './glyphDrawer';
import { testBitmapFont, testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { OPEN_SANS_CANVAS_FONT_METRICS } from './openSansCanvasFontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';

const FIXED_SIZE_PX = testBitmapFont().fixedSize;

describe('snapsPen', () => {
  it('snaps a bitmap face at its fixed size in a canvas item', () => {
    expect(snapsPen('canvasItem', FIXED_SIZE_PX, testBitmapMetrics())).toBe(true);
  });

  it('snaps a bitmap face whose integer-only scale rounds to 1', () => {
    const integerOnly = testBitmapMetrics(FixedSizeScaleMode.FIXED_SIZE_SCALE_INTEGER_ONLY);
    expect(snapsPen('canvasItem', FIXED_SIZE_PX + 4, integerOnly)).toBe(true);
  });

  it('keeps the pen of a bitmap face it scales', () => {
    expect(snapsPen('canvasItem', FIXED_SIZE_PX * 2, testBitmapMetrics())).toBe(false);
  });

  it('keeps the pen of a bitmap face at a fractional size its enabled scale draws', () => {
    expect(snapsPen('canvasItem', FIXED_SIZE_PX + 0.5, testBitmapMetrics())).toBe(false);
  });

  it('snaps an outline face drawn from a canvas raster at a whole size', () => {
    expect(snapsPen('canvasItem', 16, OPEN_SANS_CANVAS_FONT_METRICS)).toBe(true);
  });

  it('keeps the pen of an outline face at a fractional size', () => {
    expect(snapsPen('canvasItem', 16.5, OPEN_SANS_CANVAS_FONT_METRICS)).toBe(false);
  });

  it('keeps the pen of the bundled face, which draws off the canvas painter', () => {
    expect(snapsPen('canvasItem', 16, OPEN_SANS_FONT_METRICS)).toBe(false);
  });

  it.each([
    ['a bitmap face at its fixed size', FIXED_SIZE_PX, testBitmapMetrics()],
    ['an outline face at a whole size', 16, OPEN_SANS_CANVAS_FONT_METRICS],
  ])('keeps the pen of %s in a Label3D mesh', (_, fontSizePx, metrics) => {
    expect(snapsPen('label3D', fontSizePx, metrics)).toBe(false);
  });
});
