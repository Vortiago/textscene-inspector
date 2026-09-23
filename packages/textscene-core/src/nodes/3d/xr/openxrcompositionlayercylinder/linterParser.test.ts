/**
 * OpenXRCompositionLayerCylinder strict validators, asserted through `validatorRegistry`, not by
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
  const validator = validatorRegistry.findValidator('OpenXRCompositionLayerCylinder', property);
  expect(validator, `no validator registered for OpenXRCompositionLayerCylinder.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys OpenXRCompositionLayerCylinder binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = ['radius', 'aspect_ratio', 'central_angle', 'fallback_segments'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys OpenXRCompositionLayerCylinder does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['OpenXRCompositionLayer', 'enable_hole_punch'],
  ['OpenXRCompositionLayer', 'sort_order'],
];

describe('OpenXRCompositionLayerCylinder strict validators', () => {
  it('registers exactly what OpenXRCompositionLayerCylinder binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerCylinder').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-composition-layer-cylinder.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRCompositionLayerCylinder')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OpenXRCompositionLayerCylinder inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // OpenXRCompositionLayerCylinder would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OpenXRCompositionLayerCylinder', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerCylinder')).not.toContain(key);
    }
  });

  describe('radius', () => {
    // openxr_composition_layer_cylinder.cpp:131, ERR_FAIL_COND(p_radius <= 0).
    it('accepts a positive value', () => {
      expect(check('radius', '0.5')).toBeNull();
    });
    it('errors at exactly 0', () => {
      expect(check('radius', '0')?.severity).toBe('error');
    });
    it('errors below 0', () => {
      expect(check('radius', '-1')?.severity).toBe('error');
    });
  });

  describe('aspect_ratio', () => {
    // openxr_composition_layer_cylinder.cpp:144, ERR_FAIL_COND(p_aspect_ratio <= 0): enforced floor.
    // The hint's own floor (:73, "0,100") is 0 inclusive, so the setter is the
    // stricter of the two and refuses every value the hint would warn on: there
    // is no warned band under the floor.
    it('errors at 0', () => {
      expect(check('aspect_ratio', '0')?.severity).toBe('error');
      expect(check('aspect_ratio', '-1')?.severity).toBe('error');
    });

    it('accepts the smallest positive value the setter allows', () => {
      expect(check('aspect_ratio', '0.001')).toBeNull();
    });
    // openxr_composition_layer_cylinder.cpp:73 hints "0,100": hinted-only ceiling, since the setter
    // never caps it.
    it('accepts the hinted ceiling and warns past it', () => {
      expect(check('aspect_ratio', '100')).toBeNull();
      expect(check('aspect_ratio', '101')?.severity).toBe('warning');
    });
  });

  describe('central_angle', () => {
    // openxr_composition_layer_cylinder.cpp:157, ERR_FAIL_COND(p_central_angle <= 0). The hint
    // (:74) opens both ends with or_less/or_greater, so nothing warns.
    it('accepts any positive radian value, however large', () => {
      expect(check('central_angle', '0.01')).toBeNull();
      expect(check('central_angle', '1000')).toBeNull();
    });
    it('errors at 0 and below', () => {
      expect(check('central_angle', '0')?.severity).toBe('error');
      expect(check('central_angle', '-0.5')?.severity).toBe('error');
    });
  });

  describe('fallback_segments', () => {
    // openxr_composition_layer_cylinder.cpp:170, ERR_FAIL_COND(p_fallback_segments == 0).
    it('accepts a positive count', () => {
      expect(check('fallback_segments', '16')).toBeNull();
    });
    it('errors at exactly 0', () => {
      expect(check('fallback_segments', '0')?.severity).toBe('error');
    });
    it('does not report a floor of 1, which no engine line states', () => {
      // The parameter is uint32_t, so `-1` narrows to 4294967295 before the `== 0` guard runs:
      // stored, not refused. A `min: 1` would name a bound the engine does not have.
      expect(check('fallback_segments', '-1')?.message ?? '').not.toContain('>= 1');
    });

    it('accepts a count above INT32_MAX, which the unsigned slot holds', () => {
      expect(check('fallback_segments', '4000000000')).toBeNull();
    });
  });
});
