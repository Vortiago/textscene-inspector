/**
 * OpenXRCompositionLayerQuad strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('OpenXRCompositionLayerQuad', property);
  expect(validator, `no validator registered for OpenXRCompositionLayerQuad.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys OpenXRCompositionLayerQuad binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = ['quad_size'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys OpenXRCompositionLayerQuad does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['OpenXRCompositionLayer', 'enable_hole_punch'],
  ['OpenXRCompositionLayer', 'sort_order'],
];

describe('OpenXRCompositionLayerQuad strict validators', () => {
  it('registers exactly what OpenXRCompositionLayerQuad binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerQuad').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-composition-layer-quad.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRCompositionLayerQuad')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OpenXRCompositionLayerQuad inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // OpenXRCompositionLayerQuad would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OpenXRCompositionLayerQuad', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerQuad')).not.toContain(key);
    }
  });

  describe('quad_size', () => {
    it('accepts any Vector2 (format-only, no bound)', () => {
      expect(check('quad_size', 'Vector2(2, 1)')).toBeNull();
      expect(check('quad_size', 'Vector2(0, 0)')).toBeNull();
      expect(check('quad_size', 'Vector2(-5, 100)')).toBeNull();
    });

    it('rejects a non-Vector2 literal', () => {
      expect(check('quad_size', '5')).not.toBeNull();
    });
  });
});
