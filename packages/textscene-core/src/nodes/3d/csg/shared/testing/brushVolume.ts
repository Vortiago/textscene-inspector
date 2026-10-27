/** The volume a CSG brush encloses, for the tests that check its winding and its size. */

import * as THREE from 'three';

/**
 * The volume the triangles of `geometry` enclose, as the sum of the signed tetrahedra each makes with
 * the origin. Positive when the faces front outward, as three.js culls them, and negative when the
 * brush is turned inside out.
 */
export function enclosedVolume(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const cornerCount = index ? index.count : positions.count;
  const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i);
  let sixTimesVolume = 0;
  for (let first = 0; first + 2 < cornerCount; first += 3) {
    sixTimesVolume += corner(first).dot(
      new THREE.Vector3().crossVectors(corner(first + 1), corner(first + 2))
    );
  }
  return sixTimesVolume / 6;
}
