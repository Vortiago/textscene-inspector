import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { withVariation } from './fontMetrics';
import { msdfDistanceBias } from './msdfEmbolden';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { shapeText } from './textLayout';

function layoutAt(fontSizePx: number, embolden: number) {
  return shapeText('Hog', {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics: withVariation(OPEN_SANS_FONT_METRICS, { embolden }),
  });
}

describe('msdfDistanceBias', () => {
  it('is 0 for a layout with no embolden', () => {
    expect(msdfDistanceBias(layoutAt(18, 0))).toBe(0);
  });

  // The atlas bakes at 42 px with a 4 px range, so an embolden of 1.2 needs 1.2 * 42 / (32 * 4).
  it('moves the edge half of FreeType growth on each side: 0.39375 at the default theme bold', () => {
    expect(msdfDistanceBias(layoutAt(18, 1.2))).toBeCloseTo(0.39375, 10);
  });

  it('scales with the embolden', () => {
    expect(msdfDistanceBias(layoutAt(18, 2.4))).toBeCloseTo(0.7875, 10);
    expect(msdfDistanceBias(layoutAt(18, 0.6))).toBeCloseTo(0.196875, 10);
  });

  it('does not change with the font size, as the shader scales the bias by the screen px range', () => {
    expect(msdfDistanceBias(layoutAt(56, 1.2))).toBeCloseTo(0.39375, 10);
  });
});
