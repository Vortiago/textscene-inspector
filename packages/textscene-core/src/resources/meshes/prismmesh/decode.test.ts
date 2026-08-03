/**
 * Tests for the PrismMesh decode.
 *
 * Defaults from Godot `primitive_meshes.h:303-307` (`left_to_right = 0.5`,
 * `size = Vector3(1, 1, 1)`, subdivisions 0). The three subdivide setters
 * (`primitive_meshes.cpp:1921-1955`) floor at 0; `set_left_to_right` (:1896) and
 * `set_size` (:1908) have no guard.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { decodePrismMesh } from './decode';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('decodePrismMesh', () => {
  it('falls back to the Godot defaults when everything is absent, silently', () => {
    expect(decodePrismMesh({})).toEqual({
      leftToRight: 0.5,
      size: { x: 1, y: 1, z: 1 },
      subdivideWidth: 0,
      subdivideHeight: 0,
      subdivideDepth: 0,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reads every authored field', () => {
    expect(
      decodePrismMesh({
        left_to_right: '0.25',
        size: 'Vector3(2, 4, 6)',
        subdivide_width: '1',
        subdivide_height: '2',
        subdivide_depth: '3',
      })
    ).toEqual({
      leftToRight: 0.25,
      size: { x: 2, y: 4, z: 6 },
      subdivideWidth: 1,
      subdivideHeight: 2,
      subdivideDepth: 3,
    });
  });

  it('floors negative subdivisions at 0 the way Godot does', () => {
    const p = decodePrismMesh({
      subdivide_width: '-1',
      subdivide_height: '-9',
      subdivide_depth: '-1',
    });
    expect([p.subdivideWidth, p.subdivideHeight, p.subdivideDepth]).toEqual([0, 0, 0]);
  });

  it('warns then falls back to the unit size for a malformed size', () => {
    expect(decodePrismMesh({ size: 'Vector3(1, 2)' }).size).toEqual({ x: 1, y: 1, z: 1 });
    expect(warnSpy).toHaveBeenCalled();
  });
});
