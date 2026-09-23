/**
 * ShaderGlobalsOverride strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. Each numeric bound quotes its
 * Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ShaderGlobalsOverride', property);
  expect(validator, `no validator registered for ShaderGlobalsOverride.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys ShaderGlobalsOverride binds, read from the source. Exactly one of this and
 * DECLARES_NOTHING is set: both unset is red by design.
 */
const KEYS: string[] = [
  // Not an ADD_PROPERTY: shader_globals_override.cpp has none. The whole
  // family comes from `_get_property_list` (:94), which enumerates the
  // project's global shader parameters at `params/<name>`.
  'params/*',
];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ShaderGlobalsOverride does not declare, each paired with the ancestor that does. The
 * malformed-value loop below iterates `getOwnKeys`, so on a class that declares
 * nothing it asserts nothing. Resolving a key through the base-walk to the
 * ancestor's own validator tells "no own properties" from "slice not written".
 */
const INHERITED: [owner: string, key: string][] = [
  // node.cpp: an enum format-only validator. ShaderGlobalsOverride declares no
  // Node-level key of its own.
  ['Node', 'process_mode'],
];

describe('ShaderGlobalsOverride strict validators', () => {
  it('registers exactly what ShaderGlobalsOverride binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ShaderGlobalsOverride').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what
    // this test imported. `fixtureLint` checks the whole registry through the barrel.
    expectFixtureClean('unit-shader-globals-override.tscn');
  });

  it('rejects a malformed value on every property it validates, except the honestly-permissive params/* family', () => {
    // A validator that accepts arbitrary prose validates no format, except
    // `params/*`: no format is checkable from the .tscn alone (linterParser.ts).
    // A test below asserts that one exemption.
    const accepted = validatorRegistry
      .getOwnKeys('ShaderGlobalsOverride')
      .filter((property) => property !== 'params/*')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key ShaderGlobalsOverride inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // ShaderGlobalsOverride would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('ShaderGlobalsOverride', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('ShaderGlobalsOverride')).not.toContain(key);
    }
  });

  describe('params/*', () => {
    it('accepts a bool literal', () => {
      expect(check('params/fog_enabled', 'true')).toBeNull();
    });
    it('accepts a Color literal', () => {
      expect(check('params/tint', 'Color(1, 0, 0, 1)')).toBeNull();
    });
    it('accepts a resource reference (a sampler-typed global)', () => {
      expect(check('params/albedo_tex', 'ExtResource("1_tex")')).toBeNull();
    });
    it('accepts prose Godot cannot type without project.godot either', () => {
      // Not a claim that Godot accepts arbitrary text for every global: it is
      // the claim the .tscn alone supports.
      expect(check('params/anything', 'definitely-not-a-valid-value')).toBeNull();
    });
  });
});
