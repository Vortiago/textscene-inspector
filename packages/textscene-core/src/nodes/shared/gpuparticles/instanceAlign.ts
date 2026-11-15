/**
 * The basis of a particle the copy shader turns for `transform_align` (`particles_copy.glsl:156-195`):
 * to face the camera, to follow the velocity, or both.
 *
 * Derived from Godot Engine (`servers/rendering/renderer_rd/shaders/particles_copy.glsl`), used
 * under the MIT licence:
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
 *
 * See THIRD-PARTY-NOTICES.md.
 */
import { GpuTransformAlign } from '../../../godot/scene/particles3d';
import { cross, dot, length, normalize, scale, subtract, type Float3 } from './float3';

/** A basis as its three columns. */
export type Columns = [Float3, Float3, Float3];

/** What the alignment reads of the view, in the space the particles simulate in. */
export interface AlignView {
  /** The sort direction: the camera's +Z axis (`sort_direction`). */
  direction: Float3;
  /** The camera's +Y axis (`align_up`). */
  up: Float3;
}

/** Turns `columns` in place for `transformAlign`, given the particle's `velocity`. */
export function alignColumns(
  transformAlign: number,
  columns: Columns,
  velocity: Float3,
  view: AlignView | null
): void {
  if (transformAlign === GpuTransformAlign.Y_TO_VELOCITY) return yToVelocity(columns, velocity);
  if (!view) return;
  switch (transformAlign) {
    case GpuTransformAlign.Z_BILLBOARD:
      return facing(columns, view);
    case GpuTransformAlign.Z_BILLBOARD_Y_TO_VELOCITY:
      return facingAlongScreenVelocity(columns, velocity, view);
  }
}

/** `local = mat3(normalize(cross(up, dir)), up, dir)` then `local * basis`. */
function facing(columns: Columns, { direction, up }: AlignView): void {
  const axes: Columns = [normalize(cross(up, direction)), up, direction];
  for (const column of columns) {
    const [x, y, z] = column;
    for (let row = 0; row < 3; row++) {
      column[row] = axes[0][row]! * x + axes[1][row]! * y + axes[2][row]! * z;
    }
  }
}

/** Y along the velocity (its own Y for a particle at rest), X across it, Z to the world Z; each at the mean scale. */
function yToVelocity(columns: Columns, velocity: Float3): void {
  const [x, y, z] = columns;
  const meanScale = (length(x) + length(y) + length(z)) / 3;
  const up = length(velocity) > 0 ? normalize(velocity) : normalize(y);
  columns[0] = scale(normalize(cross(up, z)), meanScale);
  columns[1] = scale(up, meanScale);
  columns[2] = [0, 0, meanScale];
}

/** Z to the camera and Y along the velocity on screen, each axis at its own length. */
function facingAlongScreenVelocity(columns: Columns, velocity: Float3, { direction, up }: AlignView): void {
  const [x, y, z] = columns;
  const onScreen = subtract(velocity, scale(direction, dot(direction, velocity)));
  const screenUp = normalize(length(onScreen) === 0 ? up : onScreen);
  columns[0] = scale(normalize(cross(screenUp, direction)), length(x));
  columns[1] = scale(screenUp, length(y));
  columns[2] = scale(direction, length(z));
}
