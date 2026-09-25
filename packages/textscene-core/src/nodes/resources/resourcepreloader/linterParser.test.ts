/**
 * ResourcePreloader strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. Each numeric bound quotes its
 * Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ResourcePreloader', property);
  expect(validator, `no validator registered for ResourcePreloader.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys ResourcePreloader binds, read from the source. Exactly one of this and
 * DECLARES_NOTHING is set: both unset is red by design.
 */
const KEYS: string[] = [
  // resource_preloader.cpp:147: the one ADD_PROPERTY, PROPERTY_USAGE_NO_EDITOR
  // | PROPERTY_USAGE_INTERNAL, which is PROPERTY_USAGE_STORAGE | INTERNAL
  // (object.h:132), so it serialises though the editor hides it.
  'resources',
];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ResourcePreloader does not declare, each paired with the ancestor that does. The
 * malformed-value loop below iterates `getOwnKeys`, so on a class that declares
 * nothing it asserts nothing. Resolving a key through the base-walk to the
 * ancestor's own validator tells "no own properties" from "slice not written".
 */
const INHERITED: [owner: string, key: string][] = [
  // node.cpp: an enum format-only validator. ResourcePreloader declares no
  // Node-level key of its own.
  ['Node', 'process_mode'],
];

describe('ResourcePreloader strict validators', () => {
  it('registers exactly what ResourcePreloader binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ResourcePreloader').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what
    // this test imported. `fixtureLint` checks the whole registry through the barrel.
    expectFixtureClean('unit-resource-preloader.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. The
    // per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('ResourcePreloader')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key ResourcePreloader inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // ResourcePreloader would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('ResourcePreloader', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('ResourcePreloader')).not.toContain(key);
    }
  });

  describe('resources', () => {
    it('accepts an empty preloader', () => {
      expect(check('resources', '[PackedStringArray(), []]')).toBeNull();
    });

    it('accepts one SubResource entry', () => {
      expect(
        check('resources', '[PackedStringArray("a"), [SubResource("Resource_1")]]')
      ).toBeNull();
    });

    it('accepts multiple entries mixing SubResource and ExtResource', () => {
      expect(
        check(
          'resources',
          '[PackedStringArray("a", "b"), [SubResource("Resource_1"), ExtResource("1_tex")]]'
        )
      ).toBeNull();
    });

    it('rejects a value with no top-level array wrapper', () => {
      expect(check('resources', 'PackedStringArray("a")')).not.toBeNull();
    });

    it('rejects a top-level array with only one element', () => {
      const result = check('resources', '[PackedStringArray("a")]');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_SHAPE');
    });

    it('rejects a top-level array with three elements — resource_preloader.cpp:36 drops the whole write', () => {
      const result = check(
        'resources',
        '[PackedStringArray("a"), [SubResource("Resource_1")], 3]'
      );
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_SHAPE');
    });

    it('rejects mismatched name/resource counts — resource_preloader.cpp:40 drops the whole write', () => {
      const result = check(
        'resources',
        '[PackedStringArray("a", "b"), [SubResource("Resource_1")]]'
      );
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_COUNT_MISMATCH');
    });

    it('rejects a null resource entry — resource_preloader.cpp:44 drops that pair', () => {
      const result = check('resources', '[PackedStringArray("a"), [null]]');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_ENTRY');
    });

    it('rejects a non-resource resource entry', () => {
      const result = check('resources', '[PackedStringArray("a"), [5]]');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_ENTRY');
    });

    it('rejects an unquoted name', () => {
      const result = check(
        'resources',
        '[PackedStringArray(a), [SubResource("Resource_1")]]'
      );
      expect(result).not.toBeNull();
      expect(result?.code).toBe('INVALID_RESOURCES_FORMAT');
    });

    it('accepts a bare Array of strings for element 0 — Variant::operator PackedStringArray() converts it too', () => {
      expect(
        check('resources', '[["a"], [SubResource("Resource_1")]]')
      ).toBeNull();
    });

    it('rejects a first element that is neither PackedStringArray nor an Array', () => {
      const result = check('resources', '[5, [SubResource("Resource_1")]]');
      expect(result).not.toBeNull();
    });

    it('reports errors, never warnings — every branch is a Godot setter drop', () => {
      const result = check('resources', '[PackedStringArray("a", "b"), [SubResource("Resource_1")]]');
      expect(result?.severity).toBe('error');
    });
  });
});
