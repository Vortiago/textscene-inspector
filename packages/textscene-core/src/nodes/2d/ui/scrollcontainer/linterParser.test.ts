/**
 * ScrollContainer strict validators: format and range checks.
 *
 * Covers all eleven of ScrollContainer's own members. `parser.ts` reads only
 * two of them (`horizontal_scroll_mode`, `vertical_scroll_mode`); the other
 * nine are validated here too because Godot serialises all eleven normally
 * (see the header comment in `linterParser.ts`), which makes the remaining
 * nine `linter-only` from `propertyGrammarParity.test.ts`'s point of view,
 * a real parser gap, reported rather than fixed by this validator-only slice.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

const OWN_KEYS = [
  'follow_focus',
  'draw_focus_border',
  'scroll_horizontal',
  'scroll_vertical',
  'scroll_horizontal_custom_step',
  'scroll_vertical_custom_step',
  'horizontal_scroll_mode',
  'vertical_scroll_mode',
  'scroll_deadzone',
  'scroll_hint_mode',
  'tile_scroll_hint',
];

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ScrollContainer', property);
  expect(validator, `no validator registered for ScrollContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ScrollContainer strict validators', () => {
  it('registers exactly its eleven own members', () => {
    expect(validatorRegistry.getOwnKeys('ScrollContainer').sort()).toEqual([...OWN_KEYS].sort());
  });

  it('inherits anchor_right from Control through the base walk', () => {
    const validator = validatorRegistry.findValidator('ScrollContainer', 'anchor_right');
    expect(validator).not.toBeNull();
    expect(validator!('anchor_right', '1.0', 1)).toBeNull();
  });

  it('inherits modulate from CanvasItem through the base walk', () => {
    const validator = validatorRegistry.findValidator('ScrollContainer', 'modulate');
    expect(validator).not.toBeNull();
    expect(validator!('modulate', 'Color(1, 1, 1, 1)', 1)).toBeNull();
  });

  it('accepts every value its own fixture carries', () => {
    // unit-scroll-container.tscn's "zero errors and zero warnings" claim, RUN
    // rather than reasoned. The fixture leaves both scroll modes (the only two
    // properties parser.ts reads) unset (comparison.md: "left unset (AUTO)"),
    // so this exercises the base-walked Control/CanvasItem/Node validators
    // this file imports; the per-property describe blocks below cover the
    // eleven own keys directly.
    expectFixtureClean('unit-scroll-container.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('ScrollContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scroll_container.cpp:843, BOOL, no hint. set_follow_focus
  // (scroll_container.cpp:765-767) assigns straight through.
  describe('follow_focus', () => {
    it('accepts true', () => {
      expect(check('follow_focus', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('follow_focus', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('follow_focus', 'yes')).not.toBeNull();
    });
  });

  // scroll_container.cpp:844, BOOL, no hint. set_draw_focus_border
  // (scroll_container.cpp:885-893) assigns straight through.
  describe('draw_focus_border', () => {
    it('accepts true', () => {
      expect(check('draw_focus_border', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('draw_focus_border', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('draw_focus_border', 'yes')).not.toBeNull();
    });
  });

  // scroll_container.cpp:847, INT, PROPERTY_HINT_NONE. set_h_scroll forwards
  // to the internal HScrollBar's Range::set_value, whose _calc_value
  // (range.cpp:196-197) clamps below `shared->min`; min is never changed from
  // its 0.0 default (range.h:40) on the internal scrollbars, so the floor is
  // a permanent engine invariant. The ceiling (max - page) is content-derived
  // at layout time, so it is not validated here.
  describe('scroll_horizontal', () => {
    it('accepts 0 (the documented default)', () => {
      expect(check('scroll_horizontal', '0')).toBeNull();
    });

    it('accepts a large positive value (the ceiling is content-derived, not statically bounded)', () => {
      expect(check('scroll_horizontal', '999999')).toBeNull();
    });

    it('errors below 0: Range::_calc_value clamps to shared->min, which never leaves 0', () => {
      const error = check('scroll_horizontal', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_horizontal', 'far')).not.toBeNull();
    });
  });

  // scroll_container.cpp:848, same shape via the internal VScrollBar.
  describe('scroll_vertical', () => {
    it('accepts 0 (the documented default)', () => {
      expect(check('scroll_vertical', '0')).toBeNull();
    });

    it('accepts a large positive value (the ceiling is content-derived, not statically bounded)', () => {
      expect(check('scroll_vertical', '999999')).toBeNull();
    });

    it('errors below 0: Range::_calc_value clamps to shared->min, which never leaves 0', () => {
      const error = check('scroll_vertical', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_vertical', 'far')).not.toBeNull();
    });
  });

  // scroll_container.cpp:849, FLOAT, PROPERTY_HINT_RANGE "-1,4096,suffix:px".
  // set_horizontal_custom_step forwards to ScrollBar::set_custom_step
  // (scroll_bar.cpp:562-564), which assigns straight through with no clamp,
  // so both ends are warnings. -1 is the documented default AND the legal
  // sentinel for "use the default step" (scroll_bar.cpp:112, 119, 226, 232,
  // 239, 245 read `custom_step >= 0 ? custom_step : get_step()`), so it must
  // not be rejected.
  describe('scroll_horizontal_custom_step', () => {
    it('accepts -1 (the documented default AND the "use default step" sentinel)', () => {
      expect(check('scroll_horizontal_custom_step', '-1')).toBeNull();
    });

    it('accepts 0', () => {
      expect(check('scroll_horizontal_custom_step', '0')).toBeNull();
    });

    it('accepts 4096 (the top of the hinted range)', () => {
      expect(check('scroll_horizontal_custom_step', '4096')).toBeNull();
    });

    it('warns, does not error, below -1: set_horizontal_custom_step has no clamp', () => {
      const error = check('scroll_horizontal_custom_step', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above 4096, same reason', () => {
      const error = check('scroll_horizontal_custom_step', '4097');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_horizontal_custom_step', 'big')).not.toBeNull();
    });
  });

  // scroll_container.cpp:850, same shape via the internal VScrollBar.
  describe('scroll_vertical_custom_step', () => {
    it('accepts -1 (the documented default AND the "use default step" sentinel)', () => {
      expect(check('scroll_vertical_custom_step', '-1')).toBeNull();
    });

    it('accepts 0', () => {
      expect(check('scroll_vertical_custom_step', '0')).toBeNull();
    });

    it('accepts 4096 (the top of the hinted range)', () => {
      expect(check('scroll_vertical_custom_step', '4096')).toBeNull();
    });

    it('warns, does not error, below -1: set_vertical_custom_step has no clamp', () => {
      const error = check('scroll_vertical_custom_step', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above 4096, same reason', () => {
      const error = check('scroll_vertical_custom_step', '4097');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_vertical_custom_step', 'big')).not.toBeNull();
    });
  });

  // scroll_container.cpp:851, ENUM "Disabled,Auto,Always Show,Never Show,Reserve"
  // (ScrollMode 0-4, scroll_container.h:44-50). set_horizontal_scroll_mode
  // (scroll_container.cpp:697-705) assigns straight through with no
  // ERR_FAIL_INDEX, so out-of-range is a warning rather than an error.
  describe('horizontal_scroll_mode', () => {
    it('accepts 0 (DISABLED)', () => {
      expect(check('horizontal_scroll_mode', '0')).toBeNull();
    });

    it('accepts 1 (AUTO, the documented default)', () => {
      expect(check('horizontal_scroll_mode', '1')).toBeNull();
    });

    it('accepts 4 (RESERVE, the top of the range)', () => {
      expect(check('horizontal_scroll_mode', '4')).toBeNull();
    });

    it('warns, does not error, below the enum (-1): set_horizontal_scroll_mode has no ERR_FAIL_INDEX', () => {
      const error = check('horizontal_scroll_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above the enum (5), same reason', () => {
      const error = check('horizontal_scroll_mode', '5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('horizontal_scroll_mode', 'auto')).not.toBeNull();
    });
  });

  // scroll_container.cpp:852, same enum; set_vertical_scroll_mode
  // (scroll_container.cpp:711-719) is the same unconstrained shape.
  describe('vertical_scroll_mode', () => {
    it('accepts 0 (DISABLED)', () => {
      expect(check('vertical_scroll_mode', '0')).toBeNull();
    });

    it('accepts 1 (AUTO, the documented default)', () => {
      expect(check('vertical_scroll_mode', '1')).toBeNull();
    });

    it('accepts 4 (RESERVE, the top of the range)', () => {
      expect(check('vertical_scroll_mode', '4')).toBeNull();
    });

    it('warns, does not error, below the enum (-1): set_vertical_scroll_mode has no ERR_FAIL_INDEX', () => {
      const error = check('vertical_scroll_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above the enum (5), same reason', () => {
      const error = check('vertical_scroll_mode', '5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('vertical_scroll_mode', 'auto')).not.toBeNull();
    });
  });

  // scroll_container.cpp:853, INT, no hint at all. set_deadzone
  // (scroll_container.cpp:729-731) assigns straight through with nothing to
  // ground: format-only.
  describe('scroll_deadzone', () => {
    it('accepts 0 (the documented default)', () => {
      expect(check('scroll_deadzone', '0')).toBeNull();
    });

    it('accepts a large positive value: no hint bounds it', () => {
      expect(check('scroll_deadzone', '999999')).toBeNull();
    });

    it('accepts a negative value: set_deadzone has no floor', () => {
      expect(check('scroll_deadzone', '-5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_deadzone', 'far')).not.toBeNull();
    });
  });

  // scroll_container.cpp:856, ENUM "Disabled,All,Top and Left,Bottom and Right"
  // (ScrollHintMode 0-3, scroll_container.h:52-57). set_scroll_hint_mode
  // (scroll_container.cpp:733-740) assigns straight through with no
  // ERR_FAIL_INDEX, so out-of-range is a warning.
  describe('scroll_hint_mode', () => {
    it('accepts 0 (DISABLED, the documented default)', () => {
      expect(check('scroll_hint_mode', '0')).toBeNull();
    });

    it('accepts 3 (BOTTOM_AND_RIGHT, the top of the range)', () => {
      expect(check('scroll_hint_mode', '3')).toBeNull();
    });

    it('warns, does not error, below the enum (-1): set_scroll_hint_mode has no ERR_FAIL_INDEX', () => {
      const error = check('scroll_hint_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns, does not error, above the enum (4), same reason', () => {
      const error = check('scroll_hint_mode', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_hint_mode', 'all')).not.toBeNull();
    });
  });

  // scroll_container.cpp:857, BOOL, no hint. set_tile_scroll_hint
  // (scroll_container.cpp:746-755) assigns straight through.
  describe('tile_scroll_hint', () => {
    it('accepts true', () => {
      expect(check('tile_scroll_hint', 'true')).toBeNull();
    });

    it('accepts false (the documented default)', () => {
      expect(check('tile_scroll_hint', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('tile_scroll_hint', 'yes')).not.toBeNull();
    });
  });
});
