/**
 * The steps of the POINTS and DIRECTED_POINTS emission shapes that CPUParticles2D and
 * CPUParticles3D share (`cpu_particles_2d.cpp:929-950`, `cpu_particles_3d.cpp:904-941`), and the
 * process-wide `Math::rand()` and `Math::randf()` they and the CPUParticles2D RING draw from.
 *
 * Derived from Godot Engine (`scene/2d/cpu_particles_2d.cpp`, `scene/3d/cpu_particles_3d.cpp` and
 * `core/math/math_funcs.h`), used under the MIT licence:
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

import { GodotRandomPCG } from './godotRng';
import { transform2DBasisXform } from '../../../godot/math/transform2d.js';
import type { Vector2 } from '../../../godot/math/vector.js';

/**
 * The seed of the process-wide stand-in. Not `DEFAULT_PREVIEW_SEED`: an unseeded emitter's
 * first particle seeds its own stream with that, and the two would draw the same values.
 */
const PROCESS_RNG_SEED = 0x9e3779b9;

/**
 * Stands in for the process-wide stream behind `Math::rand()` and `Math::randf()`, which picks a
 * POINTS particle's point and places a CPUParticles2D RING particle. Godot seeds it from the clock
 * (`scene_tree.cpp:2038`), so no scene fixes it, and a fixed seed keeps the render byte-stable.
 */
export function previewProcessRng(): GodotRandomPCG {
  return new GodotRandomPCG(PROCESS_RNG_SEED);
}

/** `Math::rand() % count`, the index of the point a particle takes, or null for no points. */
export function pickPoint(processRng: GodotRandomPCG, count: number): number | null {
  return count === 0 ? null : processRng.rand() % count;
}

/** `(float)UINT32_MAX`, which rounds up to 2^32. */
const UINT32_MAX_AS_FLOAT = Math.fround(0xffffffff);

/**
 * `Math::randf()` (`math_funcs.h:689-691`): one `rand()` over `UINT32_MAX` in float. Not
 * `RandomPCG::randf`, which draws twice and would take every later value from the wrong place.
 */
export function processRandf(processRng: GodotRandomPCG): number {
  return Math.fround(Math.fround(processRng.rand()) / UINT32_MAX_AS_FLOAT);
}

/** `Transform2D(normal, normal.orthogonal()).basis_xform(velocity)` (`cpu_particles_2d.cpp:943-945`). */
export function turnedByNormal(normal: Vector2, velocity: Vector2): Vector2 {
  return transform2DBasisXform(
    { a: normal.x, b: normal.y, c: normal.y, d: -normal.x, tx: 0, ty: 0 },
    velocity
  );
}
