/**
 * Godot's CSG normal rule, which every CSG builder in this folder finishes with. A smooth
 * face's vertex takes the normalised sum of the unit plane normals of every smooth face at that
 * exact position, and a flat face's vertex takes its own plane normal. Neither `flatShading`
 * nor `computeVertexNormals()` gives this.
 *
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGShape3D::update_shape`,
 * and `core/math/plane.h`, `Plane(p_point1, p_point2, p_point3)`), used under the MIT
 * licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * See THIRD-PARTY-NOTICES.md.
 */

import * as THREE from 'three';
import { CSG_MERGE_TOLERANCE } from '../../../godot/csg';
import { bottomUpV } from '../../../godot/uv';

/**
 * A CSG shape's triangles before normals exist: Godot's `CSGBrush::faces` in the shape
 * three.js wants. Non-indexed, three vertices per triangle, in Godot's own winding.
 */
export interface CsgFaceSoup {
  /** Flat `xyz` triples, 9 floats per triangle. */
  positions: Float32Array;
  /** Flat `uv` pairs, 6 floats per triangle. */
  uvs: Float32Array;
  /** Per-triangle `smooth_faces`. Length is `positions.length / 9`. */
  smooth: readonly boolean[];
  /**
   * `CSGPrimitive3D.flip_faces`: it swaps vertices 1 and 2 and negates the normal, so it lives
   * here with the winding. Godot carries it per face, because a `CSGBrush` merges several
   * shapes. One builder makes one shape, so one flag covers the soup. Defaults to false.
   */
  invert?: boolean;
}

/** A hash of a weld-grid cell. Two cells can share one, which only adds a candidate to check. */
function cellHash(x: number, y: number, z: number): number {
  return Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
}

/**
 * Each smooth face's corners, as the first corner each one welds to. Godot hashes the `Vector3`
 * after manifold welds every point within `CSG_MERGE_TOLERANCE` of another. The grid's cells are
 * that wide, so a partner lies in the corner's own cell or a neighbour. A flat face reads no weld.
 */
function smoothCornerWelds(positions: Float32Array, smooth: readonly boolean[]): Int32Array {
  const welds = new Int32Array(smooth.length * 3).fill(-1);
  const cells = new Map<number, number[]>();
  const toleranceSq = CSG_MERGE_TOLERANCE ** 2;
  const partnerIn = (hash: number, x: number, y: number, z: number): number => {
    const members = cells.get(hash);
    if (!members) return -1;
    for (const r of members) {
      const dx = positions[r * 3]! - x;
      const dy = positions[r * 3 + 1]! - y;
      const dz = positions[r * 3 + 2]! - z;
      if (dx * dx + dy * dy + dz * dz <= toleranceSq) return r;
    }
    return -1;
  };
  for (let corner = 0; corner < welds.length; corner++) {
    if (!smooth[(corner / 3) | 0]) continue;
    const x = positions[corner * 3]!;
    const y = positions[corner * 3 + 1]!;
    const z = positions[corner * 3 + 2]!;
    const cx = Math.round(x / CSG_MERGE_TOLERANCE);
    const cy = Math.round(y / CSG_MERGE_TOLERANCE);
    const cz = Math.round(z / CSG_MERGE_TOLERANCE);
    const own = cellHash(cx, cy, cz);
    let weld = partnerIn(own, x, y, z);
    for (let n = 0; weld === -1 && n < 27; n++) {
      if (n === 13) continue;
      weld = partnerIn(
        cellHash(cx + ((n / 9) | 0) - 1, cy + (((n / 3) | 0) % 3) - 1, cz + (n % 3) - 1),
        x,
        y,
        z
      );
    }
    if (weld === -1) {
      weld = corner;
      const members = cells.get(own);
      if (members) members.push(corner);
      else cells.set(own, [corner]);
    }
    welds[corner] = weld;
  }
  return welds;
}

/** Face `t` with two corners welded together, which manifold collapses out of the brush. */
function isCollapsed(keys: Int32Array, t: number): boolean {
  const [a, b, c] = [keys[t * 3], keys[t * 3 + 1], keys[t * 3 + 2]];
  return a === b || b === c || a === c;
}

/**
 * `Plane(v0, v1, v2)` with Godot's default `CLOCKWISE` direction:
 * `normal = ((v0 - v2) cross (v0 - v1)).normalized()`.
 *
 * This is the negation of the conventional CCW `(v1 - v0) cross (v2 - v0)`. Reading it the usual
 * way inverts every normal in every CSG mesh.
 */
function planeNormal(
  positions: Float32Array,
  base: number,
  target: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3
): THREE.Vector3 {
  a.set(
    positions[base]! - positions[base + 6]!,
    positions[base + 1]! - positions[base + 7]!,
    positions[base + 2]! - positions[base + 8]!
  );
  b.set(
    positions[base]! - positions[base + 3]!,
    positions[base + 1]! - positions[base + 4]!,
    positions[base + 2]! - positions[base + 5]!
  );
  return target.crossVectors(a, b).normalize();
}

/**
 * Turn a face soup into a renderable, boolean-ready `BufferGeometry`.
 *
 * The result is non-indexed and carries `position`, `normal` and `uv`, which is exactly
 * the attribute set `three-bvh-csg` keeps by default; a brush missing one has that
 * channel trimmed out of the boolean result.
 */
export function applyCsgNormals(soup: CsgFaceSoup): THREE.BufferGeometry {
  const { positions, uvs, smooth, invert } = soup;
  const triangles = Math.floor(positions.length / 9);

  // Pass 1: sum unit plane normals per welded position, smooth faces only. Position, not index,
  // is the key: three gives a cone apex nine radial normals where Godot collapses them to one.
  // The sum is unweighted, so a small face pulls on a vertex as hard as a large one.
  const keys = smoothCornerWelds(positions, smooth);
  const accumulated = new Map<number, THREE.Vector3>();
  const plane = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();

  for (let t = 0; t < triangles; t++) {
    if (!smooth[t]) continue;
    if (isCollapsed(keys, t)) continue;
    planeNormal(positions, t * 9, plane, edgeA, edgeB);
    for (let j = 0; j < 3; j++) {
      const key = keys[t * 3 + j]!;
      const existing = accumulated.get(key);
      if (existing) existing.add(plane);
      else accumulated.set(key, plane.clone());
    }
  }

  // Pass 2: emit, applying the smooth lookup and the invert swap.
  const outPositions = new Float32Array(triangles * 9);
  const outNormals = new Float32Array(triangles * 9);
  const outUvs = new Float32Array(triangles * 6);
  const normal = new THREE.Vector3();
  const flipped = invert === true;
  // Two swaps compose here, and they cancel. Godot does `int order[3] = {0,1,2}; if (invert) SWAP(order[1],
  // order[2]);` and writes source vertex j into slot order[j]. Godot's front faces also wind
  // clockwise, where three.js culls clockwise, so Godot's order would render each solid as its
  // interior. The normals are supplied explicitly, so this is purely a winding conversion.
  const order = flipped ? [0, 1, 2] : [0, 2, 1];

  for (let t = 0; t < triangles; t++) {
    const base = t * 9;
    const uvBase = t * 6;

    planeNormal(positions, base, plane, edgeA, edgeB);

    for (let j = 0; j < 3; j++) {
      normal.copy(plane);
      if (smooth[t]) {
        const sum = accumulated.get(keys[t * 3 + j]!);
        // Godot normalizes the accumulated sum in place. A sum of exactly zero (two
        // faces cancelling on a zero-thickness sheet) would leave a black (0,0,0)
        // normal there; we keep the face's own plane normal instead, which is the
        // same value every non-smooth face at that position already gets.
        if (sum && sum.lengthSq() > 0) normal.copy(sum).normalize();
      }
      if (flipped) normal.negate();

      const dst = base + order[j]! * 3;
      outPositions[dst] = positions[base + j * 3]!;
      outPositions[dst + 1] = positions[base + j * 3 + 1]!;
      outPositions[dst + 2] = positions[base + j * 3 + 2]!;
      outNormals[dst] = normal.x;
      outNormals[dst + 1] = normal.y;
      outNormals[dst + 2] = normal.z;

      const uvDst = uvBase + order[j]! * 2;
      outUvs[uvDst] = uvs[uvBase + j * 2] ?? 0;
      outUvs[uvDst + 1] = bottomUpV(uvs[uvBase + j * 2 + 1] ?? 0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(outNormals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(outUvs, 2));
  return geometry;
}
