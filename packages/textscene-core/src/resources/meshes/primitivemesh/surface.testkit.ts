/** Readers for a Godot surface's arrays, shared by the PrimitiveMesh builder tests. */

import { expect } from 'vitest';
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
