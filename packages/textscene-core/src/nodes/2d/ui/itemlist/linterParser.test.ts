/**
 * ItemList strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. Each property group gets a
 * happy, a malformed and a bound case, with the Godot source line beside each bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ItemList', property);
  expect(validator, `no validator registered for ItemList.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * ItemList binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do not delete an assertion to go green.
 */
const KEYS: string[] = [
  // The 18 ADD_PROPERTY / ADD_ARRAY_COUNT calls at item_list.cpp:2392-2411, in
  // source order. `clip_contents` and `focus_mode` carry overrides="Control" in
  // doc/classes/ItemList.xml (default-value changes, not new properties) and are
  // therefore absent here.
  'select_mode',
  'allow_reselect',
  'allow_rmb_select',
  'allow_search',
  'max_text_lines',
  'auto_width',
  'auto_height',
  'text_overrun_behavior',
  'wraparound_items',
  'scroll_hint_mode',
  'tile_scroll_hint',
  'item_count',
  'max_columns',
  'same_column_width',
  'fixed_column_width',
  'icon_mode',
  'icon_scale',
  'fixed_icon_size',
  // Not an ADD_PROPERTY: the PropertyListHelper family at item_list.cpp:2461-2466.
  'item_#/*',
  // Not an ADD_PROPERTY either: `_set`'s deprecated fallback (item_list.cpp:2242-2259).
  'items',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('ItemList strict validators', () => {
  it('registers exactly what ItemList binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ItemList').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run rather than
    // reasoned. `fixtureLint` checks it against the whole registry through the
    // barrel; this checks it against this test's imports alone.
    expectFixtureClean('unit-item-list.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This
    // check is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('ItemList')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

/**
 * The eight plain `Variant::BOOL` bindings (item_list.cpp:2393-2395, 2397-2398,
 * 2400, 2402, 2406). Every one of their setters is a bare assignment past an
 * equality early-out, so there is no value to ground: `true`/`false` in, nothing
 * else readable by Godot's own parser.
 */
const BOOLEANS = [
  'allow_reselect',
  'allow_rmb_select',
  'allow_search',
  'auto_width',
  'auto_height',
  'wraparound_items',
  'tile_scroll_hint',
  'same_column_width',
];

describe('ItemList booleans', () => {
  it.each(BOOLEANS)('accepts true and false for %s', (property) => {
    expect(check(property, 'true')).toBeNull();
    expect(check(property, 'false')).toBeNull();
  });

  it.each(BOOLEANS)('converts the integer spelling for %s rather than refusing it', (property) => {
    // Godot stores true for `1` in a BOOL slot (`variant.cpp:550-558`), so the
    // spelling is a warning about what gets written back, not a refusal.
    const error = check(property, '1');
    expect(error?.severity).toBe('warning');
    expect(error?.message).toContain(property);
  });

  it('rejects capitalised True, which the TSCN grammar does not spell', () => {
    // Godot's variant parser matches the lowercase token only, so `True` is not
    // a boolean the engine would have read either.
    expect(check('allow_search', 'True')).not.toBeNull();
  });
});

describe('ItemList enums', () => {
  it('accepts every SelectMode and warns past the hint', () => {
    // SELECT_SINGLE=0, SELECT_MULTI=1, SELECT_TOGGLE=2 (item_list.h:48-50);
    // hint "Single,Multi,Toggle" at item_list.cpp:2392.
    for (const value of ['0', '1', '2']) expect(check('select_mode', value)).toBeNull();
    // set_select_mode (item_list.cpp:657-665) assigns straight through, so 3 is
    // stored and merely unreachable from the inspector: a warning, not an error.
    expect(check('select_mode', '3')?.severity).toBe('warning');
    expect(check('select_mode', '-1')?.severity).toBe('warning');
  });

  it('errors past IconMode, whose setter refuses the write', () => {
    // ICON_MODE_TOP=0, ICON_MODE_LEFT=1 (item_list.h:43-44).
    for (const value of ['0', '1']) expect(check('icon_mode', value)).toBeNull();
    // ERR_FAIL_INDEX((int)p_mode, 2) at item_list.cpp:672 drops the write, so
    // out of range is an error rather than a hint warning.
    expect(check('icon_mode', '2')?.severity).toBe('error');
    expect(check('icon_mode', '-1')?.severity).toBe('error');
  });

  it('accepts every ScrollHintMode and warns past the hint', () => {
    // SCROLL_HINT_MODE_DISABLED=0 .. SCROLL_HINT_MODE_BOTTOM=3 (item_list.h:54-57).
    for (const value of ['0', '1', '2', '3']) {
      expect(check('scroll_hint_mode', value)).toBeNull();
    }
    // set_scroll_hint_mode (item_list.cpp:2211-2218) assigns straight through.
    expect(check('scroll_hint_mode', '4')?.severity).toBe('warning');
  });

  it('accepts every OverrunBehavior and warns past the hint', () => {
    // OVERRUN_NO_TRIMMING=0 .. OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6, the 7 labels
    // the hint at item_list.cpp:2399 spells out.
    for (const value of ['0', '1', '2', '3', '4', '5', '6']) {
      expect(check('text_overrun_behavior', value)).toBeNull();
    }
    // set_text_overrun_behavior (item_list.cpp:2182-2191) assigns straight through.
    expect(check('text_overrun_behavior', '7')?.severity).toBe('warning');
  });

  it('rejects a non-numeric enum value as a format error', () => {
    const error = check('select_mode', 'Single');
    expect(error?.severity).toBe('error');
    expect(error?.code).toBe('INVALID_SELECT_MODE_FORMAT');
  });
});

describe('ItemList counts and sizes', () => {
  it('holds max_text_lines at its enforced floor of 1', () => {
    // ERR_FAIL_COND(p_lines < 1) at item_list.cpp:619.
    expect(check('max_text_lines', '1')).toBeNull();
    expect(check('max_text_lines', '0')?.severity).toBe('error');
    expect(check('max_text_lines', '-3')?.severity).toBe('error');
  });

  it('lets max_text_lines past the hint ceiling, which `or_greater` opens', () => {
    // Hint "1,10,1,or_greater" (item_list.cpp:2396): the trailing `or_greater`
    // opens the max end, so 40 lines is legal and must draw no diagnostic.
    expect(check('max_text_lines', '10')).toBeNull();
    expect(check('max_text_lines', '40')).toBeNull();
  });

  it.each([
    ['item_count', 'item_list.cpp:527'],
    ['max_columns', 'item_list.cpp:641'],
    ['fixed_column_width', 'item_list.cpp:589'],
  ])('errors below the enforced 0 floor on %s (%s)', (property) => {
    expect(check(property, '0')).toBeNull();
    expect(check(property, '7')).toBeNull();
    expect(check(property, '-1')?.severity).toBe('error');
  });

  it('leaves the max_columns and fixed_column_width ceilings open', () => {
    // Both hints end in `or_greater` (item_list.cpp:2405 and :2407), so their
    // stated 10 and 100 are inspector step ranges, not bounds.
    expect(check('max_columns', '64')).toBeNull();
    expect(check('fixed_column_width', '4096')).toBeNull();
  });

  it('accepts any finite icon_scale, including one below 1', () => {
    // item_list.cpp:2410 is PROPERTY_HINT_NONE: no range at all. The only guard
    // is ERR_FAIL_COND(!Math::is_finite(p_scale)) at item_list.cpp:2098, so a
    // negative or fractional scale is stored as written.
    expect(check('icon_scale', '1.0')).toBeNull();
    expect(check('icon_scale', '0.25')).toBeNull();
    expect(check('icon_scale', '-2.5')).toBeNull();
    expect(check('icon_scale', '512')).toBeNull();
  });

  it('rejects a non-finite icon_scale, which the setter refuses', () => {
    // Godot writes non-finite floats as `inf` / `inf_neg` / `nan`; the setter
    // ERR_FAILs on all three, so none of them ever lands.
    for (const value of ['inf', 'inf_neg', 'nan']) {
      expect(check('icon_scale', value)?.severity).toBe('error');
    }
  });

  it('takes fixed_icon_size as Vector2i, negatives included', () => {
    // item_list.cpp:2411 is VECTOR2I with PROPERTY_HINT_NONE ("suffix:px" only),
    // and set_fixed_icon_size (item_list.cpp:691-699) is a bare assignment, so
    // there is no component bound to check.
    expect(check('fixed_icon_size', 'Vector2i(0, 0)')).toBeNull();
    expect(check('fixed_icon_size', 'Vector2i(32, 24)')).toBeNull();
    expect(check('fixed_icon_size', 'Vector2i(-4, -4)')).toBeNull();
  });

  it('takes a float component, which Godot converts, and rejects the wrong type name', () => {
    // `_parse_construct<int32_t>` (variant_parser.cpp:577-592) takes any number
    // token, so `32.5` loads as 32. `Vector2` is a different Variant type and
    // does not convert.
    // Loads, but stores 32 rather than 32.5: the truncation warning.
    expect(check('fixed_icon_size', 'Vector2i(32.5, 24)')?.severity).toBe('warning');
    // `Vector2` converts into a `Vector2i` slot (variant.cpp:536-830), so this
    // is a file Godot opens; only a type that does not convert is an error.
    expect(check('fixed_icon_size', 'Vector2(32, 24)')).toBeNull();
    expect(check('fixed_icon_size', 'Color(1, 1, 1, 1)')?.severity).toBe('error');
  });
});

describe('ItemList per-item family', () => {
  it('reaches the four leaves the property helper registers', () => {
    // item_list.cpp:2463-2466: text, icon, selectable, disabled.
    expect(check('item_0/text', '"Sword"')).toBeNull();
    expect(check('item_3/icon', 'ExtResource("1_icon")')).toBeNull();
    expect(check('item_12/selectable', 'false')).toBeNull();
    expect(check('item_2/disabled', 'true')).toBeNull();
  });

  it('checks each leaf against its own format', () => {
    expect(check('item_0/text', 'Sword')).not.toBeNull();
    expect(check('item_0/icon', '"res://icon.svg"')).not.toBeNull();
    expect(check('item_0/selectable', 'yes')).not.toBeNull();
    expect(check('item_0/disabled', '1')).not.toBeNull();
  });

  it('errors on a negative index, which the helper refuses to resolve', () => {
    // property_list_helper.cpp:58 returns nullptr for index < 0, so `_set`
    // treats the key as unrecognised and the write never lands.
    const error = check('item_-1/text', '"Sword"');
    expect(error?.severity).toBe('error');
    expect(error?.code).toBe('INVALID_ITEM_INDEX');
  });

  it('rejects a leaf name ItemList does not register', () => {
    // PopupMenu has item_0/id and item_0/checked; ItemList has neither, so a
    // scene copied across from one must not read as valid here.
    expect(check('item_0/id', '3')?.code).toBe('INVALID_ITEM_KEY');
    expect(check('item_0/checked', 'true')?.code).toBe('INVALID_ITEM_KEY');
  });

  it('errors on an index that is not an integer, which the helper never resolves', () => {
    // `ItemList::_set` routes each per-item key through
    // `property_helper.property_set_value` (item_list.cpp:2238), whose `_get_property`
    // returns nullptr unless the index `is_valid_int()` (property_list_helper.cpp:53-55).
    // Godot drops the write, so this is the error tier.
    expect(check('item_x/text', '"Sword"')?.code).toBe('INVALID_ITEM_KEY');
    expect(check('item_1.5/text', '"Sword"')?.code).toBe('INVALID_ITEM_KEY');
  });

  it('rejects an unrecognised key shape handed straight to the dispatcher', () => {
    // The dispatcher guards the same case, so the pattern key `item_#/*`, which
    // the malformed-value check passes in verbatim, is refused.
    const dispatcher = validatorRegistry.findValidator('ItemList', 'item_#/*');
    expect(dispatcher).not.toBeNull();
    expect(dispatcher!('item_x/text', '"Sword"', 1)?.code).toBe('INVALID_ITEM_KEY');
  });

  it('does not swallow a same-prefixed scalar', () => {
    // `item_count` starts with the family prefix but has no `/`, and the exact
    // match must win before any wildcard sees it.
    expect(check('item_count', '3')).toBeNull();
    expect(check('item_count', '-1')?.code).toBe('INVALID_ITEM_COUNT_VALUE');
  });
});

describe('ItemList deprecated items compat array', () => {
  it('accepts an Array literal, whatever it holds (shape only)', () => {
    expect(check('items', '["Sword", null, false]')).toBeNull();
    expect(check('items', '[]')).toBeNull();
  });

  it('rejects a non-Array value', () => {
    expect(check('items', '"Sword"')).not.toBeNull();
  });
});
