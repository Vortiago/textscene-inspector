/**
 * Every registered validator must say what it accepts.
 *
 * The generated `## Linting` table in each comparison sheet lists a property
 * and, beside it, the values that pass — `float 0-1`, `enum 0-3 (OFF/ON/…)`,
 * `Vector3(x, y, z)`. That column is read from `PropertyValidator.accepts`,
 * which the `v` DSL sets at construction time because that is the only place
 * the bounds are known; a validator is an opaque closure everywhere else.
 *
 * A hand-rolled validator that skips the tag does not fail anything — it just
 * renders an empty cell, and a sheet quietly stops telling the reader what the
 * property takes. This is the assertion that makes that a build failure
 * instead. Use `v.*`, or set `accepts` yourself as `layerBitmask` does.
 */

import { describe, it, expect } from 'vitest';
import { validatorRegistry } from './ValidatorRegistry.js';
import './index.js'; // side-effect: every slice registers its validators

describe('validator `accepts` metadata', () => {
  const types = validatorRegistry.getRegisteredNodeTypes();

  it('has validators to check, so an empty registry cannot pass this', () => {
    expect(types.length).toBeGreaterThan(60);
  });

  it('tags every registered validator with what it accepts', () => {
    const untagged = types.flatMap((type) =>
      validatorRegistry
        .getOwnKeys(type)
        .filter((key) => !validatorRegistry.findValidator(type, key)?.accepts)
        .map((key) => `${type}.${key}`)
    );

    expect(untagged).toEqual([]);
  });

  it('describes a bounded number with its bounds rather than just its type', () => {
    // The whole point of the column: `float 0-1` beats `float`.
    const transparency = validatorRegistry.findValidator('GeometryInstance3D', 'transparency');
    expect(transparency?.accepts).toBe('float 0-1');
  });

  it('names the values of an enum, not just its range', () => {
    const castShadow = validatorRegistry.findValidator('GeometryInstance3D', 'cast_shadow');
    expect(castShadow?.accepts).toBe('enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)');
  });

  it('describes a tuple type with its real arity', () => {
    // `v.aabb` said "AABB(12 floats)" — copy-pasted from transform3d — while the
    // factory behind it demands 6. The Accepts column is the only place a
    // reader learns the shape, so a wrong one is worse than none.
    const aabb = validatorRegistry.findValidator('GeometryInstance3D', 'custom_aabb');
    expect(aabb?.accepts).toBe('AABB(x, y, z, w, h, d)');
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1)', 1)).toBeNull();
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3)', 1)).not.toBeNull();
  });

  it('names BOTH ends, taking the tighter tier at each side', () => {
    // Built per end. Returning on the hint's ends the moment either existed
    // dropped the other end entirely: a setter ceiling beside a hinted floor
    // advertised an unbounded `integer >= 0` on four published rows.
    const find = (type: string, key: string) =>
      validatorRegistry.findValidator(type, key)?.accepts;
    expect(find('LightmapGI', 'bounces')).toBe('integer 0-16');
    expect(find('ReflectionProbe', 'max_distance')).toBe('float 0-262144');
    expect(find('RigidBody2D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
    expect(find('RigidBody3D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
  });

  it('lets an exclusive setter end win a tie against a coinciding hint end', () => {
    // Both ends sit at 0; only the setter's excludes it, and the column is the
    // domain that reports NOTHING — so advertising an inclusive 0 named a value
    // the setter refuses.
    const aspect = validatorRegistry.findValidator(
      'OpenXRCompositionLayerCylinder',
      'aspect_ratio'
    );
    expect(aspect?.accepts).toBe('float > 0, <= 100');
  });

  it('keeps the compact spelling when nothing but the hint states an end', () => {
    // The same builder feeds a user-visible message; the shortcut is what keeps
    // `must be integer 1-10 (got -5)` unchanged on ~45 call sites.
    expect(validatorRegistry.findValidator('GeometryInstance3D', 'transparency')?.accepts).toBe(
      'float 0-1'
    );
  });

  it('describes a layer mask as a mask, not as a 4-billion integer range', () => {
    const layers = validatorRegistry.findValidator('VisualInstance3D', 'layers');
    expect(layers?.accepts).toBe('32-bit layer mask (layers 1-32)');
  });
});
