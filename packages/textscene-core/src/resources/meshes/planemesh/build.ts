/**
 * PlaneMesh surface, ported from Godot 4.6.3 `PlaneMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:1412-1498`). Its QuadMesh subclass shares it
 * (`primitive_meshes.h:286-294`): the decode supplies each one's defaults.
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
import { SurfaceWriter, type Vec3, type Vec4 } from '../primitivemesh/surfaceWriter.js';
import { PlaneMeshOrientation } from '../../../godot/scene/planeMesh.js';
import type { Vector3 } from '../../../godot/math/vector.js';
import type { PlaneMeshProperties } from './types.js';

/** Each orientation's normal and tangent (`:1420-1425`, `:1468-1472`). */
const FACES: Record<PlaneMeshOrientation, { normal: Vec3; tangent: Vec4 }> = {
  [PlaneMeshOrientation.FACE_X]: { normal: [1, 0, 0], tangent: [0, 0, -1, 1] },
  [PlaneMeshOrientation.FACE_Y]: { normal: [0, 1, 0], tangent: [1, 0, 0, 1] },
  [PlaneMeshOrientation.FACE_Z]: { normal: [0, 0, 1], tangent: [1, 0, 0, 1] },
};

/** No UV2: `PrimitiveMesh::_update` makes it from UV (`:1416`). */
export function buildPlaneMeshSurface(p: PlaneMeshProperties): GodotSurface {
  const { size, orientation } = p;
  const subdivideW = p.subdivideWidth;
  const subdivideD = p.subdivideDepth;
  const offset = p.centerOffset;
  const { normal, tangent } = FACES[orientation];

  const start = { x: size.x * -0.5, y: size.y * -0.5 };
  const writer = new SurfaceWriter(false);

  let z = start.y;
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= subdivideD + 1; j++) {
    let x = start.x;
    for (let i = 0; i <= subdivideW + 1; i++) {
      const u = i / (subdivideW + 1);
      const v = j / (subdivideD + 1);

      // 1 - UV matches the QuadMesh orientation, as Godot notes (`:1473`).
      writer.vertex(planePoint(orientation, x, z, offset), normal, tangent, [1 - u, 1 - v], [0, 0]);

      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);

      x += size.x / (subdivideW + 1);
    }

    z += size.y / (subdivideD + 1);
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }

  return writer.surface();
}

/** The point at grid `x`, `z` in the plane `orientation` faces, moved by `center_offset` (`:1460-1466`). */
function planePoint(orientation: PlaneMeshOrientation, x: number, z: number, offset: Vector3): Vec3 {
  if (orientation === PlaneMeshOrientation.FACE_X) return [offset.x, z + offset.y, x + offset.z];
  if (orientation === PlaneMeshOrientation.FACE_Y) return [-x + offset.x, offset.y, -z + offset.z];
  return [-x + offset.x, z + offset.y, offset.z];
}
