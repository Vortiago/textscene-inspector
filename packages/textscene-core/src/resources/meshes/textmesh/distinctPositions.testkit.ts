/** The distinct positions of a mesh, for the tests that compare a build with Godot's. */

import type * as THREE from 'three';

/** @canonical In tests, the distinct positions of a mesh */
export function distinctPositions(positions: ArrayLike<number>): [number, number, number][] {
  const byKey = new Map<string, [number, number, number]>();
  for (let i = 0; i < positions.length; i += 3) {
    const position: [number, number, number] = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    byKey.set(position.join(','), position);
  }
  return [...byKey.values()];
}

/** `distinctPositions` of a position attribute, read through its accessors so a stride or an item size holds. */
export function distinctAttributePositions(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): [number, number, number][] {
  const flat = Array.from({ length: attribute.count }, (_, i) => [
    attribute.getX(i),
    attribute.getY(i),
    attribute.getZ(i),
  ]).flat();
  return distinctPositions(flat);
}
