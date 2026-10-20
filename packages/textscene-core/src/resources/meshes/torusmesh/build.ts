/**
 * TorusMesh surface, ported from Godot 4.6.3 `TorusMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:2203-2299`): a row round the tube for each step round
 * the Y axis, U round the axis from -Z towards -X and V round the tube from its inner edge.
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
import { warn } from '../../../logger.js';
import type { GodotSurface } from '../godotSurface.js';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter.js';
import type { TorusMeshProperties } from './types.js';

/**
 * `uv2Padding` is in world units, or null for a mesh with no UV2 (`add_uv2` off). Null for equal
 * radii, which Godot refuses to build (`:2232`).
 */
export function buildTorusMeshSurface(
  p: TorusMeshProperties,
  uv2Padding: number | null
): GodotSurface | null {
  const { innerRadius, outerRadius, rings, ringSegments } = p;
  if (innerRadius === outerRadius) {
    warn(`[TorusMesh] inner_radius equals outer_radius (${innerRadius}): Godot builds no surface for it`);
    return null;
  }
  // Godot holds each value below in a `float`, and does `float` arithmetic on two of them, so each
  // such step rounds to single precision. A step with a `double` constant such as TAU does not.
  const minRadius = Math.min(innerRadius, outerRadius);
  const maxRadius = Math.max(innerRadius, outerRadius);
  const radiusDelta = storedReal(maxRadius - minRadius);
  const tubeRadius = storedReal(radiusDelta * 0.5);
  const ringCentreRadius = storedReal(minRadius + tubeRadius);

  // UV2 lays each row out by its length round the axis, padded on the right and the bottom (`:2244-2250`).
  const padding = uv2Padding ?? 0;
  const horizontalTotal = storedReal(maxRadius * TAU + padding);
  const maxH = storedReal((maxRadius * TAU) / horizontalTotal);
  const deltaH = storedReal((radiusDelta * TAU) / horizontalTotal);
  const heightV = storedReal((tubeRadius * TAU) / (tubeRadius * TAU + padding));

  const writer = new SurfaceWriter(uv2Padding !== null);
  for (let i = 0; i <= rings; i++) {
    const prevrow = (i - 1) * (ringSegments + 1);
    const thisrow = i * (ringSegments + 1);
    const inci = storedReal(i / rings);
    const angi = storedReal(inci * TAU);
    const [normaliX, normaliY] =
      i === rings ? [0, -1] : [storedReal(-Math.sin(angi)), storedReal(-Math.cos(angi))];

    for (let j = 0; j <= ringSegments; j++) {
      const incj = storedReal(j / ringSegments);
      const angj = storedReal(incj * TAU);
      const [normaljX, normaljY] =
        j === ringSegments ? [-1, 0] : [storedReal(-Math.cos(angj)), storedReal(Math.sin(angj))];
      const normalkX = storedReal(storedReal(normaljX * tubeRadius) + ringCentreRadius);
      const normalkY = storedReal(normaljY * tubeRadius);
      const offsetH = storedReal(0.5 * (1 - normaljX) * deltaH);
      const adjH = storedReal(maxH - offsetH);

      writer.vertex(
        [normaliX * normalkX, normalkY, normaliY * normalkX],
        [normaliX * normaljX, normaljY, normaliY * normaljX],
        [normaliY, 0, -normaliX, 1],
        [inci, incj],
        [storedReal(offsetH * 0.5) + storedReal(inci * adjH), incj * heightV]
      );
      if (i > 0 && j > 0) {
        writer.triangle(thisrow + j - 1, prevrow + j, prevrow + j - 1);
        writer.triangle(thisrow + j - 1, thisrow + j, prevrow + j);
      }
    }
  }
  return writer.surface();
}
