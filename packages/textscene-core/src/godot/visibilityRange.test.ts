import { describe, expect, it } from 'vitest';
import {
  NO_VISIBILITY_RANGE,
  RangeCheck,
  VISIBILITY_RANGE_FADE_MODE_NAMES,
  VisibilityRangeFadeMode,
  checkVisibilityRange,
  hasVisibilityRange,
  selfFade,
  type VisibilityRange,
} from './visibilityRange';

function range(fields: Partial<VisibilityRange>): VisibilityRange {
  return { ...NO_VISIBILITY_RANGE, ...fields };
}

const SHOWN = true;
const HIDDEN = false;

describe('hasVisibilityRange', () => {
  it('is false for the defaults', () => {
    expect(hasVisibilityRange(NO_VISIBILITY_RANGE)).toBe(false);
  });

  it('is true for an end alone', () => {
    expect(hasVisibilityRange(range({ end: 10 }))).toBe(true);
  });

  it('ignores margins without a begin or an end', () => {
    expect(hasVisibilityRange(range({ beginMargin: 2, endMargin: 2 }))).toBe(false);
  });
});

describe('checkVisibilityRange', () => {
  it('reports an instance past its end as beyond the end', () => {
    expect(checkVisibilityRange(range({ end: 10 }), 12, SHOWN).check).toBe(RangeCheck.BEYOND_END);
  });

  it('reports an instance short of its begin as short of the begin', () => {
    expect(checkVisibilityRange(range({ begin: 10 }), 8, SHOWN).check).toBe(RangeCheck.SHORT_OF_BEGIN);
  });

  it('reads an end of 0 as no far limit', () => {
    expect(checkVisibilityRange(range({ begin: 5 }), 1e6, SHOWN).check).toBe(RangeCheck.IN_RANGE);
  });

  it('keeps a drawn DISABLED instance until it leaves the outer edge of the end margin', () => {
    expect(checkVisibilityRange(range({ end: 10, endMargin: 2 }), 11.5, SHOWN).check).toBe(
      RangeCheck.IN_RANGE
    );
  });

  it('shows a hidden DISABLED instance only once it passes the inner edge of the end margin', () => {
    const endBand = range({ end: 10, endMargin: 2 });
    expect(checkVisibilityRange(endBand, 11.5, HIDDEN).check).toBe(RangeCheck.BEYOND_END);
    expect(checkVisibilityRange(endBand, 7.5, HIDDEN).check).toBe(RangeCheck.IN_RANGE);
  });

  it('applies the same hysteresis to the begin margin', () => {
    const beginBand = range({ begin: 10, beginMargin: 2 });
    expect(checkVisibilityRange(beginBand, 9, SHOWN).check).toBe(RangeCheck.IN_RANGE);
    expect(checkVisibilityRange(beginBand, 9, HIDDEN).check).toBe(RangeCheck.SHORT_OF_BEGIN);
  });

  it('reports a DISABLED instance inside a margin as in range, with no fade margin', () => {
    expect(checkVisibilityRange(range({ end: 10, endMargin: 2 }), 11, SHOWN).check).toBe(RangeCheck.IN_RANGE);
  });

  it('reports a SELF instance inside its end margin as in the fade margin, whatever it drew before', () => {
    const selfRange = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF });
    expect(checkVisibilityRange(selfRange, 11, HIDDEN)).toEqual({
      check: RangeCheck.IN_FADE_MARGIN,
      childrenFade: 1,
    });
  });

  it('culls a SELF instance past the outer edge of its end margin', () => {
    const selfRange = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF });
    expect(checkVisibilityRange(selfRange, 12.5, SHOWN).check).toBe(RangeCheck.BEYOND_END);
  });

  it("fades a DEPENDENCIES instance's dependants in, linearly, across its end margin", () => {
    // (11 - (10 - 2)) / (2 * 2) = 0.75.
    const dependencies = range({ end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES });
    expect(checkVisibilityRange(dependencies, 11, SHOWN)).toEqual({
      check: RangeCheck.IN_FADE_MARGIN,
      childrenFade: 0.75,
    });
  });

  it("fades a DEPENDENCIES instance's dependants out across its begin margin", () => {
    // 1 - (9 - (10 - 2)) / (2 * 2) = 0.75.
    const dependencies = range({ begin: 10, beginMargin: 2, fadeMode: VisibilityRangeFadeMode.DEPENDENCIES });
    expect(checkVisibilityRange(dependencies, 9, SHOWN).childrenFade).toBe(0.75);
  });
});

describe('selfFade', () => {
  it('eases a SELF instance out across its end margin', () => {
    // smoothstep(1 - (11 - 8) / 4) = smoothstep(0.25) = 0.15625.
    expect(selfFade(range({ end: 10, endMargin: 2 }), 11)).toBe(0.15625);
  });

  it('eases a SELF instance in across its begin margin', () => {
    // smoothstep((9 - 8) / 4) = 0.15625.
    expect(selfFade(range({ begin: 10, beginMargin: 2 }), 9)).toBe(0.15625);
  });

  it('is 1 between the margins', () => {
    expect(selfFade(range({ begin: 5, beginMargin: 1, end: 20, endMargin: 1 }), 10)).toBe(1);
  });
});

describe('VISIBILITY_RANGE_FADE_MODE_NAMES', () => {
  it('names each fade mode by the integer a .tscn stores', () => {
    expect(VISIBILITY_RANGE_FADE_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' });
  });
});
