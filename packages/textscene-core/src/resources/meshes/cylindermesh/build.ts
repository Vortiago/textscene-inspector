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
import { BOTTOM_CAP, TOP_CAP, writeCapFan } from '../primitivemesh/capFan.js';
import { rimColumns, type RimColumn } from '../primitivemesh/rimPoint.js';
import { writeRings } from '../primitivemesh/rows.js';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter.js';
import type { CylinderMeshProperties } from './types.js';

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
  const rim = rimColumns(p.radialSegments);
  const writer = new SurfaceWriter(uv2Padding !== null);
  writeSide(writer, p, rim, layout);
  if (p.capTop && p.topRadius > 0) writeTopCap(writer, p, rim, layout);
  if (p.capBottom && p.bottomRadius > 0) writeBottomCap(writer, p, rim, layout);
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

/** The side as rings from the top edge down, U from +Z towards +X and V in the top half (`:1112-1160`). */
function writeSide(
  writer: SurfaceWriter,
  p: CylinderMeshProperties,
  rim: readonly RimColumn[],
  layout: Uv2Layout
): void {
  const { topRadius, bottomRadius, height } = p;
  const radiusStep = storedReal(bottomRadius - topRadius);
  const radiusHStep = storedReal(layout.sideBottomH - layout.sideTopH);
  const sideNormalY = storedReal(radiusStep / height);
  writeRings(writer, p.rings + 1, height, ({ v, y }) => {
    const radius = storedReal(topRadius + storedReal(radiusStep * v));
    const radiusH = storedReal(layout.sideTopH + storedReal(radiusHStep * v));
    for (const { x, z, u } of rim) {
      writer.vertex(
        [x * radius, y, z * radius],
        normalizedVector3(x, sideNormalY, z),
        [z, 0, -x, 1],
        [u, v * 0.5],
        [layout.sideCentreH + (u - 0.5) * radiusH, v * layout.heightV]
      );
    }
  });
}

/** The top cap, its UV2 on the left of the row below the side (`:1168-1213`). */
function writeTopCap(
  writer: SurfaceWriter,
  p: CylinderMeshProperties,
  rim: readonly RimColumn[],
  { topH, topV, capCentreV }: Uv2Layout
): void {
  writeCapFan(writer, rim, TOP_CAP, p.height * 0.5, p.topRadius, (x, z) => [
    topH + storedReal(x * topH),
    capCentreV + storedReal(z * topV),
  ]);
}

/** The bottom cap, its UV2 right of the top cap's with V mirrored (`:1216-1260`). */
function writeBottomCap(
  writer: SurfaceWriter,
  p: CylinderMeshProperties,
  rim: readonly RimColumn[],
  { bottomCentreH, bottomH, bottomV, capCentreV }: Uv2Layout
): void {
  writeCapFan(writer, rim, BOTTOM_CAP, p.height * -0.5, p.bottomRadius, (x, z) => [
    bottomCentreH + storedReal(x * bottomH),
    capCentreV - storedReal(z * bottomV),
  ]);
}
