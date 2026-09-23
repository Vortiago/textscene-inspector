/**
 * SplitContainer strict validators, asserted through `validatorRegistry` rather than a linted
 * `.tscn`, so a failure points at the validator. SplitContainer has no cross-field rule
 * (comparison.md), so it has no linter.ts. Each property gets a happy, a malformed and a bound
 * case, with the governing Godot line beside each bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SplitContainer', property);
  expect(validator, `no validator registered for SplitContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SplitContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SplitContainer')).not.toEqual([]);
  });

  it('registers all 11 of its own members — the full doc/classes/SplitContainer.xml list', () => {
    expect(validatorRegistry.getOwnKeys('SplitContainer').sort()).toEqual(
      [
        'collapsed',
        'drag_area_highlight_in_editor',
        'drag_area_margin_begin',
        'drag_area_margin_end',
        'drag_area_offset',
        'dragger_visibility',
        'dragging_enabled',
        'split_offset',
        'split_offsets',
        'touch_dragger_enabled',
        'vertical',
      ].sort()
    );
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SplitContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('does not re-register an inherited Control member — SplitContainer.xml carries no overrides= attribute, but size_flags_horizontal is still Control’s to own', () => {
    expect(validatorRegistry.getOwnKeys('SplitContainer')).not.toContain('size_flags_horizontal');
  });

  // split_container.cpp:1295: ADD_PROPERTY(PropertyInfo(Variant::PACKED_INT32_ARRAY,
  // "split_offsets", PROPERTY_HINT_NONE, "suffix:px"), "set_split_offsets", "get_split_offsets");
  describe('split_offsets', () => {
    it('accepts the Godot default', () => {
      expect(check('split_offsets', 'PackedInt32Array(0)')).toBeNull();
    });

    it('accepts more than one dragger offset', () => {
      expect(check('split_offsets', 'PackedInt32Array(60, 120)')).toBeNull();
    });

    it('accepts a negative offset — no lower bound in set_split_offsets', () => {
      expect(check('split_offsets', 'PackedInt32Array(-40)')).toBeNull();
    });

    it('accepts an empty array', () => {
      expect(check('split_offsets', 'PackedInt32Array()')).toBeNull();
    });

    it('accepts the typed and bare spellings the slot converts', () => {
      // `can_convert_strict` lists ARRAY as a valid source for
      // PACKED_INT32_ARRAY (variant.cpp:467-473) and `set_split_offsets`
      // (split_container.cpp:1071) takes a `PackedInt32Array`, so both load.
      expect(check('split_offsets', 'Array[int]([3, 7])')).toBeNull();
      expect(check('split_offsets', '[3, 7]')).toBeNull();
      expect(check('split_offsets', '[]')).toBeNull();
    });

    it('rejects a value that is no array at all', () => {
      expect(check('split_offsets', '0, 60')).not.toBeNull();
    });

    it('accepts a fractional or exponent element, which Godot narrows on load', () => {
      // `_parse_construct<int32_t>` narrows any number token. Measured on 4.6.3,
      // `PackedInt32Array(1.5, 0)` loads as `[1, 0]` (truncated, so a warning) and
      // `(2e3, 0)` as `[2000, 0]` (stored exactly, so nothing).
      expect(check('split_offsets', 'PackedInt32Array(1.5)')?.severity).toBe('warning');
      expect(check('split_offsets', 'PackedInt32Array(2e3, 0)')).toBeNull();
    });

    it('rejects a leading plus, which fails the load outright', () => {
      // `get_token` consumes a leading `-` and then requires a digit
      // (variant_parser.cpp:420, :424); `+` falls through to `Unexpected
      // character`. Measured: the scene does not load at all.
      expect(check('split_offsets', 'PackedInt32Array(+3, 0)')).not.toBeNull();
    });

    it('rejects an element Godot\'s tokenizer cannot read', () => {
      expect(check('split_offsets', 'PackedInt32Array(0, nope)')).not.toBeNull();
    });

    it(
      'accepts a length that does not match the child count — set_split_offsets ' +
        '(cpp:1071) takes any length and defers the mismatch to split_offset_pending',
      () => {
        expect(check('split_offsets', 'PackedInt32Array(10, 20, 30, 40)')).toBeNull();
      }
    );
  });

  // split_container.cpp:1296: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "collapsed"), ...)
  describe('collapsed', () => {
    it('accepts true', () => {
      expect(check('collapsed', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('collapsed', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('collapsed', 'yes')).not.toBeNull();
    });
  });

  // split_container.cpp:1297: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "dragging_enabled"), ...)
  describe('dragging_enabled', () => {
    it('accepts true', () => {
      expect(check('dragging_enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('dragging_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('dragging_enabled', 'maybe')).not.toBeNull();
    });
  });

  // split_container.cpp:1298: BIND_ENUM_CONSTANT DRAGGER_VISIBLE=0, DRAGGER_HIDDEN=1,
  // DRAGGER_HIDDEN_COLLAPSED=2 (cpp:1308-1310).
  describe('dragger_visibility', () => {
    it('accepts 0 (DRAGGER_VISIBLE)', () => {
      expect(check('dragger_visibility', '0')).toBeNull();
    });

    it('accepts 1 (DRAGGER_HIDDEN)', () => {
      expect(check('dragger_visibility', '1')).toBeNull();
    });

    it('accepts 2 (DRAGGER_HIDDEN_COLLAPSED)', () => {
      expect(check('dragger_visibility', '2')).toBeNull();
    });

    it('rejects a value above the BIND_ENUM_CONSTANT range', () => {
      expect(check('dragger_visibility', '3')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('dragger_visibility', 'VISIBLE')).not.toBeNull();
    });
  });

  // split_container.cpp:1299: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "vertical"), ...)
  describe('vertical', () => {
    it('accepts true', () => {
      expect(check('vertical', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('vertical', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('vertical', '1')).not.toBeNull();
    });
  });

  // split_container.cpp:1300: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "touch_dragger_enabled"), ...)
  describe('touch_dragger_enabled', () => {
    it('accepts true', () => {
      expect(check('touch_dragger_enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('touch_dragger_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('touch_dragger_enabled', 'on')).not.toBeNull();
    });
  });

  // split_container.cpp:1303: set_drag_area_margin_begin (cpp:1186) assigns with no clamp.
  describe('drag_area_margin_begin', () => {
    it('accepts the Godot default', () => {
      expect(check('drag_area_margin_begin', '0')).toBeNull();
    });

    it('accepts a negative value — the setter has no lower bound', () => {
      expect(check('drag_area_margin_begin', '-10')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('drag_area_margin_begin', 'wide')).not.toBeNull();
    });
  });

  // split_container.cpp:1304: set_drag_area_margin_end (cpp:1198) assigns with no clamp.
  describe('drag_area_margin_end', () => {
    it('accepts a typical value', () => {
      expect(check('drag_area_margin_end', '8')).toBeNull();
    });

    it('accepts a negative value — the setter has no lower bound', () => {
      expect(check('drag_area_margin_end', '-8')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('drag_area_margin_end', 'tall')).not.toBeNull();
    });
  });

  // split_container.cpp:1305: set_drag_area_offset (cpp:1210) assigns with no clamp.
  describe('drag_area_offset', () => {
    it('accepts a positive shift', () => {
      expect(check('drag_area_offset', '4')).toBeNull();
    });

    it('accepts a negative shift — the drag area can move either way', () => {
      expect(check('drag_area_offset', '-4')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('drag_area_offset', 'sideways')).not.toBeNull();
    });
  });

  // split_container.cpp:1306: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "drag_area_highlight_in_editor"), ...)
  describe('drag_area_highlight_in_editor', () => {
    it('accepts true', () => {
      expect(check('drag_area_highlight_in_editor', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('drag_area_highlight_in_editor', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('drag_area_highlight_in_editor', 'gold')).not.toBeNull();
    });
  });

  // split_container.cpp:1330: deprecated compat property (PROPERTY_USAGE_NO_EDITOR, not
  // PROPERTY_USAGE_NONE, so it still reaches a .tscn). set_split_offset (cpp:1056) has no
  // clamp on the offset value.
  describe('split_offset', () => {
    it('accepts a typical value', () => {
      expect(check('split_offset', '60')).toBeNull();
    });

    it('accepts a negative value — the setter has no lower bound', () => {
      expect(check('split_offset', '-30')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('split_offset', 'sixty')).not.toBeNull();
    });
  });
});
