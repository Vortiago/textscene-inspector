import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { withVariation } from './fontMetrics';
import { atlasHoldsEmbolden, msdfDistanceBias } from './msdfEmbolden';
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

describe('atlasHoldsEmbolden', () => {
  // The fill fades below a median of 0.04, so the edge moves at most (0.5 - 0.04) * 4 bake px, which
  // an embolden of 0.46 * 4 * 32 / 42 = 1.4019 reaches at the 42 px bake.
  it('holds an embolden up to 1.4019, the growth the bundled atlas encodes', () => {
    expect(atlasHoldsEmbolden(1.4)).toBe(true);
    expect(atlasHoldsEmbolden(1.401)).toBe(true);
    expect(atlasHoldsEmbolden(1.403)).toBe(false);
  });

  it('does not hold an embolden past the limit', () => {
    expect(atlasHoldsEmbolden(3)).toBe(false);
  });

  it('bounds a negative embolden by the same magnitude', () => {
    expect(atlasHoldsEmbolden(-1.4)).toBe(true);
    expect(atlasHoldsEmbolden(-1.6)).toBe(false);
  });
});
