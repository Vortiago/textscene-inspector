/**
 * Digests of a mesh's corners in the layout of a Godot 4.6.3 dump: per index, the position and
 * UV2 as five little-endian float32, each triangle in Godot's winding. The expected digests were
 * taken over `surface_get_arrays` of the demo's imported meshes.
 */

import type * as THREE from 'three';
import { md5Hex } from '../md5';
import { UV2_ATTRIBUTE } from '../../../../meshes/uv2';

const CORNER_BYTES = 20;
const TRIANGLE_BYTES = 3 * CORNER_BYTES;

/**
 * The corners of every triangle, in index order and Godot's winding, in one buffer. One buffer,
 * not an array per corner: zdm2 has 176k corners, and the core tests' VM context makes each
 * `DataView` built and each global read slow enough to time the digest out.
 */
function godotCorners(surfaces: readonly THREE.BufferGeometry[]): Uint8Array {
  const cornerCount = surfaces.reduce((count, geometry) => count + geometry.index!.count, 0);
  const view = new DataView(new ArrayBuffer(cornerCount * CORNER_BYTES));
  let offset = 0;
  for (const geometry of surfaces) {
    const index = geometry.index!.array;
    for (let i = 0; i < index.length; i += 3) {
      for (const vertex of [index[i]!, index[i + 2]!, index[i + 1]!]) {
        writeCorner(view, offset, geometry, vertex);
        offset += CORNER_BYTES;
      }
    }
  }
  return new Uint8Array(view.buffer);
}

function writeCorner(view: DataView, offset: number, geometry: THREE.BufferGeometry, vertex: number): void {
  const position = geometry.getAttribute('position');
  const uv2 = geometry.getAttribute(UV2_ATTRIBUTE);
  view.setFloat32(offset, position.getX(vertex), true);
  view.setFloat32(offset + 4, position.getY(vertex), true);
  view.setFloat32(offset + 8, position.getZ(vertex), true);
  view.setFloat32(offset + 12, uv2.getX(vertex), true);
  view.setFloat32(offset + 16, uv2.getY(vertex), true);
}

/** The byte order of the `length` bytes at `a` and at `b`. */
function compareBytesAt(bytes: Uint8Array, a: number, b: number, length: number): number {
  for (let i = 0; i < length; i++) if (bytes[a + i] !== bytes[b + i]) return bytes[a + i]! - bytes[b + i]!;
  return 0;
}

/** The digest of every corner in order. */
export function orderedCornerDigest(surfaces: readonly THREE.BufferGeometry[]): string {
  return md5Hex([godotCorners(surfaces)]);
}

/**
 * The digest of the triangles as a set: each starts at its smallest corner, keeping its winding,
 * and the triangles sort by their bytes.
 */
export function triangleSetDigest(surfaces: readonly THREE.BufferGeometry[]): string {
  const canonical = canonicalTriangles(godotCorners(surfaces));
  const order = Array.from({ length: canonical.length / TRIANGLE_BYTES }, (_, triangle) => triangle).sort(
    (a, b) => compareBytesAt(canonical, a * TRIANGLE_BYTES, b * TRIANGLE_BYTES, TRIANGLE_BYTES)
  );
  const sorted = new Uint8Array(canonical.length);
  order.forEach((triangle, i) => {
    const start = triangle * TRIANGLE_BYTES;
    sorted.set(canonical.subarray(start, start + TRIANGLE_BYTES), i * TRIANGLE_BYTES);
  });
  return md5Hex([sorted]);
}

/** Each triangle rotated to start at its smallest corner. */
function canonicalTriangles(corners: Uint8Array): Uint8Array {
  const canonical = new Uint8Array(corners.length);
  for (let start = 0; start < corners.length; start += TRIANGLE_BYTES) {
    let first = 0;
    for (let corner = 1; corner < 3; corner++) {
      const order = compareBytesAt(
        corners,
        start + corner * CORNER_BYTES,
        start + first * CORNER_BYTES,
        CORNER_BYTES
      );
      if (order < 0) first = corner;
    }
    for (let corner = 0; corner < 3; corner++) {
      const from = start + ((first + corner) % 3) * CORNER_BYTES;
      canonical.set(corners.subarray(from, from + CORNER_BYTES), start + corner * CORNER_BYTES);
    }
  }
  return canonical;
}
