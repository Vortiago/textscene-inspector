/**
 * CSGSphere3D geometry, built the way Godot builds it.
 *
 * Godot's sphere differs from three's `SphereGeometry` in ways that matter for parity:
 * it walks latitude from the north pole DOWNWARD so UVs map like an image, it gives sin
 * to X and cos to Z (not the other way round) so UVs run counter-clockwise on +X, and it
 * emits a single triangle per quad at each pole instead of a degenerate quad. Its poles
 * are collapsed vertices, which is exactly where three's per-segment normals and Godot's
 * position-keyed averaging diverge, the same class of bug that put the CSGCylinder3D cone
 * 0.788% out.
 *
 * ---------------------------------------------------------------------------
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGSphere3D::_build_brush`),
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

export interface CsgSphereSpec {
  radius: number;
  radialSegments: number;
  rings: number;
  smoothFaces: boolean;
  flipFaces: boolean;
}

const MIN_RADIAL_SEGMENTS = 3;
const MIN_RINGS = 2;

export function buildCsgSphereGeometry(spec: CsgSphereSpec): THREE.BufferGeometry {
  const { radius, radialSegments, rings, smoothFaces, flipFaces } = spec;

  if (
    !Number.isFinite(radialSegments) ||
    !Number.isFinite(rings) ||
    radialSegments < MIN_RADIAL_SEGMENTS ||
    rings < MIN_RINGS
  ) {
    return applyCsgNormals({ positions: new Float32Array(0), uvs: new Float32Array(0), smooth: [] });
  }

  // csg_shape.cpp:1329. Each ring contributes two triangles per segment except the two
  // pole rings, which contribute one each.
  const faceCount = rings * radialSegments * 2 - radialSegments * 2;

  const positions = new Float32Array(faceCount * 9);
  const uvs = new Float32Array(faceCount * 6);
  const smooth: boolean[] = new Array(faceCount).fill(smoothFaces);
  const invert: boolean[] = new Array(faceCount).fill(flipFaces);

  // Latitude runs top-to-bottom "like in an image" so the V coordinate matches a texture.
  const latitudeStep = -Math.PI / rings;
  const longitudeStep = (Math.PI * 2) / radialSegments;
  let face = 0;

  const put = (p: [number, number, number][], u: [number, number][]): void => {
    for (let j = 0; j < 3; j++) {
      positions.set(p[j]!, face * 9 + j * 3);
      uvs.set(u[j]!, face * 6 + j * 2);
    }
    face++;
  };

  for (let i = 0; i < rings; i++) {
    // The poles are pinned to exact 0/±1 rather than trusting cos(pi/2) to land on zero;
    // the normal accumulation keys on position, so a pole that missed by one ulp per
    // segment would stop being a single shared vertex and lose its averaged normal.
    let cos0 = 0;
    let sin0 = 1;
    if (i > 0) {
      const latitude0 = latitudeStep * i + Math.PI / 2;
      cos0 = Math.cos(latitude0);
      sin0 = Math.sin(latitude0);
    }
    const v0 = i / rings;

    let cos1 = 0;
    let sin1 = -1;
    if (i < rings - 1) {
      const latitude1 = latitudeStep * (i + 1) + Math.PI / 2;
      cos1 = Math.cos(latitude1);
      sin1 = Math.sin(latitude1);
    }
    const v1 = (i + 1) / rings;

    for (let j = 0; j < radialSegments; j++) {
      const longitude0 = longitudeStep * j;
      // sin to X and cos to Z on purpose, so UVs are CCW on +X and map to images well.
      const x0 = Math.sin(longitude0);
      const z0 = Math.cos(longitude0);
      const u0 = j / radialSegments;

      // The last segment snaps back to longitude 0 so the seam closes on the same float.
      const longitude1 = j === radialSegments - 1 ? 0 : longitudeStep * (j + 1);
      const x1 = Math.sin(longitude1);
      const z1 = Math.cos(longitude1);
      const u1 = (j + 1) / radialSegments;

      const v: [number, number, number][] = [
        [x0 * cos0 * radius, sin0 * radius, z0 * cos0 * radius],
        [x1 * cos0 * radius, sin0 * radius, z1 * cos0 * radius],
        [x1 * cos1 * radius, sin1 * radius, z1 * cos1 * radius],
        [x0 * cos1 * radius, sin1 * radius, z0 * cos1 * radius],
      ];
      const u: [number, number][] = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ];

      // At a pole the quad degenerates, so only the non-degenerate half is emitted.
      if (i > 0) put([v[0]!, v[1]!, v[2]!], [u[0]!, u[1]!, u[2]!]);
      if (i < rings - 1) put([v[2]!, v[3]!, v[0]!], [u[2]!, u[3]!, u[0]!]);
    }
  }

  return applyCsgNormals({ positions, uvs, smooth, invert } satisfies CsgFaceSoup);
}
