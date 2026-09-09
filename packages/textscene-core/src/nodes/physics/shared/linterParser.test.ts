/**
 * The CollisionObject set must reach every body and area in both dimensions,
 * which is the whole point of the tier.
 *
 * Before it existed these keys were copied into each leaf and had drifted:
 * `collision_layer`/`collision_mask` were declared four times per dimension,
 * and `disable_mode` had four different answers across seven types — bounded
 * 0-1 on CharacterBody2D/RigidBody3D/CharacterBody3D, which rejected Godot's
 * legal `KEEP_ACTIVE` as an ERROR; 0-2 on StaticBody3D and Area2D; and absent
 * on StaticBody2D and Area3D. The last case below is that regression.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import './linterParser.js';
import '../2d/staticbody2d/linterParser.js';
import '../2d/rigidbody2d/linterParser.js';
import '../2d/characterbody2d/linterParser.js';
import '../2d/area2d/linterParser.js';
import '../3d/staticbody3d/linterParser.js';
import '../3d/rigidbody3d/linterParser.js';
import '../3d/characterbody3d/linterParser.js';
import '../3d/area3d/linterParser.js';

/** Every member collision_object_2d.cpp binds; the 3D twin adds two. */
const COMMON = [
  'disable_mode',
  'collision_layer',
  'collision_mask',
  'collision_priority',
] as const;
const KEYS_2D = [...COMMON, 'input_pickable'] as const;
const KEYS_3D = [...COMMON, 'input_ray_pickable', 'input_capture_on_drag'] as const;

const LEAVES_2D = ['StaticBody2D', 'RigidBody2D', 'CharacterBody2D', 'Area2D'] as const;
const LEAVES_3D = ['StaticBody3D', 'RigidBody3D', 'CharacterBody3D', 'Area3D'] as const;

describe('CollisionObject shared validators', () => {
  it('registers exactly collision_object_2.cpp/3d.cpp own members', () => {
    expect(validatorRegistry.getOwnKeys('CollisionObject2D').sort()).toEqual([...KEYS_2D].sort());
    expect(validatorRegistry.getOwnKeys('CollisionObject3D').sort()).toEqual([...KEYS_3D].sort());
  });

  it.each(LEAVES_2D)('delivers every 2D key to %s through the base-walk', (nodeType) => {
    const missing = KEYS_2D.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it.each(LEAVES_3D)('delivers every 3D key to %s through the base-walk', (nodeType) => {
    const missing = KEYS_3D.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('keeps the 2D and 3D pickable spellings apart', () => {
    // Godot names the same idea differently per dimension; inheriting the wrong
    // one would silently accept a key that cannot appear in that dimension.
    expect(validatorRegistry.findValidator('StaticBody2D', 'input_ray_pickable')).toBeNull();
    expect(validatorRegistry.findValidator('StaticBody3D', 'input_pickable')).toBeNull();
    expect(validatorRegistry.findValidator('StaticBody2D', 'input_capture_on_drag')).toBeNull();
  });

  it.each([...LEAVES_2D, ...LEAVES_3D])('accepts KEEP_ACTIVE on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'disable_mode')!;
    for (const legal of ['0', '1', '2']) {
      expect(validator('disable_mode', legal, 1)).toBeNull();
    }
    expect(validator('disable_mode', '3', 1)).not.toBeNull();
  });

  it('leaves each leaf only the keys Godot gives it', () => {
    // The bodies keep their own physics surface; none re-declares an inherited
    // key, which the shadow guard in ValidatorRegistry.baseWalk.test.ts enforces.
    expect(validatorRegistry.getOwnKeys('StaticBody3D')).toContain('physics_material_override');
    expect(validatorRegistry.getOwnKeys('Area2D')).toContain('monitoring');
    for (const key of KEYS_3D) {
      expect(validatorRegistry.getOwnKeys('StaticBody3D')).not.toContain(key);
    }
  });
});
