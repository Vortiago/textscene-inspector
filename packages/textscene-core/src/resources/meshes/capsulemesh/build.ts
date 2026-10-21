/**
 * CapsuleMesh surface, ported from Godot 4.6.3 `CapsuleMesh::create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:410-609`): a top hemisphere, a cylinder and a bottom
 * hemisphere, each its own grid of rows, U from -Z towards -X, and V a third per section.
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

import { storedReal } from '../../../godot/math/real.js';
import type { GodotSurface } from '../godotSurface.js';
import { rimPoint } from '../primitivemesh/rimPoint.js';
import { ONE_THIRD, SurfaceWriter, TWO_THIRDS } from '../primitivemesh/surfaceWriter.js';
import type { CapsuleMeshProperties } from './types.js';

/** One section's vertex at row fraction `v`, on the unit circle point `(x, z)` round the axis. */
type SectionVertex = (
  v: number,
  lastRow: boolean,
  x: number,
  z: number
) => {
  position: [number, number, number];
  normal: [number, number, number];
  uvV: number;
  uv2V: number;
};

/** `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). */
export function buildCapsuleMeshSurface(p: CapsuleMeshProperties, uv2Padding: number | null): GodotSurface {
  const { radius, height, radialSegments, rings } = p;
  const middle = height - 2 * radius;
  const capCentre = 0.5 * height - radius;
  const storedCapCentre = storedReal(capCentre);

  // UV2 lays the capsule out by length, padded on the right and the bottom (`:416-422`).
  const padding = uv2Padding ?? 0;
  // Godot holds each value below in a `float`, and does `float` arithmetic on two of them, so each
  // such step rounds to single precision. A step with a `double` constant such as PI does not.
  const radialWidth = storedReal(2 * radius * Math.PI);
  const radialH = storedReal(radialWidth / (radialWidth + padding));
  const radialLength = storedReal(radius * Math.PI * 0.5);
  const verticalLength = storedReal(radialLength * 2 + (height - 2 * radius) + padding);
  const radialV = storedReal(radialLength / verticalLength);
  const heightV = storedReal((height - 2 * radius) / verticalLength);

  const writer = new SurfaceWriter(uv2Padding !== null);
  const section = (vertexAt: SectionVertex): void => {
    let thisrow = writer.vertexCount;
    let prevrow = 0;
    for (let j = 0; j <= rings + 1; j++) {
      const v = storedReal(j / (rings + 1));
      for (let i = 0; i <= radialSegments; i++) {
        const u = storedReal(i / radialSegments);
        const [sine, z] = rimPoint(i, radialSegments);
        const x = -sine;
        const { position, normal, uvV, uv2V } = vertexAt(v, j === rings + 1, x, z);
        writer.vertex(position, normal, [-z, 0, -x, 1], [u, uvV], [u * radialH, uv2V]);
        if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);
      }
      prevrow = thisrow;
      thisrow = writer.vertexCount;
    }
  };

  // The top hemisphere (`:451`).
  section((v, lastRow, x, z) => {
    const w = lastRow ? 1 : storedReal(Math.sin(0.5 * Math.PI * v));
    const y = lastRow ? 0 : storedReal(Math.cos(0.5 * Math.PI * v));
    const unit: [number, number, number] = [storedReal(x * w), y, storedReal(-z * w)];
    return {
      position: [unit[0] * radius, storedReal(unit[1] * radius) + storedCapCentre, unit[2] * radius],
      normal: unit,
      uvV: v * ONE_THIRD,
      uv2V: v * radialV,
    };
  });

  // The cylinder (`:503`).
  section((v, _lastRow, x, z) => ({
    position: [x * radius, storedReal(capCentre - storedReal(middle * v)), -z * radius],
    normal: [x, 0, -z],
    uvV: ONE_THIRD + storedReal(v * ONE_THIRD),
    uv2V: radialV + storedReal(v * heightV),
  }));

  // The bottom hemisphere (`:550`).
  section((v, lastRow, x, z) => {
    const w = lastRow ? 0 : storedReal(Math.cos(0.5 * Math.PI * v));
    const y = lastRow ? -1 : storedReal(-Math.sin(0.5 * Math.PI * v));
    const unit: [number, number, number] = [storedReal(x * w), y, storedReal(-z * w)];
    return {
      position: [unit[0] * radius, storedReal(unit[1] * radius) - storedCapCentre, unit[2] * radius],
      normal: unit,
      uvV: TWO_THIRDS + storedReal(v * ONE_THIRD),
      uv2V: storedReal(radialV + heightV) + storedReal(v * radialV),
    };
  });

  return writer.surface();
}
