/**
 * Node strict validators: format and range checks. These reach every registered type, so the
 * inheritance assertions matter as much as the per-property ones.
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

    it('warns one past each end: -1 and 5', () => {
      // node.cpp:4056 hints five labels and set_process_mode (node.cpp:663-689)
      // carries no ERR_FAIL_INDEX, so the hint is the only bound: warning tier.
      expect(check('process_mode', '5')?.severity).toBe('warning');
      expect(check('process_mode', '-1')?.severity).toBe('warning');
    });
  });

  describe('process_thread_group', () => {
    it('accepts 0 (INHERIT) and 2 (SUB_THREAD), the ends of the three-label hint', () => {
      // ProcessThreadGroup is densely 0-2 (node.h:83-87, BIND_ENUM_CONSTANT
      // node.cpp:4009-4011); node.cpp:4061 hints "Inherit,Main Thread,Sub Thread".
      expect(check('process_thread_group', '0')).toBeNull();
      expect(check('process_thread_group', '2')).toBeNull();
    });

    it('warns one past each end: -1 and 3', () => {
      // set_process_thread_group (node.cpp:1194) bare-assigns after a main-thread
      // guard, so nothing but the inspector hint bounds it.
      expect(check('process_thread_group', '-1')?.severity).toBe('warning');
      expect(check('process_thread_group', '3')?.severity).toBe('warning');
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
    it('accepts 0 (INHERIT) and 2 (OFF), the ends of the three-label hint', () => {
      expect(check('physics_interpolation_mode', '0')).toBeNull();
      expect(check('physics_interpolation_mode', '2')).toBeNull();
    });

    it('warns one past each end: -1 and 3', () => {
      // node.cpp:4066 hints "Inherit,On,Off"; set_physics_interpolation_mode
      // (node.cpp:935-949) bare-assigns.
      expect(check('physics_interpolation_mode', '-1')?.severity).toBe('warning');
      expect(check('physics_interpolation_mode', '3')?.severity).toBe('warning');
    });
  });

  describe('auto_translate_mode', () => {
    it('accepts 0 (INHERIT), 1 (ALWAYS, which the corpus carries) and 2 (DISABLED)', () => {
      expect(check('auto_translate_mode', '0')).toBeNull();
      expect(check('auto_translate_mode', '1')).toBeNull();
      expect(check('auto_translate_mode', '2')).toBeNull();
    });

    it('warns one past each end: -1 and 3', () => {
      // node.cpp:4069 hints "Inherit,Always,Disabled"; set_auto_translate_mode
      // (node.cpp:1331-1340) bare-assigns apart from a root-node ERR_FAIL_MSG.
      expect(check('auto_translate_mode', '-1')?.severity).toBe('warning');
      expect(check('auto_translate_mode', '3')?.severity).toBe('warning');
    });
  });

  /**
   * node.cpp:4063 is PROPERTY_HINT_FLAGS "Process,Physics Process", and ProcessThreadMessages
   * (node.h:89-93) declares no bit outside it. set_process_thread_messages (node.cpp:1233-1240)
   * bare-assigns with no mask: measured on 4.6.3, writing 7 stores 7, so an unlisted bit is kept
   * but unreachable from the inspector, a warning, never an error.
   */
  describe('process_thread_messages', () => {
    it.each(['0', '1', '2', '3'])('accepts %s, a subset of the hinted bits', (value) => {
      expect(check('process_thread_messages', value)).toBeNull();
    });

    it('warns on a bit the hint does not offer, naming the ones it does', () => {
      const error = check('process_thread_messages', '7');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('FLAG_PROCESS_THREAD_MESSAGES (1)');
      expect(error?.message).toContain('FLAG_PROCESS_THREAD_MESSAGES_PHYSICS (2)');
    });

    it('warns on a negative, which sets every bit rather than none', () => {
      expect(check('process_thread_messages', '-1')?.severity).toBe('warning');
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
    // node.cpp:4049, :4051, :4052, :4053: a node's name and instance path live
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
