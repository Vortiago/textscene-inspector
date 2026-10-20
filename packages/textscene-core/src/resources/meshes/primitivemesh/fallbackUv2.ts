/**
 * The UV2 `PrimitiveMesh::_update` makes for a builder that writes none (`primitive_meshes.cpp:100-118`):
 * the UV scaled by `get_uv2_scale`, which pads only the right and bottom edges.
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

import type { Vector2 } from '../../../godot/math/vector.js';
import { primitiveMeshUv2Scale } from '../../../godot/scene/primitiveMesh.js';
import type { GodotSurface } from '../godotSurface.js';

/** `uv2Padding` is in lightmap texels. A surface with no UV keeps no UV2, as at `:108`. */
export function withFallbackUv2(
  surface: GodotSurface,
  uv2Padding: number,
  lightmapSizeHint: Vector2
): GodotSurface {
  const { uvs } = surface;
  if (!uvs?.length) return surface;
  const scaleX = primitiveMeshUv2Scale(uv2Padding, lightmapSizeHint.x);
  const scaleY = primitiveMeshUv2Scale(uv2Padding, lightmapSizeHint.y);
  return { ...surface, uv2s: uvs.map((uv, i) => uv * (i % 2 === 0 ? scaleX : scaleY)) };
}
