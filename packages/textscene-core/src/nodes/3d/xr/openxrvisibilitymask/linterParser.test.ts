/**
 * OpenXRVisibilityMask strict validators — format and range checks.
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
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
// The fixture's parent placement (linter.ts, valid-openxrvisibilitymask-parent)
// requires an XRCamera3D sibling in the same file. `expectFixtureClean` only
// sees registrations THIS test imported, so without these two the XRCamera3D
// heading would go unchecked rather than proven clean.
import '../../camera3d/linterParser';
import '../../camera3d/linter';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('OpenXRVisibilityMask', property);
  expect(validator, `no validator registered for OpenXRVisibilityMask.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * OpenXRVisibilityMask binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: OpenXRVisibilityMask binds nothing. `openxr_visibility_mask.h:35-53` is
 * the entire class body — GDCLASS, `_bind_methods`/`_notification` overrides, two
 * session-signal handlers, `get_configuration_warnings`, `get_aabb`, ctor/dtor —
 * and `openxr_visibility_mask.cpp:37-38` shows `_bind_methods` is an empty body,
 * so there is no `ADD_PROPERTY` and no `ADD_ARRAY_COUNT`. No `_get_property_list`
 * and no unprefixed `get_property_list` either, so no hand-rolled leaf family.
 * `doc/classes/OpenXRVisibilityMask.xml` carries no `<members>` block, which is
 * the doc side of the same fact.
 */
const DECLARES_NOTHING = true;

/**
 * Keys OpenXRVisibilityMask does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisualInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives OpenXRVisibilityMask no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // visual_instance_3d.cpp:182, one hop up.
  ['VisualInstance3D', 'layers'],
];

describe('OpenXRVisibilityMask strict validators', () => {
  it('registers exactly what OpenXRVisibilityMask binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRVisibilityMask').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-open-xr-visibility-mask.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // OpenXRVisibilityMask declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRVisibilityMask')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OpenXRVisibilityMask inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // OpenXRVisibilityMask would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OpenXRVisibilityMask', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OpenXRVisibilityMask')).not.toContain(key);
    }
  });

  it('still fires through the walk on a layers mask no 32-bit slot holds', () => {
    // The inherited resolution has to reach the validator at all; `-1` is a
    // legal mask, `4294967296` drops a bit the file states.
    expect(check('layers', '4294967296')).not.toBeNull();
    expect(check('layers', '-1')).toBeNull();
  });

  it('accepts an in-range layers mask through the walk', () => {
    expect(check('layers', '3')).toBeNull();
  });

  it('invents no validator for a key nothing in the chain declares', () => {
    // The base-walk widens what a type accepts, so the failure mode worth
    // guarding is it answering for a key no ancestor ever bound.
    expect(validatorRegistry.findValidator('OpenXRVisibilityMask', 'not_a_real_property')).toBeNull();
  });
});
