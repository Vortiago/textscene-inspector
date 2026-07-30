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

  it('describes a layer mask as a mask, not as a 4-billion integer range', () => {
    const layers = validatorRegistry.findValidator('VisualInstance3D', 'layers');
    expect(layers?.accepts).toBe('32-bit layer mask (layers 1-32)');
  });
});
