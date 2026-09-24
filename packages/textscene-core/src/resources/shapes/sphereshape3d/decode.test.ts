/**
 * SphereShape3D decode. `sphere_shape_3d.cpp:105` constructs with `set_radius(0.5)`,
 * and the property is a plain float (`sphere_shape_3d.cpp:100` ADD_PROPERTY, hint
 * range `0.001,100`) with no linked property, so radius is used as authored.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeSphereShape3D } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeSphereShape3D', () => {
  it('honours an authored radius', () => {
    expect(decodeSphereShape3D({ radius: '2.5' }).radius).toBe(2.5);
  });

  it('falls back to the Godot default (0.5) when radius is absent, silently', () => {
    expect(decodeSphereShape3D({}).radius).toBe(0.5);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns then falls back to 0.5 for a malformed radius (never NaN)', () => {
    const result = decodeSphereShape3D({ radius: 'not-a-number' });
    expect(result.radius).toBe(0.5);
    expect(Number.isNaN(result.radius)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('reads scientific notation and ignores unrelated properties', () => {
    expect(decodeSphereShape3D({ radius: '1e-2', resource_name: '"ball"' }).radius).toBe(0.01);
  });
});

describe('decodeSphereShape3D negative radius', () => {
  it('refuses a negative radius the way Godot ERR_FAILs it (sphere_shape_3d.cpp:86)', () => {
    // ERR_FAIL_COND_MSG returns before the assignment, so the radius keeps 0.5.
    expect(decodeSphereShape3D({ radius: '-2' }).radius).toBe(0.5);
    expect(warnSpy).toHaveBeenCalled();
  });
});
