/**
 * PrismMesh surface, ported from Godot 4.6.3 `PrismMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:1610-1873`): a triangle in the XY plane, apex at the
 * top, extruded along Z, with BoxMesh's atlas less the top face.
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

import { normalizedVector3 } from '../../../godot/math/vector.js';
import type { GodotSurface } from '../godotSurface.js';
import { ONE_THIRD, SurfaceWriter, TWO_THIRDS } from '../primitivemesh/surfaceWriter.js';
import type { PrismMeshProperties } from './types.js';

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildPrismMeshSurface(p: PrismMeshProperties, uv2Padding: number | null): GodotSurface {
  const { size, leftToRight } = p;
  const subdivideW = p.subdivideWidth;
  const subdivideH = p.subdivideHeight;
  const subdivideD = p.subdivideDepth;

  // UV2 puts the caps and the sides in two columns, a padding right of and below each (`:1618-1628`).
  const padding = uv2Padding ?? 0;
  const horizontalTotal = size.x + size.z + 2 * padding;
  const widthH = size.x / horizontalTotal;
  const depthH = size.z / horizontalTotal;
  const paddingH = padding / horizontalTotal;
  const verticalTotal = size.y + size.y + size.z + 3 * padding;
  const heightV = size.y / verticalTotal;
  const depthV = size.z / verticalTotal;
  const paddingV = padding / verticalTotal;

  const start = { x: size.x * -0.5, y: size.y * -0.5, z: size.z * -0.5 };
  const writer = new SurfaceWriter(uv2Padding !== null);

  /* front + back: the triangular caps, apex X by `left_to_right` (`:1663-1670`) */
  let y = start.y;
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    const scale = j / (subdivideH + 1);
    const scaledSizeX = size.x * scale;
    const startX = start.x + (1 - scale) * size.x * leftToRight;
    const offsetFront = (1 - scale) * ONE_THIRD * leftToRight;
    const offsetBack = (1 - scale) * ONE_THIRD * (1 - leftToRight);
    const v = j / (2 * (subdivideH + 1));

    let x = 0;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u2 = i / (subdivideW + 1);
      const u = (i / (3 * (subdivideW + 1))) * scale;

      // The double negative on Z is Godot's own (`:1687`).
      writer.vertex(
        [startX + x, -y, -start.z],
        [0, 0, 1],
        [1, 0, 0, 1],
        [offsetFront + u, v],
        [u2 * scale * widthH, scale * heightV]
      );
      writer.vertex(
        [startX + scaledSizeX - x, -y, start.z],
        [0, 0, -1],
        [-1, 0, 0, 1],
        [TWO_THIRDS + offsetBack + u, v],
        [u2 * scale * widthH, heightV + paddingV + scale * heightV]
      );

      const i2 = i * 2;
      if (i > 0 && j === 1) {
        // The row below is the collapsed apex, so each quad is one triangle, the
        // fan Godot emits at `j == 1` (`:1706`).
        writer.triangle(prevrow + i2, thisrow + i2, thisrow + i2 - 2);
        writer.triangle(prevrow + i2 + 1, thisrow + i2 + 1, thisrow + i2 - 1);
      } else if (i > 0 && j > 0) {
        writer.quadPairBetweenRows(prevrow, thisrow, i);
      }

      x += (scale * size.x) / (subdivideW + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  /* right + left: the slanted sides, whose normals tilt with `left_to_right` (`:1746-1752`) */
  const normalLeft = normalizedVector3(-size.y, size.x * leftToRight, 0);
  const normalRight = normalizedVector3(size.y, size.x * (1 - leftToRight), 0);

  y = start.y;
  thisrow = writer.vertexCount;
  prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    const scale = j / (subdivideH + 1);
    const left = start.x + size.x * (1 - scale) * leftToRight;
    const right = left + size.x * scale;
    const v = j / (2 * (subdivideH + 1));

    let z = start.z;
    for (let i = 0; i <= subdivideD + 1; i++) {
      const u2 = i / (subdivideD + 1);
      const u = i / (3 * (subdivideD + 1));
      const uv2U = widthH + paddingH + u2 * depthH;

      writer.vertex([right, -y, -z], normalRight, [0, 0, -1, 1], [ONE_THIRD + u, v], [uv2U, scale * heightV]);
      writer.vertex(
        [left, -y, z],
        normalLeft,
        [0, 0, 1, 1],
        [u, 0.5 + v],
        [uv2U, heightV + paddingV + scale * heightV]
      );

      if (i > 0 && j > 0) writer.quadPairBetweenRows(prevrow, thisrow, i);

      z += size.z / (subdivideD + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  /* bottom: the rectangular base (`:1822`) */
  const uv2V = (heightV + paddingV) * 2;
  let z = start.z;
  thisrow = writer.vertexCount;
  prevrow = 0;
  for (let j = 0; j <= subdivideD + 1; j++) {
    const v2 = j / (subdivideD + 1);
    const v = j / (2 * (subdivideD + 1));

    let x = start.x;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u2 = i / (subdivideW + 1);
      const u = i / (3 * (subdivideW + 1));

      writer.vertex(
        [x, start.y, -z],
        [0, -1, 0],
        [1, 0, 0, 1],
        [TWO_THIRDS + u, 0.5 + v],
        [u2 * widthH, uv2V + v2 * depthV]
      );

      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);

      x += size.x / (subdivideW + 1);
    }

    z += size.z / (subdivideD + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  return writer.surface();
}
