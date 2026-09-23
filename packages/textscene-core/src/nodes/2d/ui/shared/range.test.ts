/**
 * Godot-parity contract for the shared Range base: `rangeRatio` transcribes `Range::get_as_ratio()`
 * (scene/gui/range.cpp). Defaults come from doc/classes/Range.xml (value 0, min_value 0, max_value
 * 100). Both sliders in `scenes/demos/viewport/gui_in_3d/gui_panel_3d.tscn` carry them, and Godot
 * draws their grabbers at the low end, so ratio 0 for an all-default Range is measured.
 */
import { describe, it, expect } from 'vitest';
import { parseRange, rangeRatio, resolveRangeValue, RANGE_DEFAULT_MAX } from './range';

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

describe('the step default is the SUBCLASS\'s, not Range\'s', () => {
  /**
   * Each Range subclass sets its own `step`, and `_calc_value` snaps to it. Measured with
   * `ClassDB.class_get_property_default_value` (Godot 4.6.3): HSlider, VSlider, SpinBox and
   * TextureProgressBar 1.0, ProgressBar 0.01, the scrollbars 0.0 (no snap). A scene that omits
   * `step` still snaps.
   */
  it('takes the caller\'s default when the scene omits step', () => {
    expect(parseRange({}, { step: 1 }).step).toBe(1);
    expect(parseRange({}, { step: 0.01 }).step).toBe(0.01);
    expect(parseRange({}, { step: 0 }).step).toBe(0);
  });

  it('lets an authored step win over the default', () => {
    expect(parseRange({ step: '5' }, { step: 1 }).step).toBe(5);
  });

  it('leaves step unset when the caller names no default', () => {
    expect(parseRange({}).step).toBeUndefined();
  });

  // A slider authoring no step still snaps, because its own default is 1.0.
  it('snaps an unauthored slider value to the subclass default', () => {
    const props = parseRange({ value: '23.7' }, { step: 1 });
    expect(resolveRangeValue(props, undefined)).toBe(24);
  });
});

describe('Range::_calc_value gates (range.cpp:182-200)', () => {
  // `if (!shared->allow_lesser && p_val < shared->min)` (`:197-199`): the clamp is conditional,
  // so an authored value below min survives.
  it('keeps a value below min when allow_lesser is set', () => {
    expect(resolveRangeValue({ value: -50, minValue: 0, maxValue: 100, allowLesser: true }, undefined)).toBe(-50);
    expect(resolveRangeValue({ value: -50, minValue: 0, maxValue: 100 }, undefined)).toBe(0);
  });

  // `if (!shared->allow_greater && p_val > shared->max - shared->page)` (`:193-195`).
  it('keeps a value above max when allow_greater is set', () => {
    expect(resolveRangeValue({ value: 250, minValue: 0, maxValue: 100, allowGreater: true }, undefined)).toBe(250);
    expect(resolveRangeValue({ value: 250, minValue: 0, maxValue: 100 }, undefined)).toBe(100);
  });

  // `if (_rounded_values) { p_val = Math::round(p_val); }` (`:188-190`).
  it('rounds the value when rounded is set', () => {
    expect(resolveRangeValue({ value: 12.6, minValue: 0, maxValue: 100, rounded: true }, undefined)).toBe(13);
    expect(resolveRangeValue({ value: 12.6, minValue: 0, maxValue: 100 }, undefined)).toBe(12.6);
  });

  // `p_val = _snapped_r128(p_val - shared->min, p_step) + shared->min` (`:184-186`),
  // live only for `p_step > 0`, and measured from `min` rather than from zero.
  it('snaps the value to step, measured from min', () => {
    expect(resolveRangeValue({ value: 23, minValue: 0, maxValue: 100, step: 10 }, undefined)).toBe(20);
    expect(resolveRangeValue({ value: 23, minValue: 3, maxValue: 100, step: 10 }, undefined)).toBe(23);
    expect(resolveRangeValue({ value: 23, minValue: 0, maxValue: 100, step: 0 }, undefined)).toBe(23);
  });

  it('parses the three gates off the raw property map', () => {
    const parsed = parseRange({ allow_greater: 'true', allow_lesser: 'true', rounded: 'true' });
    expect(parsed.allowGreater).toBe(true);
    expect(parsed.allowLesser).toBe(true);
    expect(parsed.rounded).toBe(true);
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

/**
 * `resolveRangeValue`: a file-order simulation of `Range::set_min`/`set_max`/`set_page`/`set_value`
 * (ADR-0035, Option B). Each ends by touching `shared->val`, directly or with `set_value(shared->val)`,
 * so the `.tscn` order decides which bounds `value`'s clamp sees and whether a later bound re-clamps it.
 */
describe('resolveRangeValue — no reliable order assumes editor-save order (bounds authored before value)', () => {
  it('clamps against the FINAL min/max/page directly — under that assumption they never change again after value’s own setter runs', () => {
    // 150 exceeds the default max (100), so this clamps here, not in rangeRatio's CLAMP:
    // resolveRangeValue models Range::get_value() itself, not a ratio input.
    expect(resolveRangeValue({ value: 150 }, undefined)).toBe(100);
    expect(resolveRangeValue({}, undefined)).toBe(0);
  });

  it('honours page even without a reliable order — the ceiling is max - page, not max alone', () => {
    // A merged-instance-root Range/Slider authoring page must not silently
    // ignore it just because its file order is unknown.
    expect(resolveRangeValue({ value: 180, minValue: 0, maxValue: 200, page: 50 }, undefined)).toBe(150);
  });
});

describe('resolveRangeValue — file-order simulation (ADR-0035, Option B)', () => {
  // The ADR's hand-traced example: `value = 150`, `min_value = 0`, `max_value = 200`, the same
  // three lines in different orders.
  it('value BEFORE min_value/max_value clamps against the still-default max=100, and the later bounds cannot recover it (range.cpp:182-200,211-241)', () => {
    const props = { value: 150, minValue: 0, maxValue: 200 };
    const orderedKeys = ['value', 'min_value', 'max_value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(100);
  });

  it('value AFTER min_value/max_value (the editor’s own order) lands at the authored 150', () => {
    const props = { value: 150, minValue: 0, maxValue: 200 };
    const orderedKeys = ['min_value', 'max_value', 'value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(150);
  });

  it('set_min(0) is a no-op against the struct default (range.cpp:212-214) — the early return is load-bearing', () => {
    // min_value = 0 between value and max_value: shared->min is already 0.0 (the struct default),
    // so set_min returns before set_value, and value stays what the 'value' line produced.
    const props = { value: 150, minValue: 0, maxValue: 200 };
    const orderedKeys = ['value', 'min_value', 'max_value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(100); // same as the "before" case above
  });

  it('page enters the clamp: set_min/set_max clamp against (max - page), not max alone (range.cpp:217-219,235-236)', () => {
    // min=0, max=200, page=50 authored before value=180: value clamps to
    // max - page = 150, not 200.
    const props = { value: 180, minValue: 0, maxValue: 200, page: 50 };
    const orderedKeys = ['min_value', 'max_value', 'page', 'value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(150);
  });

  it('a later page re-clamps a value already committed (range.cpp:254-261, set_page ends by re-clamping)', () => {
    const props = { value: 180, minValue: 0, maxValue: 200, page: 50 };
    const orderedKeys = ['min_value', 'max_value', 'value', 'page'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(150);
  });

  it('set_max validates against min (max_validated = MAX(p_max, shared->min), range.cpp:229)', () => {
    // max_value = -10 while min is still the struct default 0: Godot raises it to 0, so a value
    // of 5 clamps to that raised max.
    const props = { value: 5, maxValue: -10 };
    const orderedKeys = ['max_value', 'value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(0);
  });

  it('min_value pushes max upward when it exceeds it (shared->max = MAX(shared->max, shared->min), range.cpp:217)', () => {
    // max_value = 10 authored first, then min_value = 50 pushes max to 50 too.
    const props = { value: 5, maxValue: 10, minValue: 50 };
    const orderedKeys = ['max_value', 'min_value', 'value'];
    expect(resolveRangeValue(props, orderedKeys)).toBe(50);
  });

  it('a key absent from the raw order is simply never applied', () => {
    const props = { value: 500 };
    expect(resolveRangeValue(props, ['value'])).toBe(100); // clamped against the struct default max=100
  });

  it('a malformed (unparsed) value at its ordered position is skipped, not applied as NaN', () => {
    const props = { minValue: 10, maxValue: 20 }; // value parsed to undefined
    const orderedKeys = ['min_value', 'max_value', 'value'];
    expect(Number.isNaN(resolveRangeValue(props, orderedKeys))).toBe(false);
  });
});

describe('rangeRatio — threads the order-aware value through CLAMP(value, min, max) (ADR-0035)', () => {
  it('the "before" order lands at ratio 0.5 (100 inside 0..200), the "after" order at 0.75 (150 inside 0..200)', () => {
    const props = { value: 150, minValue: 0, maxValue: 200 };
    expect(rangeRatio(props, ['value', 'min_value', 'max_value'])).toBeCloseTo(0.5, 10);
    expect(rangeRatio(props, ['min_value', 'max_value', 'value'])).toBeCloseTo(0.75, 10);
  });

  it('with no orderedKeys argument, behaves exactly as before this change', () => {
    expect(rangeRatio({ value: 25 })).toBeCloseTo(0.25, 10);
  });
});
