/**
 * Digests of a mesh's corners in the layout of a Godot 4.6.3 dump: per index, the position and
 * UV2 as five little-endian float32, each triangle in Godot's winding. The expected digests were
 * taken over `surface_get_arrays` of the demo's imported meshes.
 */

import type * as THREE from 'three';
import { md5Hex } from '../md5';
import { UV2_ATTRIBUTE } from '../../../../meshes/uv2';

const CORNER_BYTES = 20;

/** The corners of every triangle, in index order and Godot's winding. */
function godotTriangles(surfaces: readonly THREE.BufferGeometry[]): Uint8Array[][] {
  const triangles: Uint8Array[][] = [];
  for (const geometry of surfaces) {
    const index = geometry.index!.array;
    for (let i = 0; i < index.length; i += 3) {
      triangles.push(
        [index[i]!, index[i + 2]!, index[i + 1]!].map((vertex) => cornerBytes(geometry, vertex))
      );
    }
  }
  return triangles;
}

function cornerBytes(geometry: THREE.BufferGeometry, vertex: number): Uint8Array {
  const position = geometry.getAttribute('position');
  const uv2 = geometry.getAttribute(UV2_ATTRIBUTE);
  const view = new DataView(new ArrayBuffer(CORNER_BYTES));
  [
    position.getX(vertex),
    position.getY(vertex),
    position.getZ(vertex),
    uv2.getX(vertex),
    uv2.getY(vertex),
  ].forEach((value, i) => view.setFloat32(i * 4, value, true));
  return new Uint8Array(view.buffer);
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  parts.reduce((offset, part) => (joined.set(part, offset), offset + part.length), 0);
  return joined;
}

/** The digest of every corner in order. */
export function orderedCornerDigest(surfaces: readonly THREE.BufferGeometry[]): string {
  return md5Hex(godotTriangles(surfaces).flat());
}

/**
 * The digest of the triangles as a set: each starts at its smallest corner, keeping its winding,
 * and the triangles sort by their bytes.
 */
export function triangleSetDigest(surfaces: readonly THREE.BufferGeometry[]): string {
  const canonical = godotTriangles(surfaces).map((corners) => {
    const first = corners.reduce((min, corner, i) => (compareBytes(corner, corners[min]!) < 0 ? i : min), 0);
    return concat([...corners.slice(first), ...corners.slice(0, first)]);
  });
  return md5Hex(canonical.sort(compareBytes));
}
