import { describe, expect, it } from 'vitest';
import { parseRangeHint } from './rangeHint';

describe('parseRangeHint', () => {
  it('reads both ends of a closed range', () => {
    expect(parseRangeHint('0,1,0.001')).toEqual({ min: 0, max: 1, radiansAsDegrees: false });
  });

  it('opens the top on or_greater and the bottom on or_less', () => {
    expect(parseRangeHint('0.001,10,0.001,or_greater,exp,suffix:m')).toEqual({
      min: 0.001,
      radiansAsDegrees: false,
    });
    expect(parseRangeHint('-10,10,0.001,or_greater,or_less')).toEqual({ radiansAsDegrees: false });
  });

  it('marks a range the inspector shows in degrees and the file stores in radians', () => {
    expect(parseRangeHint('-180,180,0.1,radians_as_degrees')).toEqual({
      min: -180,
      max: 180,
      radiansAsDegrees: true,
    });
  });

  it('keeps degrees alone in degrees, since the file stores the same number', () => {
    expect(parseRangeHint('1,179,0.1,degrees')).toEqual({ min: 1, max: 179, radiansAsDegrees: false });
  });

  it('answers nothing for a hint string with no two ends, which Godot refuses too', () => {
    // `_parse_range_hint` (editor_properties.cpp:3772) fails on fewer than two slices.
    expect(parseRangeHint('suffix:m')).toBeUndefined();
  });
});
