/**
 * GraphNode strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GraphNode', property);
  expect(validator, `no validator registered for GraphNode.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GraphNode strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GraphNode')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GraphNode')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('title', () => {
    it('accepts a quoted string', () => {
      expect(check('title', '"Result"')).toBeNull();
    });

    it('accepts the empty quoted default', () => {
      expect(check('title', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('title', 'Result')).not.toBeNull();
    });

    it('rejects trailing junk after the closing quote', () => {
      expect(check('title', '"Head" junk "Tail"')).not.toBeNull();
    });
  });

  describe('ignore_invalid_connection_type', () => {
    it('accepts true and false', () => {
      expect(check('ignore_invalid_connection_type', 'true')).toBeNull();
      expect(check('ignore_invalid_connection_type', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('ignore_invalid_connection_type', '1')).not.toBeNull();
    });
  });

  describe('slots_focus_mode', () => {
    it('accepts the three enforced values', () => {
      expect(check('slots_focus_mode', '1')).toBeNull();
      expect(check('slots_focus_mode', '2')).toBeNull();
      expect(check('slots_focus_mode', '3')).toBeNull();
    });

    it('errors at FOCUS_NONE=0 (ERR_FAIL_COND refuses it here, unlike plain Control.focus_mode)', () => {
      const result = check('slots_focus_mode', '0');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors above the enforced range', () => {
      const result = check('slots_focus_mode', '4');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors below zero', () => {
      const result = check('slots_focus_mode', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('slot/<index>/<leaf>', () => {
    // `_set` is hand-rolled (`graph_node.cpp:130`) and reads the index with a
    // bare `to_int()` (`:45`), which answers 0 for text it cannot read — no
    // `is_valid_int` gate — so Godot applies the write and the linter must not
    // report the key as unknown.
    it('accepts a non-numeric index, which `to_int` reads as slot 0', () => {
      expect(check('slot/x/left_enabled', 'true')).toBeNull();
    });

    it('accepts a fully populated slot 0', () => {
      expect(check('slot/0/left_enabled', 'true')).toBeNull();
      expect(check('slot/0/left_type', '2')).toBeNull();
      expect(check('slot/0/left_color', 'Color(1, 0, 0, 1)')).toBeNull();
      expect(check('slot/0/left_icon', 'null')).toBeNull();
      expect(check('slot/0/right_enabled', 'true')).toBeNull();
      expect(check('slot/0/right_type', '0')).toBeNull();
      expect(check('slot/0/right_color', 'Color(0, 1, 0, 1)')).toBeNull();
      expect(check('slot/0/right_icon', 'null')).toBeNull();
      expect(check('slot/0/draw_stylebox', 'true')).toBeNull();
    });

    it('accepts a higher slot index', () => {
      expect(check('slot/3/left_enabled', 'false')).toBeNull();
    });

    it('accepts a resource reference for an icon leaf', () => {
      expect(check('slot/0/left_icon', 'SubResource("Texture2D_1")')).toBeNull();
      expect(check('slot/0/right_icon', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a non-boolean enabled flag', () => {
      expect(check('slot/0/left_enabled', 'maybe')).not.toBeNull();
      expect(check('slot/0/right_enabled', 'maybe')).not.toBeNull();
      expect(check('slot/0/draw_stylebox', 'maybe')).not.toBeNull();
    });

    it('rejects a non-integer type', () => {
      expect(check('slot/0/left_type', 'two')).not.toBeNull();
    });

    it('accepts a negative type (disables user-made connections, per the class docs — no bound on the value itself)', () => {
      expect(check('slot/0/left_type', '-1')).toBeNull();
    });

    it('rejects a malformed color', () => {
      expect(check('slot/0/left_color', 'Color(1, 0)')).not.toBeNull();
    });

    it('rejects an icon that is neither null nor a resource reference', () => {
      expect(check('slot/0/left_icon', '"not-a-reference"')).not.toBeNull();
    });

    it('rejects an unknown leaf name under a valid index', () => {
      expect(check('slot/0/left_bogus', 'true')).not.toBeNull();
    });

    it('errors on a negative slot index — GraphNode::set_slot refuses it (graph_node.cpp:706)', () => {
      const result = check('slot/-1/left_enabled', 'true');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('rejects a key with no leaf segment at all', () => {
      expect(check('slot/0', 'true')).not.toBeNull();
    });
  });

  it("inherits GraphElement's own position_offset through the base-walk", () => {
    expect(validatorRegistry.findValidator('GraphNode', 'position_offset')).not.toBeNull();
  });

  it("inherits Control's layout set through the base-walk", () => {
    expect(validatorRegistry.findValidator('GraphNode', 'anchor_right')).not.toBeNull();
  });

  it("inherits CanvasItem's modulate through the base-walk", () => {
    expect(validatorRegistry.findValidator('GraphNode', 'modulate')).not.toBeNull();
  });
});
