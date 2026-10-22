/**
 * Godot's `Curve.sample_baked`: the curve sampled once into `bake_resolution` entries, and a
 * lookup that interpolates between two of them.
 *
 * Derived from Godot Engine (`scene/resources/curve.cpp`, `Curve::_bake` and
 * `Curve::sample_baked`), used under the MIT licence:
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

import { lerpf } from '../../../godot/math/math.js';
import { storedReal } from '../../../godot/math/real.js';
import { sampleCurve } from './sample';
import type { Curve } from './types';

/**
 * `Curve::sample_baked` over a cache baked once, as Godot bakes it on the first sample. The
 * returned function answers an offset past the domain with the nearest end, and a non-finite
 * offset with 0 (`curve.cpp:536`). A curve with no points answers 0.
 */
export function bakedCurveSampler(curve: Curve): (offset: number) => number {
  const cache = bake(curve);
  const last = cache.length - 1;
  const domainRange = storedReal(curve.maxDomain - curve.minDomain);

  return (offset) => {
    if (!Number.isFinite(offset)) return 0;
    if (last === 0) return cache[0]!;

    let fi = storedReal(storedReal(storedReal(offset - curve.minDomain) / domainRange) * last);
    let i = Math.floor(fi);
    if (i < 0) {
      i = 0;
      fi = 0;
    } else if (i > last) {
      i = last;
      fi = 0;
    }
    return i < last ? lerpf(cache[i]!, cache[i + 1]!, storedReal(fi - i)) : cache[last]!;
  };
}

/** `Curve::_bake` (`curve.cpp:506-523`): entries are `real_t`, so a `Float32Array` stores them as Godot does. */
function bake(curve: Curve): Float32Array {
  const cache = new Float32Array(curve.bakeResolution);
  const last = cache.length - 1;
  const domainRange = storedReal(curve.maxDomain - curve.minDomain);
  for (let i = 1; i < last; i++) {
    const x = storedReal(storedReal(storedReal(domainRange * i) / last) + curve.minDomain);
    cache[i] = sampleCurve(curve, x);
  }
  const { points } = curve;
  if (points.length > 0) {
    cache[0] = points[0]!.position.y;
    cache[last] = points[points.length - 1]!.position.y;
  }
  return cache;
}
