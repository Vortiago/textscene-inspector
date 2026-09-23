/**
 * Tests the Skeleton2D strict validators through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.declarationFor('Skeleton2D', property);
  expect(validator, `no validator registered for Skeleton2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Skeleton2D binds no `ADD_PROPERTY` (skeleton_2d.cpp:817-831). Its one key,
 * `modification_stack`, comes from the `_set`/`_get`/`_get_property_list`
 * override (skeleton_2d.cpp:514/522/530). No `PropertyListHelper`,
 * `register_property` or `ADD_ARRAY_COUNT` exists.
 */
const KEYS: string[] = ['modification_stack'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('Skeleton2D strict validators', () => {
  it('registers exactly what Skeleton2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Skeleton2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // `fixtureLint` covers the whole registry through the barrel. This checks
    // the fixture against only what this test imports.
    expectFixtureClean('unit-skeleton-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format.
    const accepted = validatorRegistry
      .getOwnKeys('Skeleton2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('modification_stack', () => {
    it('accepts the SubResource form Godot writes for an in-scene stack', () => {
      // Godot saves an in-scene stack as a hash-suffixed SubResource id. A bare
      // Skeleton2D writes no key, so the fixture carries a stack.
      expect(check('modification_stack', 'SubResource("SkeletonModificationStack2D_mwfi1")')).toBeNull();
    });

    it('accepts an ExtResource form for a stack living in a .tres', () => {
      expect(check('modification_stack', 'ExtResource("1_stack")')).toBeNull();
    });

    it('rejects a value that is not a resource reference at all', () => {
      const error = check('modification_stack', '"res://stack.tres"');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
      expect(error!.message).toContain('modification_stack');
    });

    it('accepts the old-style integer index (resource_format_text.cpp:128)', () => {
      expect(check('modification_stack', 'SubResource(1)')).toBeNull();
    });

    it('rejects an id that is neither a string nor a number', () => {
      expect(check('modification_stack', 'SubResource(abc)')).not.toBeNull();
    });

    it('checks format only, because set_modification_stack assigns straight through', () => {
      // skeleton_2d.cpp:748-763 assigns `modification_stack = p_stack` with no
      // ERR_FAIL, clamp or null guard, so ADR-0032 leaves only the shape.
      const validator = validatorRegistry.declarationFor('Skeleton2D', 'modification_stack');
      expect(validator!.formatOnly).toBe(true);
      expect(validator!.grounding).toBeUndefined();
    });

    it('leaves the PROPERTY_HINT_RESOURCE_TYPE narrowing to a rule, not to itself', () => {
      // skeleton_2d.cpp:533-534 hints "SkeletonModificationStack2D", but a
      // reference names an id, not a type: resolving it needs the whole scene,
      // which a per-property validator never sees.
      expect(check('modification_stack', 'SubResource("SomeOtherResource_1")')).toBeNull();
    });
  });

  it('inherits its ancestors keys through the base-walk instead of re-declaring them', () => {
    // Skeleton2D < Node2D < CanvasItem < Node. A key redeclared here would
    // shadow the ancestor's validator and duplicate its rule.
    for (const inherited of ['position', 'scale', 'visible', 'z_index']) {
      expect(validatorRegistry.findValidator('Skeleton2D', inherited)).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('Skeleton2D')).not.toContain(inherited);
    }
  });
});
