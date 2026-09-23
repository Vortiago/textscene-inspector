/**
 * WorldEnvironment strict validators for the three resource references `_bind_methods` declares,
 * asserted through `validatorRegistry` so a failure points at the validator. `linter.test.ts`
 * covers the existence and uniqueness rules built on `environment` and `camera_attributes`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('WorldEnvironment', property);
  expect(validator, `no validator registered for WorldEnvironment.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * WorldEnvironment (world_environment.cpp:221) and Camera3D (camera_3d.cpp:676) declare `compositor`
 * with the same `ADD_PROPERTY`. Both setters (world_environment.cpp:159-178, camera_3d.cpp:572-580)
 * are bare assignments once the reference is valid, so only the reference format is checkable.
 */
describe('WorldEnvironment compositor', () => {
  it('accepts a SubResource reference', () => {
    expect(check('compositor', 'SubResource("Compositor_1")')).toBeNull();
  });

  it('accepts an ExtResource reference', () => {
    expect(check('compositor', 'ExtResource("1_comp")')).toBeNull();
  });

  it('accepts the padded form the parser also reads', () => {
    expect(check('compositor', 'SubResource ( "Compositor_1" )')).toBeNull();
  });

  it('accepts the literal null, a cleared slot Godot loads', () => {
    // Godot omits a cleared slot, not writes `null`, but that is the
    // write side. variant_parser.cpp:699 reads a bare `null`, can_convert_strict
    // allows NIL -> OBJECT (variant.cpp:543), and the Ref setter takes it, so the
    // value loads and reporting it would be a false positive.
    expect(check('compositor', 'null')).toBeNull();
  });

  it('rejects a bare resource path string', () => {
    expect(check('compositor', '"res://compositor.tres"')).not.toBeNull();
  });
});

/**
 * Every key WorldEnvironment binds through `ADD_PROPERTY`
 * (world_environment.cpp:213-221), matching doc/classes/WorldEnvironment.xml's
 * three members, none carrying `overrides=`.
 */
const KEYS: string[] = ['environment', 'camera_attributes', 'compositor'];

describe('WorldEnvironment strict validators', () => {
  it('registers exactly what WorldEnvironment binds', () => {
    expect(validatorRegistry.getOwnKeys('WorldEnvironment').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-world-environment-basic.tscn');
  });

  it('rejects a malformed value on every property', () => {
    const accepted = KEYS.filter((property) => check(property, 'not-a-reference') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches a Node key (process_mode) through the base-walk', () => {
    expect(validatorRegistry.findValidator('WorldEnvironment', 'process_mode')).not.toBeNull();
  });
});
