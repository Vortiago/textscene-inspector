/**
 * SphereMesh surface, ported from Godot 4.6.3 `SphereMesh::create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:1983-2088`): rows from the top pole down, U from +Z
 * towards +X, `height` squashing Y, and a hemisphere's lower rows folded onto a flat base.
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
import type { SphereMeshProperties } from './types.js';

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildSphereMeshSurface(p: SphereMeshProperties, uv2Padding: number | null): GodotSurface {
  const { radius, height, radialSegments, rings, isHemisphere } = p;
  const scale = (height / radius) * (isHemisphere ? 1 : 0.5);

  // UV2 lays the sphere out as one island, padded on the right and the bottom (`:1989-1993`).
  const padding = uv2Padding ?? 0;
  const circumference = radius * TAU;
  const centerH = (0.5 * circumference) / (circumference + padding);
  const heightV = (scale * Math.PI) / (scale * Math.PI + padding / radius);

  const writer = new SurfaceWriter(uv2Padding !== null);
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= rings + 1; j++) {
    const v = j / (rings + 1);
    const lastRow = j === rings + 1;
    const w = lastRow ? 0 : Math.sin(Math.PI * v);
    const y = lastRow ? -1 : Math.cos(Math.PI * v);

    for (let i = 0; i <= radialSegments; i++) {
      const u = storedReal(i / radialSegments);
      const [x, z] = rimPoint(i, radialSegments);

      const folded = isHemisphere && y < 0;
      const position: [number, number, number] = folded
        ? [x * radius * w, 0, z * radius * w]
        : [x * w * radius, y * scale * radius, z * w * radius];
      const normal = folded ? ([0, -1, 0] as const) : normalizedVector3(x * w * scale, y, z * w * scale);
      const wH = w * 2 * centerH;
      writer.vertex(position, normal, [z, 0, -x, 1], [u, v], [centerH + (u - 0.5) * wH, v * heightV]);

      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);
    }

    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }
  return writer.surface();
}
