/**
 * LightmapProbe strict validators, which are none. The tests assert that nothing
 * is declared here and that the inherited surface still reaches this type, which
 * an empty registration could break.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../linter/testing/validatorCheck';
import './linterParser';

/** `LightmapProbe.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('LightmapProbe');

/**
 * Set exactly one, from the source: the keys LightmapProbe binds, or
 * DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose.
 */
const KEYS: string[] = [];
/**
 * True: the class body (`lightmap_probe.h:35-39`) has no `_bind_methods`, which
 * `initialize_class` (`object.h:526`) needs to add a property, and
 * `lightmap_probe.cpp:33-34` is an empty constructor with no `_set`/`_get`/property
 * list. `LightmapProbe.xml` has no `<members>` block.
 */
const DECLARES_NOTHING = true;

/**
 * Keys LightmapProbe does not declare, each with the ancestor that does: a
 * transform, a boolean and an enum-hinted int of Node3D. The malformed-value
 * loop passes vacuously on an empty class, and this does not.
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
    // `fixtureLint` checks the whole registry but needs the barrel. This checks
    // the same file against what this test imported, which with no own keys is
    // the inherited validators that `linterParser` imports.
    expectFixtureClean('unit-lightmap-probe.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose checks no format. With no own
    // keys this is vacuous until one is added by mistake. INHERITED covers the
    // keys LightmapProbe carries.
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
      // The same function, not merely some validator: a shadowing copy would
      // answer here while its rule differs from the ancestor's.
      expect(validatorRegistry.findValidator('LightmapProbe', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('LightmapProbe')).not.toContain(key);
    }
  });
});
