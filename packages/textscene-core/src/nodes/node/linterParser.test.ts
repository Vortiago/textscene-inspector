/**
 * Node strict validators — format and range checks.
 *
 * These reach every registered type, so the inheritance assertions matter as
 * much as the per-property ones: a bound that is wrong here is wrong on all 240
 * types simultaneously.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string, nodeType = 'Node') {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator registered for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Node strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('Node')).toHaveLength(10);
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('Node')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('process_mode', () => {
    it('accepts 3 (ALWAYS), the value the corpus uses most', () => {
      expect(check('process_mode', '3')).toBeNull();
    });

    it('accepts 4 (DISABLED), the last of the five constants', () => {
      expect(check('process_mode', '4')).toBeNull();
    });

    it('rejects 5, one past the enum', () => {
      expect(check('process_mode', '5')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('process_mode', '-1')).not.toBeNull();
    });
  });

  describe('process_priority', () => {
    it('accepts a negative priority, since the hint states no bound', () => {
      // node.cpp:4057 is a bare INT: Godot runs lower priorities first and
      // negatives are ordinary.
      expect(check('process_priority', '-10')).toBeNull();
    });

    it('accepts a large positive priority', () => {
      expect(check('process_priority', '1000')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      // `v.int` is the repo-wide integer validator and tolerates a decimal the
      // way Godot's own int parse does; a non-number is the real malformation.
      expect(check('process_priority', 'high')).not.toBeNull();
    });
  });

  describe('physics_interpolation_mode', () => {
    it('accepts 2 (OFF), the last constant', () => {
      expect(check('physics_interpolation_mode', '2')).toBeNull();
    });

    it('rejects 3', () => {
      expect(check('physics_interpolation_mode', '3')).not.toBeNull();
    });
  });

  describe('auto_translate_mode', () => {
    it('accepts 1 (ALWAYS), which the corpus carries', () => {
      expect(check('auto_translate_mode', '1')).toBeNull();
    });

    it('rejects 3', () => {
      expect(check('auto_translate_mode', '3')).not.toBeNull();
    });
  });

  describe('process_thread_messages', () => {
    it('accepts a combined bitfield', () => {
      expect(check('process_thread_messages', '3')).toBeNull();
    });

    it('carries no range bound: node.cpp:4063 is PROPERTY_HINT_FLAGS, a 2-bit ' +
      'bitmask rather than a linear range, and set_process_thread_messages ' +
      '(node.cpp:1233-1239) is a bare BitField assignment', () => {
      expect(check('process_thread_messages', '-1')).toBeNull();
    });
  });

  describe('unique_name_in_owner', () => {
    it('accepts true, the only value the corpus writes', () => {
      expect(check('unique_name_in_owner', 'true')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('unique_name_in_owner', '1')).not.toBeNull();
    });
  });

  describe('editor_description', () => {
    it('accepts a quoted description', () => {
      expect(check('editor_description', '"Explains the node"')).toBeNull();
    });

    it('accepts a multi-line description, which the scanner joins before validating', () => {
      expect(check('editor_description', '"line one\nline two"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('editor_description', 'unquoted')).not.toBeNull();
    });
  });

  it('omits the four PROPERTY_USAGE_NONE members Godot never serialises', () => {
    // node.cpp:4049, :4051, :4052, :4053 — a node's name and instance path live
    // in the [node …] heading, not in a property line.
    const own = validatorRegistry.getOwnKeys('Node');
    expect(own).not.toContain('name');
    expect(own).not.toContain('scene_file_path');
    expect(own).not.toContain('owner');
    expect(own).not.toContain('multiplayer');
  });

  it.each(['Node2D', 'Node3D', 'Control', 'Camera3D', 'Button'])(
    'reaches %s through the base-walk',
    (type) => {
      expect(validatorRegistry.findValidator(type, 'process_mode')).not.toBeNull();
      expect(check('process_mode', '9', type)).not.toBeNull();
    }
  );
});
