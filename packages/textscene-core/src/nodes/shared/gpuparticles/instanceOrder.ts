/**
 * The order the copy shader draws the particle slots in (`particles_copy.glsl:78-140`): the index
 * order, the lifetime order of the system phase, or the order along the view axis.
 *
 * Derived from Godot Engine (`servers/rendering/renderer_rd/shaders/particles_copy.glsl` and `servers/rendering/renderer_rd/storage_rd/particles_storage.cpp`), used
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

import { GpuDrawOrder } from '../../../godot/scene/particles3d';

/** What the order reads of the settled particles. */
export interface OrderInput {
  /** The system phase after the last step. */
  phase: number;
  /** The particle index of each live particle. */
  indices: Int32Array;
  /** The particle count of the emitter, dead slots included. */
  amount: number;
}

/**
 * The live rows in draw order, or null for the index order. `depthOf` gives the position of a row
 * along the view axis, and is null before the camera is known.
 */
export function rowsInDrawOrder(
  drawOrder: number,
  input: OrderInput,
  depthOf: ((row: number) => number) | null
): Int32Array | null {
  const { indices } = input;
  switch (drawOrder) {
    case GpuDrawOrder.LIFETIME: {
      const slotOf = lifetimeSlot(input);
      return rowsSortedBy(indices.length, (row) => slotOf(indices[row]!));
    }
    case GpuDrawOrder.REVERSE_LIFETIME: {
      const slotOf = lifetimeSlot(input);
      return rowsSortedBy(indices.length, (row) => input.amount - 1 - slotOf(indices[row]!));
    }
    case GpuDrawOrder.VIEW_DEPTH:
      return depthOf ? rowsSortedBy(indices.length, depthOf) : null;
    default:
      return null;
  }
}

/**
 * The slot a particle is drawn at. The shader reads slot `s` from particle `src(s)`: it starts
 * `split` in and wraps at `limit`. This is the inverse.
 */
function lifetimeSlot({ phase, amount }: OrderInput): (particle: number) => number {
  const split = (Math.min(Math.trunc(amount * phase), amount - 1) + 1) % amount;
  const limit = amount - split;
  return (particle) => (particle >= split ? particle - split : particle + limit);
}

/** The rows by ascending key. `sort` is stable, so equal keys keep the index order. */
function rowsSortedBy(count: number, keyOf: (row: number) => number): Int32Array {
  const keys = new Float64Array(count);
  const rows = new Int32Array(count);
  for (let row = 0; row < count; row++) {
    keys[row] = keyOf(row);
    rows[row] = row;
  }
  return rows.sort((a, b) => keys[a]! - keys[b]!);
}
