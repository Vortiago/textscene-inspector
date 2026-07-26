/**
 * Godot's CSG normal rule, transcribed rather than approximated.
 *
 * Every CSG geometry builder in this folder emits a face soup and finishes here, because
 * Godot does not compute CSG normals the way any three.js primitive does. `smooth_faces`
 * is neither `flatShading` nor `computeVertexNormals()`:
 *
 *   - a SMOOTH face's vertex takes the normalized SUM of the unit plane normals of every
 *     smooth face touching that exact vertex POSITION;
 *   - a FLAT face's vertex takes its own face's plane normal, and neither contributes to
 *     nor reads the accumulation.
 *
 * Keying on position rather than on vertex index is the load-bearing part, and it is where
 * three.js diverges. `THREE.CylinderGeometry(0, 0.4, 1, 8)` gives the collapsed cone apex
 * nine distinct vertices with nine radial normals; Godot collapses all nine into one
 * straight-up normal. On a cone that difference alone is plainly visible as shading.
 *
 * The accumulation is an UNWEIGHTED sum of unit normals, so a large face and a small one
 * meeting at a vertex pull on it equally. That is deliberate on Godot's side and is not
 * what area-weighted averaging (the usual choice) would produce.
 *
 * `invert` is `CSGPrimitive3D.flip_faces`. It both swaps vertices 1 and 2 and negates the
 * normal, so it lives here with the winding rather than being applied by each builder.
 * Godot carries it per face because a `CSGBrush` merges faces from several shapes; a
 * builder produces one shape, so it is one flag for the whole soup.
 *
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';

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
  /** `flip_faces` for the whole shape. Defaults to false. */
  invert?: boolean;
}

/** Godot hashes the `Vector3` itself; the float32 triple is the faithful equivalent. */
function positionKey(positions: Float32Array, base: number): string {
  return `${positions[base]},${positions[base + 1]},${positions[base + 2]}`;
}

/**
 * `Plane(v0, v1, v2)` with Godot's default `CLOCKWISE` direction:
 * `normal = ((v0 - v2) cross (v0 - v1)).normalized()`.
 *
 * Note this is the NEGATION of the conventional CCW `(v1 - v0) cross (v2 - v0)`. Reading
 * it the usual way inverts every normal in every CSG mesh.
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

  // Pass 1: accumulate unit plane normals per vertex position, smooth faces only.
  const accumulated = new Map<string, THREE.Vector3>();
  const plane = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();

  for (let t = 0; t < triangles; t++) {
    if (!smooth[t]) continue;
    const base = t * 9;
    planeNormal(positions, base, plane, edgeA, edgeB);
    for (let j = 0; j < 3; j++) {
      const key = positionKey(positions, base + j * 3);
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
  // Two swaps compose here, and they cancel.
  //
  // Godot does `int order[3] = {0,1,2}; if (invert) SWAP(order[1], order[2]);` and
  // writes source vertex j into destination slot order[j].
  //
  // On top of that, Godot's front faces are wound CLOCKWISE while three.js treats
  // COUNTER-CLOCKWISE as front and culls the other side. Emitting Godot's order
  // verbatim therefore back-face-culls every triangle, which renders each solid as its
  // own interior. The normals are unaffected — we supply them explicitly — so this is
  // purely a winding conversion.
  const order = flipped ? [0, 1, 2] : [0, 2, 1];

  for (let t = 0; t < triangles; t++) {
    const base = t * 9;
    const uvBase = t * 6;

    planeNormal(positions, base, plane, edgeA, edgeB);

    for (let j = 0; j < 3; j++) {
      normal.copy(plane);
      if (smooth[t]) {
        const sum = accumulated.get(positionKey(positions, base + j * 3));
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
      outUvs[uvDst + 1] = uvs[uvBase + j * 2 + 1] ?? 0;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(outPositions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(outNormals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(outUvs, 2));
  return geometry;
}
