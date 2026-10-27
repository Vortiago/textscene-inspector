/** The volume a CSG brush encloses, for the tests that check its winding and its size. */

import type * as THREE from 'three';

/**
 * The volume the triangles of `geometry` enclose, as the sum of the signed tetrahedra each makes with
 * the origin. Positive when the faces front outward, as three.js culls them, and negative when the
 * brush is turned inside out.
 *
 * @canonical In tests, the signed volume of a brush
 */
export function enclosedVolume(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : positions.count;
  const vertexAt = (corner: number) => (index ? index.getX(corner) : corner);
  let sixTimesVolume = 0;
  for (let first = 0; first + 2 < cornerCount; first += 3) {
    const a = vertexAt(first);
    const b = vertexAt(first + 1);
    const c = vertexAt(first + 2);
    const [ax, ay, az] = [positions.getX(a), positions.getY(a), positions.getZ(a)];
    const [bx, by, bz] = [positions.getX(b), positions.getY(b), positions.getZ(b)];
    const [cx, cy, cz] = [positions.getX(c), positions.getY(c), positions.getZ(c)];
    sixTimesVolume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return sixTimesVolume / 6;
}

/** The volume of a closed brush, whichever way it winds. */
export function absoluteEnclosedVolume(geometry: THREE.BufferGeometry): number {
  return Math.abs(enclosedVolume(geometry));
}
