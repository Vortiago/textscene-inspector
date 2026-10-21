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
import { rimPoint } from '../primitivemesh/rimPoint.js';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter.js';
import type { CylinderMeshProperties } from './types.js';

/** The tangent of every cap vertex (`:1175`). */
const CAP_TANGENT = [1, 0, 0, 1] as const;

/** Where the side and the two caps lie in UV2: the unrolled side above the two caps side by side. */
interface Uv2Layout {
  sideCentreH: number;
  sideTopH: number;
  sideBottomH: number;
  heightV: number;
  topH: number;
  topV: number;
  bottomCentreH: number;
  bottomH: number;
  bottomV: number;
  capCentreV: number;
}

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildCylinderMeshSurface(p: CylinderMeshProperties, uv2Padding: number | null): GodotSurface {
  const layout = uv2Layout(p, uv2Padding ?? 0);
  const writer = new SurfaceWriter(uv2Padding !== null);
  writeSide(writer, p, layout);
  if (p.capTop && p.topRadius > 0) writeTopCap(writer, p, layout);
  if (p.capBottom && p.bottomRadius > 0) writeBottomCap(writer, p, layout);
  return writer.surface();
}

/**
 * The UV2 islands, padded between each (`:1074-1085`, `:1159-1163`). Godot holds each in a `float`,
 * so each rounds to single precision.
 */
function uv2Layout(p: CylinderMeshProperties, padding: number): Uv2Layout {
  const { topRadius, bottomRadius, height } = p;
  const topCircumference = storedReal(topRadius * TAU);
  const bottomCircumference = storedReal(bottomRadius * TAU);
  const verticalLength = storedReal(height + Math.max(2 * topRadius, 2 * bottomRadius) + 2 * padding);
  const heightV = storedReal(height / verticalLength);
  const paddingV = storedReal(padding / verticalLength);
  const horizontalLength = storedReal(
    Math.max(
      2 * (topRadius + bottomRadius + padding),
      topCircumference + padding,
      bottomCircumference + padding
    )
  );
  const topH = storedReal(topRadius / horizontalLength);
  const topV = storedReal(topRadius / verticalLength);
  const bottomH = storedReal(bottomRadius / horizontalLength);
  const bottomV = storedReal(bottomRadius / verticalLength);
  return {
    sideCentreH: storedReal((0.5 * (horizontalLength - padding)) / horizontalLength),
    sideTopH: storedReal(topCircumference / horizontalLength),
    sideBottomH: storedReal(bottomCircumference / horizontalLength),
    heightV,
    topH,
    topV,
    bottomCentreH: storedReal(
      storedReal(storedReal(topH + topH) + storedReal(padding / horizontalLength)) + bottomH
    ),
    bottomH,
    bottomV,
    capCentreV: storedReal(storedReal(heightV + paddingV) + Math.max(topV, bottomV)),
  };
}

/** The side as rows from the top edge down, U from +Z towards +X and V in the top half (`:1114`). */
function writeSide(writer: SurfaceWriter, p: CylinderMeshProperties, layout: Uv2Layout): void {
  const { topRadius, bottomRadius, height, radialSegments, rings } = p;
  const sideNormalY = storedReal(storedReal(bottomRadius - topRadius) / height);
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= rings + 1; j++) {
    const v = storedReal(j / (rings + 1));
    const radius = storedReal(topRadius + storedReal(storedReal(bottomRadius - topRadius) * v));
    const radiusH = storedReal(
      layout.sideTopH + storedReal(storedReal(layout.sideBottomH - layout.sideTopH) * v)
    );
    const y = storedReal(height * 0.5 - storedReal(height * v));

    for (let i = 0; i <= radialSegments; i++) {
      const u = storedReal(i / radialSegments);
      const [x, z] = rimPoint(i, radialSegments);
      writer.vertex(
        [x * radius, y, z * radius],
        normalizedVector3(x, sideNormalY, z),
        [z, 0, -x, 1],
        [u, v * 0.5],
        [layout.sideCentreH + (u - 0.5) * radiusH, v * layout.heightV]
      );
      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);
    }

    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }
}

/** A fan facing up, centred on (0.25, 0.75) in UV (`:1169`). */
function writeTopCap(writer: SurfaceWriter, p: CylinderMeshProperties, layout: Uv2Layout): void {
  const { topRadius, radialSegments } = p;
  const { topH, topV, capCentreV } = layout;
  const y = p.height * 0.5;
  const centre = writer.vertexCount;
  writer.vertex([0, y, 0], [0, 1, 0], CAP_TANGENT, [0.25, 0.75], [topH, capCentreV]);
  for (let i = 0; i <= radialSegments; i++) {
    const [x, z] = rimPoint(i, radialSegments);
    writer.vertex(
      [x * topRadius, y, z * topRadius],
      [0, 1, 0],
      CAP_TANGENT,
      [storedReal((x + 1) * 0.25), storedReal(0.5 + (z + 1) * 0.25)],
      [topH + storedReal(x * topH), capCentreV + storedReal(z * topV)]
    );
    const point = writer.vertexCount;
    if (i > 0) writer.triangle(centre, point - 1, point - 2);
  }
}

/** A fan facing down, centred on (0.75, 0.75) in UV with V mirrored (`:1216`). */
function writeBottomCap(writer: SurfaceWriter, p: CylinderMeshProperties, layout: Uv2Layout): void {
  const { bottomRadius, radialSegments } = p;
  const { bottomCentreH, bottomH, bottomV, capCentreV } = layout;
  const y = p.height * -0.5;
  const centre = writer.vertexCount;
  writer.vertex([0, y, 0], [0, -1, 0], CAP_TANGENT, [0.75, 0.75], [bottomCentreH, capCentreV]);
  for (let i = 0; i <= radialSegments; i++) {
    const [x, z] = rimPoint(i, radialSegments);
    writer.vertex(
      [x * bottomRadius, y, z * bottomRadius],
      [0, -1, 0],
      CAP_TANGENT,
      [storedReal(0.5 + (x + 1) * 0.25), storedReal(1 - (z + 1) * 0.25)],
      [bottomCentreH + storedReal(x * bottomH), capCentreV - storedReal(z * bottomV)]
    );
    const point = writer.vertexCount;
    if (i > 0) writer.triangle(centre, point - 2, point - 1);
  }
}
