/**
 * The sweep's write head: a fixed-capacity triangle buffer whose head can rewind, which is how
 * `path_simplify_angle` drops a near-collinear frame, as Godot's `face -= extrusion_face_count`
 * does. Capacity is the worst case (every frame, both caps), so `finish` hands on the written
 * prefix. Part of the CSGPolygon3D port, whose derivation notice is in `polygonGeometry.ts`.
 */

import type * as THREE from 'three';
import type { CsgFaceSoup } from '../smoothNormals';

export interface SweepFaceBuffer {
  putTri(
    p: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
    u: [THREE.Vector2, THREE.Vector2, THREE.Vector2],
    isSmooth: boolean
  ): void;
  /** Un-write the last `count` triangles, so the next `putTri` overwrites them. */
  rewind(count: number): void;
  /** The written prefix, ready for `applyCsgNormals`. */
  finish(invert: boolean): CsgFaceSoup;
}

export function sweepFaceBuffer(maxFaces: number): SweepFaceBuffer {
  const positions = new Float32Array(maxFaces * 9);
  const uvs = new Float32Array(maxFaces * 6);
  const smooth: boolean[] = new Array(maxFaces).fill(false);
  let face = 0;

  return {
    putTri(p, u, isSmooth) {
      for (let j = 0; j < 3; j++) {
        positions.set([p[j]!.x, p[j]!.y, p[j]!.z], face * 9 + j * 3);
        uvs.set([u[j]!.x, u[j]!.y], face * 6 + j * 2);
      }
      smooth[face] = isSmooth;
      face++;
    },

    rewind(count) {
      face -= count;
    },

    finish(invert) {
      return {
        positions: positions.subarray(0, face * 9),
        uvs: uvs.subarray(0, face * 6),
        smooth: smooth.slice(0, face),
        invert,
      } satisfies CsgFaceSoup;
    },
  };
}
