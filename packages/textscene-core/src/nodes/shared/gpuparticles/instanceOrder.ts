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
): number[] | null {
  switch (drawOrder) {
    case GpuDrawOrder.LIFETIME:
      return rowsBySlot(input, lifetimeSlot(input, false));
    case GpuDrawOrder.REVERSE_LIFETIME:
      return rowsBySlot(input, lifetimeSlot(input, true));
    case GpuDrawOrder.VIEW_DEPTH:
      return depthOf ? rowsByDepth(input.indices.length, depthOf) : null;
    default:
      return null;
  }
}

/**
 * The slot a particle is drawn at. The shader reads slot `s` from particle `src(s)`: it starts
 * `split` in, wraps at `limit`, and reads the slots backwards for REVERSE_LIFETIME. This is the inverse.
 */
function lifetimeSlot({ phase, amount }: OrderInput, reverse: boolean): (particle: number) => number {
  const split = (Math.min(Math.trunc(amount * phase), amount - 1) + 1) % amount;
  const limit = amount - split;
  return (particle) => {
    const slot = particle >= split ? particle - split : particle + limit;
    return reverse ? amount - 1 - slot : slot;
  };
}

function rowsBySlot({ indices }: OrderInput, slotOf: (particle: number) => number): number[] {
  const slots = Array.from(indices, slotOf);
  return rowsOf(indices.length).sort((a, b) => slots[a]! - slots[b]!);
}

/** Far to near: ascending along the axis toward the viewer. `sort` is stable, so equal depths keep the index order. */
function rowsByDepth(count: number, depthOf: (row: number) => number): number[] {
  const depths = Array.from({ length: count }, (_, row) => depthOf(row));
  return rowsOf(count).sort((a, b) => depths[a]! - depths[b]!);
}

function rowsOf(count: number): number[] {
  return Array.from({ length: count }, (_, row) => row);
}
