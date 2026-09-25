/**
 * MultiplayerSynchronizer strict validators: format and range checks, asserted through `validatorRegistry` rather
 * than by linting a `.tscn`, so a failure points at the validator. Rule-level behaviour belongs in
 * linter.test.ts. Each numeric bound quotes the governing Godot source line beside it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MultiplayerSynchronizer', property);
  expect(validator, `no validator registered for MultiplayerSynchronizer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * MultiplayerSynchronizer binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset fails on purpose. Do not delete an assertion to pass.
 */
const KEYS: string[] = [
  'root_path',
  'replication_interval',
  'delta_interval',
  'replication_config',
  'visibility_update_mode',
  'public_visibility',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MultiplayerSynchronizer does not declare, each paired with the ancestor that does. The malformed-value
 * sweep iterates `getOwnKeys`, so on a class that declares nothing it passes vacuously. Resolving a
 * key through the base walk to the ancestor's own validator tells "declares nothing" from "not written".
 */
const INHERITED: [owner: string, key: string][] = [['Node', 'process_mode']];

describe('MultiplayerSynchronizer strict validators', () => {
  it('registers exactly what MultiplayerSynchronizer binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MultiplayerSynchronizer').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run rather than
    // reasoned. `fixtureLint` owns the whole-registry version through the
    // barrel. This checks the same file against whatever this test imported.
    expectFixtureClean('unit-multiplayer-synchronizer.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose. It is vacuous when MultiplayerSynchronizer declares
    // nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('MultiplayerSynchronizer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key MultiplayerSynchronizer inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // MultiplayerSynchronizer would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('MultiplayerSynchronizer', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('MultiplayerSynchronizer')).not.toContain(key);
    }
  });

  it('accepts a NodePath literal for root_path and rejects a bare string', () => {
    expect(check('root_path', 'NodePath("..")')).toBeNull();
    expect(check('root_path', 'NodePath("SyncTarget")')).toBeNull();
    expect(check('root_path', 'SyncTarget')).not.toBeNull();
  });

  it('errors a negative replication_interval (enforced floor), warns above the 5s hint ceiling', () => {
    expect(check('replication_interval', '0')).toBeNull();
    expect(check('replication_interval', '5')).toBeNull();
    expect(check('replication_interval', '-0.1')?.severity).toBe('error');
    expect(check('replication_interval', '5.1')?.severity).toBe('warning');
  });

  it('errors a negative delta_interval (enforced floor), warns above the 5s hint ceiling', () => {
    expect(check('delta_interval', '0')).toBeNull();
    expect(check('delta_interval', '5')).toBeNull();
    expect(check('delta_interval', '-0.1')?.severity).toBe('error');
    expect(check('delta_interval', '5.1')?.severity).toBe('warning');
  });

  it('accepts a resource reference for replication_config', () => {
    expect(check('replication_config', 'SubResource("SceneReplicationConfig_1")')).toBeNull();
    expect(check('replication_config', 'ExtResource("1")')).toBeNull();
  });

  it('warns visibility_update_mode outside its 0-2 enum (hinted, bare-assign setter)', () => {
    expect(check('visibility_update_mode', '0')).toBeNull();
    expect(check('visibility_update_mode', '2')).toBeNull();
    expect(check('visibility_update_mode', '3')?.severity).toBe('warning');
  });

  it('accepts boolean literals for public_visibility and rejects anything else', () => {
    expect(check('public_visibility', 'true')).toBeNull();
    expect(check('public_visibility', 'false')).toBeNull();
    expect(check('public_visibility', 'yes')).not.toBeNull();
  });
});
