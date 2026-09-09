/**
 * XRAnchor3D strict validators — format and range checks.
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
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** `XRAnchor3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('XRAnchor3D');

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * XRAnchor3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: XRAnchor3D binds nothing beyond XRNode3D. `xr_nodes.h:163-175` is the
 * entire class body — GDCLASS, `_bind_methods`, `get_size`/`get_plane` — and
 * `xr_nodes.cpp:660-663`'s `_bind_methods` only binds those two getters, no
 * `ADD_PROPERTY` and no `ADD_ARRAY_COUNT`. No `_get_property_list` (or the
 * unprefixed spelling) either, so no hand-rolled leaf family.
 * `doc/classes/XRAnchor3D.xml` carries no `<members>` block, the doc side of
 * the same fact.
 */
const DECLARES_NOTHING = true;

/**
 * Keys XRAnchor3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; XRNode3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives XRAnchor3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['XRNode3D', 'tracker']];

describe('XRAnchor3D strict validators', () => {
  it('registers exactly what XRAnchor3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XRAnchor3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    //
    // With no own keys that is the INHERITED validators only — `linterParser`
    // imports the parent chain — so it covers what XRNode3D up declares and
    // becomes this slice's own claim the moment KEYS gains an entry.
    expectFixtureClean('unit-xr-anchor-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // XRAnchor3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('XRAnchor3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key XRAnchor3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // XRAnchor3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('XRAnchor3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('XRAnchor3D')).not.toContain(key);
    }
  });
});
