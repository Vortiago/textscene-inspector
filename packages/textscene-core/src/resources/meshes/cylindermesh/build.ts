/**
 * CylinderMesh surface, ported from Godot 4.6.3 `CylinderMesh::create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:1070-1260`): the side as rows from the top edge down,
 * U from +Z towards +X and V in the top half of the UV atlas, then a fan for each cap below it.
 *
 * Derived from Godot Engine (`scene/resources/3d/primitive_meshes.cpp`), used under the MIT licence:
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
 */

import { TAU } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { normalizedVector3 } from '../../../godot/math/vector.js';
import type { GodotSurface } from '../godotSurface.js';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter.js';
import type { CylinderMeshProperties } from './types.js';

/** The tangent of every cap vertex (`:1175`). */
const CAP_TANGENT = [1, 0, 0, 1] as const;

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildCylinderMeshSurface(p: CylinderMeshProperties, uv2Padding: number | null): GodotSurface {
  const { topRadius, bottomRadius, height, radialSegments, rings } = p;

  // UV2 puts the unrolled side above the two caps, padded between each island (`:1074-1085`).
  const padding = uv2Padding ?? 0;
  const topCircumference = topRadius * TAU;
  const bottomCircumference = bottomRadius * TAU;
  const verticalLength = height + Math.max(2 * topRadius, 2 * bottomRadius) + 2 * padding;
  const heightV = height / verticalLength;
  const paddingV = padding / verticalLength;
  const horizontalLength = Math.max(
    2 * (topRadius + bottomRadius + padding),
    topCircumference + padding,
    bottomCircumference + padding
  );
  const centerH = (0.5 * (horizontalLength - padding)) / horizontalLength;
  const sideTopH = topCircumference / horizontalLength;
  const sideBottomH = bottomCircumference / horizontalLength;
  const paddingH = padding / horizontalLength;

  const writer = new SurfaceWriter(uv2Padding !== null);
  let thisrow = 0;
  let prevrow = 0;
  const sideNormalY = storedReal((bottomRadius - topRadius) / height);
  for (let j = 0; j <= rings + 1; j++) {
    const v = j / (rings + 1);
    const radius = topRadius + (bottomRadius - topRadius) * v;
    const radiusH = sideTopH + (sideBottomH - sideTopH) * v;
    const y = height * 0.5 - height * v;

    for (let i = 0; i <= radialSegments; i++) {
      const u = storedReal(i / radialSegments);
      const [x, z] = rimPoint(i, radialSegments);
      writer.vertex(
        [x * radius, y, z * radius],
        normalizedVector3(x, sideNormalY, z),
        [z, 0, -x, 1],
        [u, v * 0.5],
        [centerH + (u - 0.5) * radiusH, v * heightV]
      );
      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);
    }

    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  // Each cap is a disc of its own radius in UV2, below the side (`:1159-1163`).
  const topH = topRadius / horizontalLength;
  const topV = topRadius / verticalLength;
  const bottomH = bottomRadius / horizontalLength;
  const bottomV = bottomRadius / verticalLength;
  const capCentreV = heightV + paddingV + Math.max(topV, bottomV);

  if (p.capTop && topRadius > 0) {
    const y = height * 0.5;
    const centre = writer.vertexCount;
    writer.vertex([0, y, 0], [0, 1, 0], CAP_TANGENT, [0.25, 0.75], [topH, capCentreV]);
    for (let i = 0; i <= radialSegments; i++) {
      const [x, z] = rimPoint(i, radialSegments);
      writer.vertex(
        [x * topRadius, y, z * topRadius],
        [0, 1, 0],
        CAP_TANGENT,
        [(x + 1) * 0.25, 0.5 + (z + 1) * 0.25],
        [topH + x * topH, capCentreV + z * topV]
      );
      const point = writer.vertexCount;
      if (i > 0) writer.triangle(centre, point - 1, point - 2);
    }
  }

  if (p.capBottom && bottomRadius > 0) {
    const y = height * -0.5;
    const centreH = topH + topH + paddingH + bottomH;
    const centre = writer.vertexCount;
    writer.vertex([0, y, 0], [0, -1, 0], CAP_TANGENT, [0.75, 0.75], [centreH, capCentreV]);
    for (let i = 0; i <= radialSegments; i++) {
      const [x, z] = rimPoint(i, radialSegments);
      writer.vertex(
        [x * bottomRadius, y, z * bottomRadius],
        [0, -1, 0],
        CAP_TANGENT,
        [0.5 + (x + 1) * 0.25, 1 - (z + 1) * 0.25],
        [centreH + x * bottomH, capCentreV - z * bottomV]
      );
      const point = writer.vertexCount;
      if (i > 0) writer.triangle(centre, point - 2, point - 1);
    }
  }

  return writer.surface();
}

/**
 * The unit circle point `(x, z)` of rim vertex `i`. The seam vertex closes on `(0, 1)` exactly.
 * Godot holds the fraction and the point in a `float`, so each rounds to single precision.
 */
function rimPoint(i: number, radialSegments: number): [number, number] {
  if (i === radialSegments) return [0, 1];
  const angle = storedReal(i / radialSegments) * TAU;
  return [storedReal(Math.sin(angle)), storedReal(Math.cos(angle))];
}
