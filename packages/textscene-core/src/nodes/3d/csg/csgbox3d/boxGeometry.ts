/**
 * CSGBox3D geometry, built the way Godot builds it.
 *
 * three's `BoxGeometry` renders identically here (measured at 0.011% against real Godot),
 * so this is not a bug fix. It exists so all seven CSG types produce their solid through
 * one path: the boolean evaluator asks a registered builder for triangles, and a slice
 * that answered with a three primitive instead would be the one with different UVs and
 * different normal generation feeding into the same merge.
 *
 * ---------------------------------------------------------------------------
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGBox3D::_build_brush`),
 * used under the MIT licence:
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

import type * as THREE from 'three';
import { applyCsgNormals, type CsgFaceSoup } from '../smoothNormals';

export interface CsgBoxSpec {
  size: { x: number; y: number; z: number };
  flipFaces: boolean;
}

/** Corner UVs, shared by all six faces. */
const UV_POINTS = [0, 0, 0, 1, 1, 1, 1, 0];

export function buildCsgBoxGeometry(spec: CsgBoxSpec): THREE.BufferGeometry {
  const { size, flipFaces } = spec;
  const mul = [size.x / 2, size.y / 2, size.z / 2];

  const faceCount = 12; // it's a cube
  const positions = new Float32Array(faceCount * 9);
  const uvs = new Float32Array(faceCount * 6);
  // A box has no smooth_faces property: every face is flat.
  const smooth: boolean[] = new Array(faceCount).fill(false);

  let face = 0;
  const put = (p: number[][], u: number[][]): void => {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) positions[face * 9 + j * 3 + k] = p[j]![k]! * mul[k]!;
      uvs.set(u[j]!, face * 6 + j * 2);
    }
    face++;
  };

  for (let i = 0; i < 6; i++) {
    // Godot generates all six faces from one index trick rather than listing them:
    // axis rotation by `(i + k) % 3`, with the second three negated and reversed.
    const facePoints: number[][] = [[], [], [], []].map(() => [0, 0, 0]);
    for (let j = 0; j < 4; j++) {
      const v = [1, 1 - 2 * ((j >> 1) & 1), 0];
      v[2] = v[1]! * (1 - 2 * (j & 1));
      for (let k = 0; k < 3; k++) {
        if (i < 3) facePoints[j]![(i + k) % 3] = v[k]!;
        else facePoints[3 - j]![(i + k) % 3] = -v[k]!;
      }
    }

    const u = [0, 1, 2, 3].map((j) => [UV_POINTS[j * 2]!, UV_POINTS[j * 2 + 1]!]);

    put([facePoints[0]!, facePoints[1]!, facePoints[2]!], [u[0]!, u[1]!, u[2]!]);
    put([facePoints[2]!, facePoints[3]!, facePoints[0]!], [u[2]!, u[3]!, u[0]!]);
  }

  return applyCsgNormals({ positions, uvs, smooth, invert: flipFaces } satisfies CsgFaceSoup);
}
