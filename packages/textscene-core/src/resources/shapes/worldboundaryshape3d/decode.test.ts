/** Tests for the WorldBoundaryShape3D decode: the canonical parsePlane contract. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodeWorldBoundaryShape3D } from './decode';

const DEFAULT_PLANE = { normal: { x: 0, y: 1, z: 0 }, d: 0 };

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodeWorldBoundaryShape3D', () => {
  it('honours an authored plane', () => {
    expect(decodeWorldBoundaryShape3D({ plane: 'Plane(1, 0, 0, 2.5)' }).plane).toEqual({
      normal: { x: 1, y: 0, z: 0 },
      d: 2.5,
    });
  });

  it('defaults to Plane(0, 1, 0, 0) when plane is absent, silently', () => {
    expect(decodeWorldBoundaryShape3D({}).plane).toEqual(DEFAULT_PLANE);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns then falls back to the default for a malformed plane', () => {
    expect(decodeWorldBoundaryShape3D({ plane: 'Plane(0, 1, 0)' }).plane).toEqual(DEFAULT_PLANE);
    expect(decodeWorldBoundaryShape3D({ plane: 'Plane(--1, 0, 0, 0)' }).plane).toEqual(DEFAULT_PLANE);
    expect(decodeWorldBoundaryShape3D({ plane: 'Plane(1e999, 0, 0, 0)' }).plane).toEqual(DEFAULT_PLANE);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it('stores a non-unit normal as authored (world_boundary_shape_3d.cpp:118 does not normalise)', () => {
    expect(decodeWorldBoundaryShape3D({ plane: 'Plane(0, 2, 0, -1)' }).plane).toEqual({
      normal: { x: 0, y: 2, z: 0 },
      d: -1,
    });
  });
});
