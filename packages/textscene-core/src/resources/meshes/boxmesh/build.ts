/**
 * BoxMesh surface, ported from Godot 4.6.3 `BoxMesh::create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:724-966`): the six faces in a 3x2 UV atlas, front
 * and back, right and left, then top and bottom, each with one constant tangent.
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

import type { GodotSurface } from '../godotSurface.js';
import { ONE_THIRD, SurfaceWriter, TWO_THIRDS } from '../primitivemesh/surfaceWriter.js';
import type { BoxMeshProperties } from './types.js';

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildBoxMeshSurface(p: BoxMeshProperties, uv2Padding: number | null): GodotSurface {
  const { size } = p;
  const subdivideW = p.subdivideWidth;
  const subdivideH = p.subdivideHeight;
  const subdivideD = p.subdivideDepth;

  // UV2 puts three faces across and two down, a padding right of and below each (`:732-737`).
  const padding = uv2Padding ?? 0;
  const totalH = size.x + size.z + 2 * padding;
  const paddingH = padding / totalH;
  const widthH = size.x / totalH;
  const depthH = size.z / totalH;
  const totalV = size.y + size.y + Math.max(size.x, size.z) + 3 * padding;
  const paddingV = padding / totalV;
  const widthV = size.x / totalV;
  const heightV = size.y / totalV;
  const depthV = size.z / totalV;

  const start = { x: size.x * -0.5, y: size.y * -0.5, z: size.z * -0.5 };
  const writer = new SurfaceWriter(uv2Padding !== null);

  /* front + back */
  let y = start.y;
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    // Godot divides V2 by subdivide_w here, not subdivide_h (`:775`).
    const v2 = j / (subdivideW + 1);
    const v = j / (2 * (subdivideH + 1));

    let x = start.x;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u2 = i / (subdivideW + 1);
      const u = i / (3 * (subdivideW + 1));

      // The double negative on Z is Godot's own (`:785`).
      writer.vertex([x, -y, -start.z], [0, 0, 1], [1, 0, 0, 1], [u, v], [u2 * widthH, v2 * heightV]);
      writer.vertex(
        [-x, -y, start.z],
        [0, 0, -1],
        [-1, 0, 0, 1],
        [TWO_THIRDS + u, v],
        [u2 * widthH, heightV + paddingV + v2 * heightV]
      );

      if (i > 0 && j > 0) writer.quadPairBetweenRows(prevrow, thisrow, i);

      x += size.x / (subdivideW + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  /* right + left */
  y = start.y;
  thisrow = writer.vertexCount;
  prevrow = 0;
  for (let j = 0; j <= subdivideH + 1; j++) {
    const v2 = j / (subdivideH + 1);
    const v = j / (2 * (subdivideH + 1));

    let z = start.z;
    for (let i = 0; i <= subdivideD + 1; i++) {
      const u2 = i / (subdivideD + 1);
      const u = i / (3 * (subdivideD + 1));
      const uv2U = widthH + paddingH + u2 * depthH;

      writer.vertex([-start.x, -y, -z], [1, 0, 0], [0, 0, -1, 1], [ONE_THIRD + u, v], [uv2U, v2 * heightV]);
      writer.vertex(
        [start.x, -y, z],
        [-1, 0, 0],
        [0, 0, 1, 1],
        [u, 0.5 + v],
        [uv2U, heightV + paddingV + v2 * heightV]
      );

      if (i > 0 && j > 0) writer.quadPairBetweenRows(prevrow, thisrow, i);

      z += size.z / (subdivideD + 1);
    }

    y += size.y / (subdivideH + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  /* top + bottom */
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
        [-x, -start.y, -z],
        [0, 1, 0],
        [-1, 0, 0, 1],
        [ONE_THIRD + u, 0.5 + v],
        [u2 * widthH, uv2V + v2 * depthV]
      );
      // The bottom face's UV2 V runs by width_v (`:926`), as Godot writes it.
      writer.vertex(
        [x, start.y, -z],
        [0, -1, 0],
        [1, 0, 0, 1],
        [TWO_THIRDS + u, 0.5 + v],
        [widthH + paddingH + u2 * depthH, uv2V + v2 * widthV]
      );

      if (i > 0 && j > 0) writer.quadPairBetweenRows(prevrow, thisrow, i);

      x += size.x / (subdivideW + 1);
    }

    z += size.z / (subdivideD + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  return writer.surface();
}
