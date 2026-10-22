/** Readers for a Godot surface's arrays, shared by the PrimitiveMesh builder tests. */

import { expect } from 'vitest';
import type { TscnInternalResource } from '../../../parser/types.js';
import { NO_RESOURCES } from '../../../r3f/SceneResourcesContext.js';
import type { ParsedResource } from '../../../parser/parsedResource.js';
import type { ResolvableResource } from '../../scopedResource.js';
import { loadedFilesOf, NO_FILES } from '../../testing/loadedFiles.js';
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
): ResolvableResource {
  return { resource, resources: { ...NO_RESOURCES, internalResources }, loadedFile: NO_FILES };
}

/** `mesh` with the files in `parsed` loaded, keyed by path. */
export function withLoadedFiles(
  mesh: ResolvableResource,
  parsed: Record<string, ParsedResource>
): ResolvableResource {
  return { ...mesh, loadedFile: loadedFilesOf(parsed) };
}

/** The data of a TubeTrailMesh two sections long, with one ring each and four steps round. */
export const COARSE_TUBE = { radial_steps: '4', sections: '2', section_length: '1', section_rings: '1' };

/** The data of a Curve that runs from 1 at the top to `end` at the bottom. */
export function curveEndingAt(end: string): { _data: string } {
  return { _data: `[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, ${end}), 0.0, 0.0, 0, 0]` };
}

/** A `.tres` Curve file that runs from 1 at the top to `end` at the bottom. */
export function curveFile(end: string): ParsedResource {
  return { resourceType: 'Curve', properties: curveEndingAt(end), extResources: [], subResources: [] };
}
