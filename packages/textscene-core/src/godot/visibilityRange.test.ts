import { describe, expect, it } from 'vitest';
import {
  VISIBILITY_RANGE_FADE_MODE_NAMES,
  NO_VISIBILITY_RANGE,
  VisibilityRangeFadeMode,
  visibilityRangeAt,
  type VisibilityRange,
} from './visibilityRange';

function range(fields: Partial<VisibilityRange>): VisibilityRange {
  return { ...NO_VISIBILITY_RANGE, ...fields };
}

const SHOWN = true;
const HIDDEN = false;

describe('visibilityRangeAt', () => {
  it('draws an instance with no range at any distance', () => {
    expect(visibilityRangeAt(NO_VISIBILITY_RANGE, 1e6, HIDDEN)).toEqual({ visible: true, fade: 1 });
  });

  it('hides an instance past its end', () => {
    expect(visibilityRangeAt(range({ end: 10 }), 12, SHOWN).visible).toBe(false);
  });

  it('hides an instance short of its begin', () => {
    expect(visibilityRangeAt(range({ begin: 10 }), 8, SHOWN).visible).toBe(false);
  });

  it('reads an end of 0 as no far limit', () => {
    expect(visibilityRangeAt(range({ begin: 5 }), 1e6, SHOWN).visible).toBe(true);
  });

  it('keeps a drawn instance until it leaves the outer edge of the end margin', () => {
    expect(visibilityRangeAt(range({ end: 10, endMargin: 2 }), 11.5, SHOWN).visible).toBe(true);
  });

  it('shows a hidden instance only once it passes the inner edge of the end margin', () => {
    const endBand = range({ end: 10, endMargin: 2 });
    expect(visibilityRangeAt(endBand, 11.5, HIDDEN).visible).toBe(false);
    expect(visibilityRangeAt(endBand, 7.5, HIDDEN).visible).toBe(true);
  });

  it('applies the same hysteresis to the begin margin', () => {
    const beginBand = range({ begin: 10, beginMargin: 2 });
    expect(visibilityRangeAt(beginBand, 9, SHOWN).visible).toBe(true);
    expect(visibilityRangeAt(beginBand, 9, HIDDEN).visible).toBe(false);
  });

  it('pops with no fade when the fade mode is DISABLED', () => {
    expect(visibilityRangeAt(range({ end: 10, endMargin: 2 }), 11, SHOWN).fade).toBe(1);
  });

  it('fades a SELF instance out across its end margin, whatever it drew before', () => {
    // smoothstep(1 - (11 - 8) / 4) = smoothstep(0.25) = 0.15625.
    const selfFade = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF });
    expect(visibilityRangeAt(selfFade, 11, HIDDEN)).toEqual({ visible: true, fade: 0.15625 });
  });

  it('fades a SELF instance in across its begin margin', () => {
    // smoothstep((9 - 8) / 4) = 0.15625.
    const selfFade = range({ begin: 10, beginMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF });
    expect(visibilityRangeAt(selfFade, 9, HIDDEN)).toEqual({ visible: true, fade: 0.15625 });
  });

  it('hides a SELF instance past the outer edge of its end margin', () => {
    const selfFade = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF });
    expect(visibilityRangeAt(selfFade, 12.5, SHOWN).visible).toBe(false);
  });

  it('draws a SELF instance between its margins at full alpha', () => {
    const selfFade = range({
      begin: 5,
      beginMargin: 1,
      end: 20,
      endMargin: 1,
      fadeMode: VisibilityRangeFadeMode.SELF,
    });
    expect(visibilityRangeAt(selfFade, 10, SHOWN)).toEqual({ visible: true, fade: 1 });
  });

  it('leaves a DEPENDENCIES instance unfaded across its own margin', () => {
    const dependencies = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES });
    expect(visibilityRangeAt(dependencies, 11, HIDDEN)).toEqual({ visible: true, fade: 1 });
  });
});

describe('VISIBILITY_RANGE_FADE_MODE_NAMES', () => {
  it('names each fade mode by the integer a .tscn stores', () => {
    expect(VISIBILITY_RANGE_FADE_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' });
  });
});
