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
import { bakedCurveSampler } from '../../curves/curve/bakedSample.js';
import type { GodotSurface } from '../godotSurface.js';
import { rimPoint } from '../primitivemesh/rimPoint.js';
import { SurfaceWriter, type Vec4 } from '../primitivemesh/surfaceWriter.js';
import type { TubeTrailMeshProperties } from './types.js';

/** The tangent of every cap vertex (`:2587`). */
const CAP_TANGENT: Vec4 = [1, 0, 0, 1];

/** Column `i` of every ring: its point on the unit circle, and its U. */
interface RimColumn {
  x: number;
  z: number;
  u: number;
}

/**
 * No UV2: `PrimitiveMesh::_update` makes it from UV. No bone arrays: nothing here skins a primitive,
 * and Godot draws a mesh with no skin at the rest positions.
 */
export function buildTubeTrailMeshSurface(p: TubeTrailMeshProperties): GodotSurface {
  const depth = storedReal(p.sectionLength * p.sections);
  // A curve with no point scales nothing (`:2552`).
  const radiusScale = p.curve && p.curve.points.length > 0 ? bakedCurveSampler(p.curve) : () => 1;
  // Each ring repeats the columns, so they are computed once.
  const rim = rimColumns(p.radialSteps);

  const writer = new SurfaceWriter(false);
  writeBody(writer, p, rim, depth, radiusScale);
  // A cap is built only where the curve leaves a scale above `CMP_EPSILON` (`:2596`, `:2680`).
  const topScale = radiusScale(0);
  const bottomScale = radiusScale(1);
  if (p.capTop && topScale > CMP_EPSILON)
    writeTopCap(writer, rim, depth * 0.5, storedReal(p.radius * topScale));
  if (p.capBottom && bottomScale > CMP_EPSILON)
    writeBottomCap(writer, rim, depth * -0.5, storedReal(p.radius * bottomScale));
  return writer.surface();
}

function rimColumns(radialSteps: number): RimColumn[] {
  return Array.from({ length: radialSteps + 1 }, (_, i) => {
    const [x, z] = rimPoint(i, radialSteps);
    return { x, z, u: storedReal(i / radialSteps) };
  });
}

type RadiusScale = (v: number) => number;

/** The tube as rows from the top down, one per ring (`:2536-2578`). */
function writeBody(
  writer: SurfaceWriter,
  p: TubeTrailMeshProperties,
  rim: readonly RimColumn[],
  depth: number,
  radiusScale: RadiusScale
): void {
  const totalRings = p.sectionRings * p.sections;
  let thisrow = 0;
  let prevrow = 0;
  for (let j = 0; j <= totalRings; j++) {
    const v = storedReal(j / totalRings);
    const y = storedReal(depth * 0.5 - storedReal(depth * v));
    const rowRadius = storedReal(p.radius * radiusScale(v));

    rim.forEach(({ x, z, u }, i) => {
      writer.vertex([x * rowRadius, y, z * rowRadius], [x, 0, z], [z, 0, -x, 1], [u, v * 0.5], [0, 0]);
      if (i > 0 && j > 0) writer.quadBetweenRows(prevrow, thisrow, i);
    });
    prevrow = thisrow;
    thisrow = writer.vertexCount;
  }
}

/** A fan facing up, centred on (0.25, 0.75) in UV (`:2596-2677`). */
function writeTopCap(writer: SurfaceWriter, rim: readonly RimColumn[], y: number, capRadius: number): void {
  const centre = writer.vertexCount;
  writer.vertex([0, y, 0], [0, 1, 0], CAP_TANGENT, [0.25, 0.75], [0, 0]);
  rim.forEach(({ x, z }, i) => {
    writer.vertex(
      [x * capRadius, y, z * capRadius],
      [0, 1, 0],
      CAP_TANGENT,
      [storedReal((x + 1) * 0.25), storedReal(0.5 + (z + 1) * 0.25)],
      [0, 0]
    );
    const point = writer.vertexCount;
    if (i > 0) writer.triangle(centre, point - 1, point - 2);
  });
}

/** A fan facing down, centred on (0.75, 0.75) in UV with V mirrored (`:2680-2732`). */
function writeBottomCap(
  writer: SurfaceWriter,
  rim: readonly RimColumn[],
  y: number,
  capRadius: number
): void {
  const centre = writer.vertexCount;
  writer.vertex([0, y, 0], [0, -1, 0], CAP_TANGENT, [0.75, 0.75], [0, 0]);
  rim.forEach(({ x, z }, i) => {
    writer.vertex(
      [x * capRadius, y, z * capRadius],
      [0, -1, 0],
      CAP_TANGENT,
      [storedReal(0.5 + (x + 1) * 0.25), storedReal(1 - (z + 1) * 0.25)],
      [0, 0]
    );
    const point = writer.vertexCount;
    if (i > 0) writer.triangle(centre, point - 2, point - 1);
  });
}
