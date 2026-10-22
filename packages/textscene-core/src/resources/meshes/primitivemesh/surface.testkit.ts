/** Readers for a Godot surface's arrays, shared by the PrimitiveMesh builder tests. */

import { expect } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types.js';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext.js';
import type { ScopedResource } from '../../useSubOrExtResource.js';
import type { GodotSurface } from '../godotSurface.js';

/** Vertex `vertex` of an array that holds `size` numbers per vertex. */
export function vertexOf(array: ArrayLike<number> | undefined, vertex: number, size = 3): number[] {
  return Array.from({ length: size }, (_, i) => array![vertex * size + i]!);
}

/** Every position of the surface, one `[x, y, z]` per vertex. */
export function pointsOf(surface: GodotSurface): number[][] {
  return Array.from({ length: surface.positions.length / 3 }, (_, v) => vertexOf(surface.positions, v));
}

export function expectClose(actual: number[], expected: number[]): void {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
}

/**
 * Every triangle fronts clockwise against the stored normal of its first corner: the right-hand
 * normal of a clockwise triangle points away from the viewer, so against the stored normal.
 */
export function expectClockwiseFronts(surface: GodotSurface): void {
  const points = pointsOf(surface);
  for (let t = 0; t < surface.indices.length / 3; t++) {
    const [a, b, c] = [0, 1, 2].map((corner) => points[surface.indices[t * 3 + corner]!]!);
    const u = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!];
    const v = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
    const winding = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    const stored = vertexOf(surface.normals, surface.indices[t * 3]!);
    expect(winding[0]! * stored[0]! + winding[1]! * stored[1]! + winding[2]! * stored[2]!).toBeLessThan(0);
  }
}

/** A mesh with the sub-resources its references resolve in, as a caller of the PrimitiveMesh seam holds it. */
export function scopedMesh(
  resource: TscnInternalResource,
  ...internalResources: TscnInternalResource[]
): ScopedResource {
  return { resource, resources: { ...NO_RESOURCES, internalResources } };
}
