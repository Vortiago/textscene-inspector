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
import { everyValidatorLabel, registeredTypes } from './registryPopulation.js';
import './index.js'; // side-effect: every slice registers its validators

describe('validator `accepts` metadata', () => {
  const types = registeredTypes('declaring');

  it('has validators to check, so an empty registry cannot pass this', () => {
    expect(types.length).toBeGreaterThan(60);
  });

  it('tags every registered validator with what it accepts', () => {
    // The deduped LEAF walk, not `getOwnKeys` crossed with `findValidator`:
    // that reaches roots only, so a validator behind a wildcard dispatcher
    // could ship untagged and render an empty Accepts cell with nothing
    // failing. Its own docblock names this shape as the bug it exists to stop.
    // The floor rides on THIS walk: the type count asserted above reads the
    // registration map directly, so it stays green while the walk that matters
    // reaches nothing and reports every validator tagged.
    const untagged = everyValidatorLabel((validator) => !validator.accepts, { atLeast: 2000 });

    expect(untagged).toEqual([]);
  });

  it('sweeps past the roots, so a leaf cannot hide from the tag check', () => {
    const all = everyValidatorLabel(() => true);
    const roots = types.flatMap((type) => validatorRegistry.getOwnKeys(type));
    expect(all.length).toBeGreaterThan(roots.length);
  });

  it('describes a bounded number with its bounds rather than just its type', () => {
    // The whole point of the column: `float 0-1` beats `float`.
    const transparency = validatorRegistry.declarationFor('GeometryInstance3D', 'transparency');
    expect(transparency?.accepts).toBe('float 0-1');
  });

  it('names the values of an enum, not just its range', () => {
    const castShadow = validatorRegistry.declarationFor('GeometryInstance3D', 'cast_shadow');
    expect(castShadow?.accepts).toBe('enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)');
  });

  it('describes a tuple type with its real arity', () => {
    // `v.aabb` said "AABB(12 floats)" — copy-pasted from transform3d — while the
    // factory behind it demands 6. The Accepts column is the only place a
    // reader learns the shape, so a wrong one is worse than none.
    const aabb = validatorRegistry.declarationFor('GeometryInstance3D', 'custom_aabb');
    expect(aabb?.accepts).toBe('AABB(x, y, z, w, h, d)');
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1)', 1)).toBeNull();
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3)', 1)).not.toBeNull();
  });

  it('names BOTH ends, taking the tighter tier at each side', () => {
    // Built per end. Returning on the hint's ends the moment either existed
    // dropped the other end entirely: a setter ceiling beside a hinted floor
    // advertised an unbounded `integer >= 0` on four published rows.
    const find = (type: string, key: string) =>
      validatorRegistry.declarationFor(type, key)?.accepts;
    expect(find('LightmapGI', 'bounces')).toBe('integer 0-16');
    expect(find('ReflectionProbe', 'max_distance')).toBe('float 0-262144');
    expect(find('RigidBody2D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
    expect(find('RigidBody3D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
  });

  it('lets an exclusive setter end win a tie against a coinciding hint end', () => {
    // Both ends sit at 0; only the setter's excludes it, and the column is the
    // domain that reports NOTHING — so advertising an inclusive 0 named a value
    // the setter refuses.
    const aspect = validatorRegistry.declarationFor(
      'OpenXRCompositionLayerCylinder',
      'aspect_ratio'
    );
    expect(aspect?.accepts).toBe('float > 0, <= 100');
  });

  it('keeps the compact spelling when nothing but the hint states an end', () => {
    // The same builder feeds the `accepts` text on ~45 call sites, so the
    // shortcut is what keeps `integer 1-10` the sheet's spelling.
    expect(validatorRegistry.declarationFor('GeometryInstance3D', 'transparency')?.accepts).toBe(
      'float 0-1'
    );
  });

  it('describes a layer mask as a mask, not as a 4-billion integer range', () => {
    const layers = validatorRegistry.declarationFor('VisualInstance3D', 'layers');
    expect(layers?.accepts).toBe('32-bit layer mask (layers 1-32)');
  });
});
