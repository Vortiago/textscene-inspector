/**
 * The PhysicsBody3D set must reach all six 3D bodies. Asserted through
 * `findValidator` on the leaves and through a whole-scene lint, because a tier
 * that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from '../../../../linter/Linter.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import './linterParser.js';

/** The six BOOL keys physics_body_3d.cpp:46-51 bind on PhysicsBody3D. */
const KEYS = [
  'axis_lock_linear_x',
  'axis_lock_linear_y',
  'axis_lock_linear_z',
  'axis_lock_angular_x',
  'axis_lock_angular_y',
  'axis_lock_angular_z',
] as const;

const LEAVES = [
  'AnimatableBody3D',
  'CharacterBody3D',
  'PhysicalBone3D',
  'RigidBody3D',
  'StaticBody3D',
  'VehicleBody3D',
] as const;

describe('PhysicsBody3D shared validators', () => {
  it('registers exactly what PhysicsBody3D binds', () => {
    expect(validatorRegistry.getOwnKeys('PhysicsBody3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('keeps CollisionObject3D reachable from here', () => {
    expect(validatorRegistry.findValidator('RigidBody3D', 'collision_layer')).not.toBeNull();
  });

  it.each(KEYS)('%s takes only a bool literal', (key) => {
    // set_axis_lock:189-196 sets or clears one bit of `locked_axis` and
    // refuses nothing, so the only thing to check is the literal's shape.
    const validator = validatorRegistry.findValidator('RigidBody3D', key)!;
    expect(validator(key, 'true', 1)).toBeNull();
    expect(validator(key, 'false', 1)).toBeNull();
    expect(validator(key, '"banana"', 1)?.severity).toBe('error');
  });

  it('a whole-scene lint reports a malformed axis lock', () => {
    const diagnostics = new Linter().lint(`[gd_scene format=3]

[node name="Body" type="RigidBody3D"]
axis_lock_linear_x = "banana"
`);
    const errors = diagnostics.filter((d) => d.severity === 'error').map((d) => d.message);
    expect(errors.some((m) => m.includes('axis_lock_linear_x'))).toBe(true);
  });

  it('stays out of the 2D bodies, which bind no axis lock', () => {
    expect(validatorRegistry.findValidator('RigidBody2D', 'axis_lock_linear_x')).toBeNull();
  });
});
