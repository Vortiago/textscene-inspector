/**
 * TubeTrailMesh surface, ported from Godot 4.6.3 `TubeTrailMesh::_create_mesh_array`
 * (`scene/resources/3d/primitive_meshes.cpp:2503-2741`, without the bone arrays): a row of
 * `radial_steps + 1` vertices for each ring down the tube, U round it from +Z towards +X and V down
 * the top half of the atlas, then a fan for each cap in the bottom half.
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

import { CMP_EPSILON } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { BOTTOM_CAP, TOP_CAP, writeCapFan } from '../primitivemesh/capFan.js';
import { curveScaleSampler } from '../primitivemesh/curveScale.js';
import type { GodotSurface } from '../godotSurface.js';
import { rimColumns, type RimColumn } from '../primitivemesh/rimPoint.js';
import { rowAt, writeRings } from '../primitivemesh/rows.js';
import { SurfaceWriter } from '../primitivemesh/surfaceWriter.js';
import type { TubeTrailMeshProperties } from './types.js';

/**
 * No UV2: `PrimitiveMesh::_update` makes it from UV. No bone arrays: nothing here skins a primitive,
 * and Godot draws a mesh with no skin at the rest positions.
 */
export function buildTubeTrailMeshSurface(p: TubeTrailMeshProperties): GodotSurface {
  const depth = storedReal(p.sectionLength * p.sections);
  // A curve with no point scales nothing (`:2552`).
  const radiusScale = curveScaleSampler(p.curve);
  const rim = rimColumns(p.radialSteps);

  const writer = new SurfaceWriter(false);
  writeBody(writer, p, rim, depth, radiusScale);
  // A cap is built only where the curve leaves a scale above `CMP_EPSILON` (`:2596`, `:2680`).
  const topRadius = capRadius(p.radius, radiusScale(0));
  const bottomRadius = capRadius(p.radius, radiusScale(1));
  if (p.capTop && topRadius !== null) writeCapFan(writer, rim, TOP_CAP, depth * 0.5, topRadius);
  if (p.capBottom && bottomRadius !== null) writeCapFan(writer, rim, BOTTOM_CAP, depth * -0.5, bottomRadius);
  return writer.surface();
}

type RadiusScale = (v: number) => number;

/** The tube as rings from the top down (`:2536-2594`). */
function writeBody(
  writer: SurfaceWriter,
  p: TubeTrailMeshProperties,
  rim: readonly RimColumn[],
  depth: number,
  radiusScale: RadiusScale
): void {
  const rowCount = p.sectionRings * p.sections;
  writeRings(writer, rowCount, (j) => {
    const { v, y } = rowAt(j, rowCount, depth);
    const rowRadius = storedReal(p.radius * radiusScale(v));
    for (const { x, z, u } of rim) {
      writer.vertex([x * rowRadius, y, z * rowRadius], [x, 0, z], [z, 0, -x, 1], [u, v * 0.5], [0, 0]);
    }
  });
}

/** The radius of a cap at a curve scale, or null where the scale leaves no cap. */
function capRadius(radius: number, scale: number): number | null {
  return scale > CMP_EPSILON ? storedReal(radius * scale) : null;
}
