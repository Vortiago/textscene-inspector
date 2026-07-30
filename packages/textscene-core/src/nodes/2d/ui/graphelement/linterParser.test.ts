/**
 * GraphElement strict validators — format checks for GraphElement's OWN members.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour (the selectable/selected interaction)
 * lives in linter.test.ts, through `Linter`.
 *
 * GraphElement's own members are all plain VECTOR2 or BOOL in
 * scene/gui/graph_element.cpp's `ADD_PROPERTY` list — none carries a
 * `PROPERTY_HINT_RANGE` or other bound — so every property here is
 * format-only.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GraphElement', property);
  expect(validator, `no validator registered for GraphElement.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GraphElement strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GraphElement')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases below are specific.
    const accepted = validatorRegistry
      .getOwnKeys('GraphElement')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scene/gui/graph_element.cpp:243 — ADD_PROPERTY(PropertyInfo(Variant::VECTOR2, "position_offset"), "set_position_offset", "get_position_offset");
  describe('position_offset', () => {
    it('accepts a typical value', () => {
      expect(check('position_offset', 'Vector2(120, 40)')).toBeNull();
    });

    it('rejects a non-Vector2 value', () => {
      expect(check('position_offset', '120, 40')).not.toBeNull();
    });

    it('accepts negative components — position_offset is relative to GraphEdit scroll, so it has no lower bound', () => {
      expect(check('position_offset', 'Vector2(-50, -75.5)')).toBeNull();
    });
  });

  // scene/gui/graph_element.cpp:244 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "resizable"), "set_resizable", "is_resizable");
  describe('resizable', () => {
    it('accepts true', () => {
      expect(check('resizable', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('resizable', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('resizable', 'yes')).not.toBeNull();
    });
  });

  // scene/gui/graph_element.cpp:245 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "draggable"), "set_draggable", "is_draggable");
  describe('draggable', () => {
    it('accepts true', () => {
      expect(check('draggable', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('draggable', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('draggable', '1')).not.toBeNull();
    });
  });

  // scene/gui/graph_element.cpp:246 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selectable"), "set_selectable", "is_selectable");
  describe('selectable', () => {
    it('accepts true', () => {
      expect(check('selectable', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('selectable', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('selectable', 'maybe')).not.toBeNull();
    });
  });

  // scene/gui/graph_element.cpp:247 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "selected"), "set_selected", "is_selected");
  describe('selected', () => {
    it('accepts true', () => {
      expect(check('selected', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('selected', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('selected', 'nope')).not.toBeNull();
    });
  });

  // scene/gui/graph_element.cpp:248 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "scaling_menus"), "set_scaling_menus", "is_scaling_menus");
  describe('scaling_menus', () => {
    it('accepts true', () => {
      expect(check('scaling_menus', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('scaling_menus', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('scaling_menus', 'on')).not.toBeNull();
    });
  });
});
