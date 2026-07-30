/**
 * Godot-parity contract for the shared Range base. `rangeRatio` transcribes
 * `Range::get_as_ratio()` (scene/gui/range.cpp):
 *
 *     if (Math::is_equal_approx(get_max(), get_min())) { return 1.0; }
 *     ...
 *     double value = CLAMP(get_value(), shared->min, shared->max);
 *     return CLAMP((value - get_min()) / (get_max() - get_min()), 0, 1);
 *
 * Defaults come from doc/classes/Range.xml: value 0, min_value 0,
 * max_value 100. That combination is what both sliders in
 * `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` carry, and real Godot
 * draws their grabbers hard against the low end of the travel — so ratio 0 for
 * an all-default Range is measured, not assumed.
 */
import { describe, it, expect } from 'vitest';
import { parseRange, rangeRatio, RANGE_DEFAULT_MAX } from './range';

describe('parseRange', () => {
  it('reads the Range properties (happy path)', () => {
    expect(parseRange({ value: '25', min_value: '10', max_value: '50', step: '0.5' })).toMatchObject({
      value: 25,
      minValue: 10,
      maxValue: 50,
      step: 0.5,
    });
  });

  it('leaves an unparseable number undefined rather than guessing (error path)', () => {
    const result = parseRange({ value: 'not-a-number', max_value: '' });
    expect(result.value).toBeUndefined();
    expect(result.maxValue).toBeUndefined();
  });

  it('leaves every field undefined for a bare node (edge case)', () => {
    expect(parseRange({})).toEqual({
      value: undefined,
      minValue: undefined,
      maxValue: undefined,
      step: undefined,
      expEdit: undefined,
    });
  });
});

describe('rangeRatio', () => {
  it('is 0 for an all-default Range — value 0 sits on min_value', () => {
    expect(rangeRatio({})).toBe(0);
  });

  it('maps value across the default 0..100 range', () => {
    expect(rangeRatio({ value: 25 })).toBeCloseTo(0.25, 10);
    expect(rangeRatio({ value: RANGE_DEFAULT_MAX })).toBe(1);
  });

  it('maps value across a shifted range', () => {
    expect(rangeRatio({ value: -25, minValue: -50, maxValue: 50 })).toBeCloseTo(0.25, 10);
  });

  it('CLAMPs a value outside [min, max] instead of extrapolating', () => {
    expect(rangeRatio({ value: 500, maxValue: 100 })).toBe(1);
    expect(rangeRatio({ value: -500, minValue: 0 })).toBe(0);
  });

  it('returns 1.0 for a degenerate range rather than dividing by zero', () => {
    expect(rangeRatio({ minValue: 7, maxValue: 7, value: 7 })).toBe(1);
    // `is_equal_approx` is approximate: a hair of difference still counts.
    expect(rangeRatio({ minValue: 0, maxValue: 1e-9, value: 0 })).toBe(1);
  });

  it('spaces the value logarithmically when exp_edit is set', () => {
    // min 1, max 1024 → log2 spans 0..10; value 32 is log2(32) = 5 → half way.
    expect(rangeRatio({ expEdit: true, minValue: 1, maxValue: 1024, value: 32 })).toBeCloseTo(0.5, 10);
  });

  it('ignores exp_edit for a negative minimum, as Godot gates it on min >= 0', () => {
    // Falls back to the linear branch: -50..50 with value 0 is the midpoint.
    expect(rangeRatio({ expEdit: true, minValue: -50, maxValue: 50, value: 0 })).toBeCloseTo(0.5, 10);
  });

  it('pins log2(0) = -Infinity to 0 the way Godot CLAMPs it (edge case)', () => {
    expect(rangeRatio({ expEdit: true, minValue: 0, maxValue: 1024, value: 0 })).toBe(0);
  });
});
