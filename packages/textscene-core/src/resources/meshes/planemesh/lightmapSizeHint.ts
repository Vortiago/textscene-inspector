/**
 * A PlaneMesh's `lightmap_size_hint` once Godot's loader has set its properties in file order.
 * With `add_uv2` on, `_update_lightmap_size` (`primitive_meshes.cpp:1399-1410`) rewrites the hint
 * each time `add_uv2`, `uv2_padding` or `size` changes (`:311-327`, `:1525-1532`), so a stored
 * hint stands only when no such change follows it.
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

import { isEqualApprox } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import { boolOr, realOr, realVec2Or, vec2iOr } from '../../../parser/valueParsers.js';
import { decodePrimitiveMesh } from '../primitivemesh/decode.js';
import { PLANE_MESH_DEFAULTS, type PlaneMeshDefaults } from './decode.js';

/** `defaults` are the class's own, PlaneMesh's or its QuadMesh subclass's, as `decodePlaneMesh` takes them. */
export function planeMeshLightmapSizeHint(
  data: Record<string, string>,
  texelSize: number,
  defaults: PlaneMeshDefaults = PLANE_MESH_DEFAULTS
): Vector2 {
  let hint: Vector2 = { x: 0, y: 0 };
  let { addUv2, uv2Padding: padding } = decodePrimitiveMesh({});
  let size = defaults.size;

  for (const [key, value] of Object.entries(data)) {
    let changed = false;
    if (key === 'lightmap_size_hint') {
      hint = vec2iOr(value, hint, 'PlaneMesh lightmap_size_hint');
    } else if (key === 'add_uv2') {
      const next = boolOr(value, addUv2, 'PlaneMesh add_uv2');
      changed = next !== addUv2;
      addUv2 = next;
    } else if (key === 'uv2_padding') {
      const next = realOr(value, padding, 'PlaneMesh uv2_padding');
      changed = !isEqualApprox(next, padding);
      if (changed) padding = next;
    } else if (key === 'size') {
      const next = realVec2Or(value, size, 'PlaneMesh size');
      changed = next.x !== size.x || next.y !== size.y;
      size = next;
    }
    if (changed && addUv2)
      hint = { x: hintAxis(size.x, padding, texelSize), y: hintAxis(size.y, padding, texelSize) };
  }
  return hint;
}

/** `MAX(1.0, (size / texel_size) + padding)` in single precision, truncated into a `Size2i`. */
function hintAxis(size: number, padding: number, texelSize: number): number {
  return Math.trunc(Math.max(1, storedReal(storedReal(size / storedReal(texelSize)) + padding)));
}
