/**
 * OpenXRCompositionLayerEquirect strict validators, asserted through `validatorRegistry`, not by
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
  const validator = validatorRegistry.declarationFor('OpenXRCompositionLayerEquirect', property);
  expect(validator, `no validator registered for OpenXRCompositionLayerEquirect.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys OpenXRCompositionLayerEquirect binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = [
  'radius',
  'central_horizontal_angle',
  'upper_vertical_angle',
  'lower_vertical_angle',
  'fallback_segments',
];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys OpenXRCompositionLayerEquirect does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['OpenXRCompositionLayer', 'enable_hole_punch'],
  ['OpenXRCompositionLayer', 'sort_order'],
];

describe('OpenXRCompositionLayerEquirect strict validators', () => {
  it('registers exactly what OpenXRCompositionLayerEquirect binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerEquirect').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-composition-layer-equirect.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRCompositionLayerEquirect')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OpenXRCompositionLayerEquirect inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // OpenXRCompositionLayerEquirect would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OpenXRCompositionLayerEquirect', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRCompositionLayerEquirect')).not.toContain(key);
    }
  });

  describe('radius', () => {
    // openxr_composition_layer_equirect.cpp:139, ERR_FAIL_COND(p_radius <= 0).
    it('accepts a positive value', () => {
      expect(check('radius', '3')).toBeNull();
    });
    it('errors at 0 and below', () => {
      expect(check('radius', '0')?.severity).toBe('error');
      expect(check('radius', '-3')?.severity).toBe('error');
    });
  });

  describe('central_horizontal_angle', () => {
    // openxr_composition_layer_equirect.cpp:152, ERR_FAIL_COND(p_angle <= 0). The hint (:77) opens both
    // ends with or_less/or_greater, so nothing warns.
    it('accepts any positive radian value, however large', () => {
      expect(check('central_horizontal_angle', '0.01')).toBeNull();
      expect(check('central_horizontal_angle', '1000')).toBeNull();
    });
    it('errors at 0 and below', () => {
      expect(check('central_horizontal_angle', '0')?.severity).toBe('error');
    });
  });

  describe('upper_vertical_angle / lower_vertical_angle', () => {
    // openxr_composition_layer_equirect.cpp:165 / :178, ERR_FAIL_COND(p_angle <= 0 || p_angle > (Math::PI
    // / 2.0)): a real closed range in radians, where the hint (:78-79) opens
    // both ends with or_less,or_greater and so grounds neither.
    it('accepts values up to PI/2', () => {
      expect(check('upper_vertical_angle', '1')).toBeNull();
      expect(check('upper_vertical_angle', String(Math.PI / 2))).toBeNull();
      expect(check('lower_vertical_angle', '1')).toBeNull();
    });
    it('errors at 0 and below', () => {
      expect(check('upper_vertical_angle', '0')?.severity).toBe('error');
      expect(check('lower_vertical_angle', '-1')?.severity).toBe('error');
    });
    it('errors past PI/2', () => {
      expect(check('upper_vertical_angle', '2')?.severity).toBe('error');
      expect(check('lower_vertical_angle', '3.2')?.severity).toBe('error');
    });
    it('errors just past PI/2 — the ceiling is the predicate\'s literal, with no epsilon widening it', () => {
      expect(check('upper_vertical_angle', '1.5709')?.severity).toBe('error');
      expect(check('lower_vertical_angle', '1.5709')?.severity).toBe('error');
    });
    it('names the setter as the reason at each end', () => {
      expect(check('upper_vertical_angle', '2')?.message).toContain('Godot does not store this value');
      expect(check('upper_vertical_angle', '0')?.message).toContain('greater than 0');
    });
    it.each(['upper_vertical_angle', 'lower_vertical_angle'])(
      'holds %s entirely in the enforced slots, leaving both open hint ends of `bounds` open',
      (property) => {
        const validator = validatorRegistry.declarationFor(
          'OpenXRCompositionLayerEquirect',
          property
        );
        expect(validator?.bounds).toEqual({
          enforcedMin: { at: 0, exclusive: true },
          enforcedMax: { at: Math.PI / 2 },
        });
      }
    );
  });

  describe('fallback_segments', () => {
    // openxr_composition_layer_equirect.cpp:191, ERR_FAIL_COND(p_fallback_segments == 0).
    it('accepts a positive count', () => {
      expect(check('fallback_segments', '12')).toBeNull();
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
