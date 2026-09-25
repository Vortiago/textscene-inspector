/**
 * The small pieces the sweep is built out of: the outline's own geometry, the frame basis every
 * extrusion step is placed on, and the once-per-session approximation warnings. Part of the
 * CSGPolygon3D port, whose derivation notice is in `polygonGeometry.ts`.
 */

import * as THREE from 'three';
import { warn } from '../../../../logger';
import { applyCsgNormals } from '../smoothNormals';

/**
 * The builder runs on every geometry rebuild, so an unconditional `warn` for an
 * approximation would repeat per keystroke in the source pane and bury real problems.
 * Module-level rather than per-call because "once" has to outlive a single build.
 */
const warned = new Set<string>();
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  warn(message);
}

export function emptyGeometry(): THREE.BufferGeometry {
  return applyCsgNormals({ positions: new Float32Array(0), uvs: new Float32Array(0), smooth: [] });
}

/**
 * Signed area, matching Godot's `Triangulate::get_area`: the shoelace sum of
 * `p.cross(q)` halved, positive for counter-clockwise.
 */
export function signedArea(points: THREE.Vector2[]): number {
  let a = 0;
  for (let p = points.length - 1, q = 0; q < points.length; p = q++) {
    a += points[p]!.x * points[q]!.y - points[p]!.y * points[q]!.x;
  }
  return a * 0.5;
}

export function toPoints(flat: Float32Array): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push(new THREE.Vector2(flat[i]!, flat[i + 1]!));
  return out;
}

/** Godot passes `Vector3(0, 1, 0)` as the up vector for every PATH frame. */
export const PATH_UP = new THREE.Vector3(0, 1, 0);

/** `Transform3D().looking_at(dir, up)`, which is three's `lookAt` with the same convention. */
export function facingMatrix(dir: THREE.Vector3, up: THREE.Vector3): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  // A zero or up-parallel direction makes the basis degenerate in Godot too; identity is
  // the least-surprising fallback and keeps NaN out of the vertex buffer.
  if (dir.lengthSq() === 0) return m;
  const safeUp = Math.abs(dir.clone().normalize().dot(up)) > 0.9999 ? new THREE.Vector3(0, 0, 1) : up;
  return m.lookAt(new THREE.Vector3(0, 0, 0), dir, safeUp);
}
