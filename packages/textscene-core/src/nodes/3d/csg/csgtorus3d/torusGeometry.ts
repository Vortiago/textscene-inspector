/**
 * CSGTorus3D geometry, built the way Godot builds it.
 *
 * Porting the construction rather than mapping onto `THREE.TorusGeometry` settles three
 * questions that a mapping would leave open, each of which is an easy silent error:
 * Godot's ring lies in XZ with the hole on +Y while three's lies in XY with the hole on
 * +Z; Godot's `sides` counts segments around the RING while three's `radialSegments`
 * counts them around the TUBE, so the two parameters swap; and the collapsed-vertex
 * normal problem that put the CSGCylinder3D cone 0.788% out applies to any three primitive
 * whose normals are analytic rather than accumulated by position.
 *
 * ---------------------------------------------------------------------------
 * Derived from Godot Engine (`modules/csg/csg_shape.cpp`, `CSGTorus3D::_build_brush`),
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

export interface CsgTorusSpec {
  innerRadius: number;
  outerRadius: number;
  /** Segments around the ring. Godot default 8. */
  sides: number;
  /** Segments around the tube cross-section. Godot default 6. */
  ringSides: number;
  smoothFaces: boolean;
  flipFaces: boolean;
}

const MIN_SEGMENTS = 3;

function emptyGeometry(): THREE.BufferGeometry {
  return applyCsgNormals({ positions: new Float32Array(0), uvs: new Float32Array(0), smooth: [] });
}

export function buildCsgTorusGeometry(spec: CsgTorusSpec): THREE.BufferGeometry {
  const { sides, ringSides, smoothFaces, flipFaces } = spec;

  let minRadius = spec.innerRadius;
  let maxRadius = spec.outerRadius;

  // Godot bails outright rather than clamping: equal radii is a zero-thickness ring.
  if (minRadius === maxRadius) return emptyGeometry();
  // Inverted radii SWAP rather than clamp, so a torus authored the wrong way round still
  // renders the ring the user meant.
  if (minRadius > maxRadius) [minRadius, maxRadius] = [maxRadius, minRadius];

  if (
    !Number.isFinite(sides) ||
    !Number.isFinite(ringSides) ||
    sides < MIN_SEGMENTS ||
    ringSides < MIN_SEGMENTS
  ) {
    return emptyGeometry();
  }

  const tube = (maxRadius - minRadius) * 0.5;
  const centre = minRadius + tube;

  const faceCount = ringSides * sides * 2;
  const positions = new Float32Array(faceCount * 9);
  const uvs = new Float32Array(faceCount * 6);
  const smooth: boolean[] = new Array(faceCount).fill(smoothFaces);

  let face = 0;
  const put = (p: [number, number, number][], u: [number, number][]): void => {
    for (let j = 0; j < 3; j++) {
      positions.set(p[j]!, face * 9 + j * 3);
      uvs.set(u[j]!, face * 6 + j * 2);
    }
    face++;
  };

  for (let i = 0; i < sides; i++) {
    const inci = i / sides;
    // Both loops snap the final step back to 0 so the seams close on the exact same
    // float. The normal accumulation keys on position, so a seam off by one ulp would
    // stop smoothing across it and leave a visible crease.
    const inciN = i === sides - 1 ? 0 : (i + 1) / sides;
    const angi = inci * Math.PI * 2;
    const angiN = inciN * Math.PI * 2;

    // The ring sweeps in XZ, so the hole axis is +Y.
    const ni: [number, number] = [Math.cos(angi), Math.sin(angi)];
    const niN: [number, number] = [Math.cos(angiN), Math.sin(angiN)];

    for (let j = 0; j < ringSides; j++) {
      const incj = j / ringSides;
      const incjN = j === ringSides - 1 ? 0 : (j + 1) / ringSides;
      const angj = incj * Math.PI * 2;
      const angjN = incjN * Math.PI * 2;

      // Cross-section in (radial distance, Y), offset out to the ring centre.
      const nj: [number, number] = [Math.cos(angj) * tube + centre, Math.sin(angj) * tube];
      const njN: [number, number] = [Math.cos(angjN) * tube + centre, Math.sin(angjN) * tube];

      const fp: [number, number, number][] = [
        [ni[0] * nj[0], nj[1], ni[1] * nj[0]],
        [ni[0] * njN[0], njN[1], ni[1] * njN[0]],
        [niN[0] * njN[0], njN[1], niN[1] * njN[0]],
        [niN[0] * nj[0], nj[1], niN[1] * nj[0]],
      ];
      const u: [number, number][] = [
        [inci, incj],
        [inci, incjN],
        [inciN, incjN],
        [inciN, incj],
      ];

      put([fp[0]!, fp[2]!, fp[1]!], [u[0]!, u[2]!, u[1]!]);
      put([fp[3]!, fp[2]!, fp[0]!], [u[3]!, u[2]!, u[0]!]);
    }
  }

  return applyCsgNormals({ positions, uvs, smooth, invert: flipFaces } satisfies CsgFaceSoup);
}
