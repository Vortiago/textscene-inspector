/**
 * CSGCylinder3D geometry, built the way Godot builds it.
 *
 * three's `CylinderGeometry` is close but not the same shape: it starts the ring on +Z
 * where Godot starts on +X, and it gives a cone's collapsed apex one radial normal per
 * segment where Godot averages them into one. The second difference is visible. Measured
 * against real Godot 4.6.3, it put `unit-csg-cylinder.tscn` 0.788% out, 7.9x the visual
 * gate, on the cone alone.
 *
 * So the faces come from Godot's own construction and the normals from
 * `applyCsgNormals`, which is the single normal rule every CSG builder here shares.
 *
 * ---------------------------------------------------------------------------
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGCylinder3D::_build_brush`),
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

export interface CsgCylinderSpec {
  radius: number;
  height: number;
  sides: number;
  cone: boolean;
  smoothFaces: boolean;
  flipFaces: boolean;
}

/** Godot's editor minimum; below it there is no solid to build. */
const MIN_SIDES = 3;

export function buildCsgCylinderGeometry(spec: CsgCylinderSpec): THREE.BufferGeometry {
  const { radius, height, sides, cone, smoothFaces, flipFaces } = spec;

  if (!Number.isFinite(sides) || sides < MIN_SIDES) {
    return applyCsgNormals({ positions: new Float32Array(0), uvs: new Float32Array(0), smooth: [] });
  }

  // csg_shape.cpp:1698. Cone drops the second wall triangle and the whole top cap.
  const faceCount = sides * (cone ? 1 : 2) + sides + (cone ? 0 : sides);

  const positions = new Float32Array(faceCount * 9);
  const uvs = new Float32Array(faceCount * 6);
  const smooth: boolean[] = new Array(faceCount);

  // `vertex_mul` scales a unit shape spanning y in [-1, 1], so `height` is the full height.
  const mulX = radius;
  const mulY = height * 0.5;
  let face = 0;

  const put = (
    p: [number, number, number][],
    u: [number, number][],
    isSmooth: boolean
  ): void => {
    for (let j = 0; j < 3; j++) {
      positions[face * 9 + j * 3] = p[j]![0] * mulX;
      positions[face * 9 + j * 3 + 1] = p[j]![1] * mulY;
      positions[face * 9 + j * 3 + 2] = p[j]![2] * mulX;
      uvs[face * 6 + j * 2] = u[j]![0];
      uvs[face * 6 + j * 2 + 1] = u[j]![1];
    }
    smooth[face] = isSmooth;
    face++;
  };

  for (let i = 0; i < sides; i++) {
    const inc = i / sides;
    // Godot snaps the last segment back to 0 so the ring closes on the exact same float.
    // That matters here beyond tidiness: the normal accumulation keys on vertex position,
    // so a seam that missed by one ulp would break smoothing at the seam.
    const incN = i === sides - 1 ? 0 : (i + 1) / sides;

    const ang = inc * Math.PI * 2;
    const angN = incN * Math.PI * 2;
    const base: [number, number, number] = [Math.cos(ang), 0, Math.sin(ang)];
    const baseN: [number, number, number] = [Math.cos(angN), 0, Math.sin(angN)];
    const taper = cone ? 0 : 1;

    const fp: [number, number, number][] = [
      [base[0], base[1] - 1, base[2]],
      [baseN[0], baseN[1] - 1, baseN[2]],
      [baseN[0] * taper, baseN[1] + 1, baseN[2] * taper],
      [base[0] * taper, base[1] + 1, base[2] * taper],
    ];
    const u: [number, number][] = [
      [inc, 0],
      [incN, 0],
      [incN, 1],
      [inc, 1],
    ];

    // Wall.
    put([fp[0]!, fp[1]!, fp[2]!], [u[0]!, u[1]!, u[2]!], smoothFaces);
    if (!cone) {
      put([fp[2]!, fp[3]!, fp[0]!], [u[2]!, u[3]!, u[0]!], smoothFaces);
    }

    // Caps are ALWAYS flat, whatever `smooth_faces` says (csg_shape.cpp:1795, :1810);
    // smoothing them would round the rim over and lose the silhouette edge.
    const capUv = (p: [number, number, number]): [number, number] => [p[0] * 0.5 + 0.5, p[1] * 0.5 + 0.5];

    put([fp[1]!, fp[0]!, [0, -1, 0]], [capUv(fp[1]!), capUv(fp[0]!), [0.5, 0.5]], false);

    if (!cone) {
      // Reproduced verbatim including Godot's own slip: the TOP cap's UVs are derived
      // from face_points[1] and [0] (the BOTTOM ring, y = -1) rather than [3] and [2].
      // It is wrong in the same way in Godot, so matching it is the parity-correct move.
      put([fp[3]!, fp[2]!, [0, 1, 0]], [capUv(fp[1]!), capUv(fp[0]!), [0.5, 0.5]], false);
    }
  }

  return applyCsgNormals({ positions, uvs, smooth, invert: flipFaces } satisfies CsgFaceSoup);
}
