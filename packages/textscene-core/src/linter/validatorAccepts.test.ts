/**
 * Every registered validator must say what it accepts. Each comparison sheet's
 * generated `## Linting` table reads `PropertyValidator.accepts`, and a missing
 * tag renders an empty cell. Use `v.*`, which sets it at construction, or set
 * `accepts` yourself as `layerBitmask` does.
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
    // The deduped leaf walk, not `getOwnKeys` crossed with `findValidator`,
    // which reaches roots only and misses a validator behind a wildcard.
    // The floor rides on this walk: the type count above reads the
    // registration map, so it stays green while this walk reaches nothing.
    const untagged = everyValidatorLabel((validator) => !validator.accepts, { atLeast: 2000 });

    expect(untagged).toEqual([]);
  });

  it('sweeps past the roots, so a leaf cannot hide from the tag check', () => {
    const all = everyValidatorLabel(() => true);
    const roots = types.flatMap((type) => validatorRegistry.getOwnKeys(type));
    expect(all.length).toBeGreaterThan(roots.length);
  });

  it('describes a bounded number with its bounds rather than just its type', () => {
    const transparency = validatorRegistry.declarationFor('GeometryInstance3D', 'transparency');
    expect(transparency?.accepts).toBe('float 0-1');
  });

  it('names the values of an enum, not just its range', () => {
    const castShadow = validatorRegistry.declarationFor('GeometryInstance3D', 'cast_shadow');
    expect(castShadow?.accepts).toBe('enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)');
  });

  it('describes a tuple type with its real arity', () => {
    // The Accepts column is the only place a reader learns the shape, and the
    // factory behind `v.aabb` demands 6 components.
    const aabb = validatorRegistry.declarationFor('GeometryInstance3D', 'custom_aabb');
    expect(aabb?.accepts).toBe('AABB(x, y, z, w, h, d)');
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1)', 1)).toBeNull();
    expect(aabb!('custom_aabb', 'AABB(0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3)', 1)).not.toBeNull();
  });

  it('names BOTH ends, taking the tighter tier at each side', () => {
    // Built per end, so a setter ceiling beside a hinted floor still shows.
    const find = (type: string, key: string) =>
      validatorRegistry.declarationFor(type, key)?.accepts;
    expect(find('LightmapGI', 'bounces')).toBe('integer 0-16');
    expect(find('ReflectionProbe', 'max_distance')).toBe('float 0-262144');
    expect(find('RigidBody2D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
    expect(find('RigidBody3D', 'max_contacts_reported')).toBe('integer >= 0, < 4096');
  });

  it('lets an exclusive setter end win a tie against a coinciding hint end', () => {
    // Both ends sit at 0, and only the setter's excludes it. The column is the
    // domain that reports nothing, so it must not show a refused 0.
    const aspect = validatorRegistry.declarationFor(
      'OpenXRCompositionLayerCylinder',
      'aspect_ratio'
    );
    expect(aspect?.accepts).toBe('float > 0, <= 100');
  });

  it('keeps the compact spelling when nothing but the hint states an end', () => {
    // The same builder feeds many `accepts` texts, so the shortcut keeps
    // `integer 1-10` the sheet's spelling.
    expect(validatorRegistry.declarationFor('GeometryInstance3D', 'transparency')?.accepts).toBe(
      'float 0-1'
    );
  });

  it('describes a layer mask as a mask, not as a 4-billion integer range', () => {
    const layers = validatorRegistry.declarationFor('VisualInstance3D', 'layers');
    expect(layers?.accepts).toBe('32-bit layer mask (layers 1-32)');
  });
});
