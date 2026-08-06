/**
 * LightmapProbe strict validators, which are none.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it.
 *
 * LightmapProbe binds no property of its own, so the interesting claim is not
 * "this bound is right" but "nothing is declared here, AND the inherited
 * surface still reaches this type". The second half is what an empty
 * registration could plausibly break, so it gets the tests.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('LightmapProbe', property);
  expect(validator, `no validator registered for LightmapProbe.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * LightmapProbe binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: `lightmap_probe.h:35-39` is the entire class body — `GDCLASS`, a
 * `public:` label and one bare constructor declaration, no `_bind_methods`
 * override. `initialize_class` (`object.h:526`) only calls `_bind_methods()`
 * when a subclass's function pointer differs from its parent's, so LightmapProbe
 * never runs one and no `ADD_PROPERTY` or `ADD_ARRAY_COUNT` can exist.
 * `lightmap_probe.cpp:33-34` is that constructor's empty body alone: no
 * `_set`/`_get`/`_get_property_list`, and no unprefixed `get_property_list`
 * either (the shape `ChainIK3D` uses further up other chains). `LightmapProbe.xml`
 * carries no `<members>` block, which agrees.
 */
const DECLARES_NOTHING = true;

/**
 * Keys LightmapProbe does NOT declare, each paired with the ancestor that does.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives LightmapProbe no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart. All three are Node3D's own
 * (`nodes/base/node3d/linterParser.ts`), picked to cover a transform, a
 * boolean and an enum-hinted int.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node3D', 'transform'],
  ['Node3D', 'visible'],
  ['Node3D', 'rotation_order'],
];

describe('LightmapProbe strict validators', () => {
  it('registers exactly what LightmapProbe binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('LightmapProbe').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-lightmap-probe.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; with no own keys it is vacuous today and
    // becomes real the moment one is added by mistake. INHERITED below covers
    // the keys LightmapProbe actually carries.
    const accepted = validatorRegistry
      .getOwnKeys('LightmapProbe')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key LightmapProbe inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // LightmapProbe would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('LightmapProbe', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('LightmapProbe')).not.toContain(key);
    }
  });
});
