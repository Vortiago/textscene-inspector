/**
 * RibbonTrailMesh surface, ported from Godot 4.6.3 `RibbonTrailMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:2879-3004`, without the bone arrays): a row of two
 * vertices for each segment down the ribbon, or of four for a cross, where the second pair lies
 * across the first.
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
import { curveScaleSampler } from '../primitivemesh/curveScale.js';
import type { GodotSurface } from '../godotSurface.js';
import { SurfaceWriter, type Vec3, type Vec4 } from '../primitivemesh/surfaceWriter.js';
import type { RibbonTrailMeshProperties } from './types.js';

/** The tangent of every vertex (`:2946-2952`). */
const TANGENT: Vec4 = [0, 1, 0, 1];

/** The normal of the strip in the XY plane, and of the strip across it (`:2933-2938`). */
const FRONT_NORMAL: Vec3 = [0, 0, 1];
const CROSS_NORMAL: Vec3 = [1, 0, 0];

/**
 * No UV2: `PrimitiveMesh::_update` makes it from UV (`:2880`). No bone arrays: nothing here skins a
 * primitive, and Godot draws a mesh with no skin at the rest positions.
 */
export function buildRibbonTrailMeshSurface(p: RibbonTrailMeshProperties): GodotSurface {
  const totalSegments = p.sectionSegments * p.sections;
  const depth = storedReal(p.sectionLength * p.sections);
  // A curve with no point scales nothing (`:2922`).
  const widthScale = curveScaleSampler(p.curve);
  const verticesPerRow = p.isCross ? 4 : 2;

  const writer = new SurfaceWriter(false);
  for (let j = 0; j <= totalSegments; j++) {
    const v = storedReal(j / totalSegments);
    const y = storedReal(depth * 0.5 - storedReal(depth * v));
    const width = storedReal(p.size * widthScale(v));
    writeRow(writer, p.isCross, y, width, v);
    if (j > 0) writeQuads(writer, p.isCross, (j - 1) * verticesPerRow, verticesPerRow);
  }
  return writer.surface();
}

/** The vertices of one row (`:2926-2944`): the strip in the XY plane, then the strip across it. */
function writeRow(writer: SurfaceWriter, isCross: boolean, y: number, width: number, v: number): void {
  const half = width * 0.5;
  writer.vertex([-half, y, 0], FRONT_NORMAL, TANGENT, [0, v], [0, 0]);
  writer.vertex([half, y, 0], FRONT_NORMAL, TANGENT, [1, v], [0, 0]);
  if (!isCross) return;
  writer.vertex([0, y, -half], CROSS_NORMAL, TANGENT, [0, v], [0, 0]);
  writer.vertex([0, y, half], CROSS_NORMAL, TANGENT, [1, v], [0, 0]);
}

/** The triangles between the row that starts at vertex `base` and the next (`:2966-2994`). */
function writeQuads(writer: SurfaceWriter, isCross: boolean, base: number, nextRow: number): void {
  writer.triangle(base, base + 1, base + nextRow);
  writer.triangle(base + 1, base + nextRow + 1, base + nextRow);
  if (!isCross) return;
  writer.triangle(base + 2, base + 3, base + 6);
  writer.triangle(base + 3, base + 7, base + 6);
}
