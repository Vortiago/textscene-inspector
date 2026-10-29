/**
 * The steps of the POINTS and DIRECTED_POINTS emission shapes that CPUParticles2D and
 * CPUParticles3D share (`cpu_particles_2d.cpp:929-950`, `cpu_particles_3d.cpp:904-941`).
 */

import { DEFAULT_PREVIEW_SEED } from './process';
import { GodotRandomPCG } from './godotRng';
import type { Rgba } from '../../../godot/math/math.js';
import { storedReal as f } from '../../../godot/math/real.js';
import type { Vector2 } from '../../../godot/math/vector.js';

/** Godot's default for each emission array. Shared, since a zero-length array holds nothing to write. */
export const NO_FLOATS = new Float32Array(0);

/** The floats of one colour in a `PackedColorArray`. */
const FLOATS_PER_COLOR = 4;

/**
 * Stands in for the process-wide stream behind `Math::rand()` and `Math::randf()`, which picks a
 * POINTS particle's point and places a CPUParticles2D RING particle. Godot seeds it from the clock
 * (`scene_tree.cpp:2038`), so no scene fixes it, and a fixed seed keeps the render byte-stable.
 */
export function previewProcessRng(): GodotRandomPCG {
  return new GodotRandomPCG(DEFAULT_PREVIEW_SEED);
}

/** `Math::rand() % count`, the index of the point a particle takes, or null for no points. */
export function pickPoint(processRng: GodotRandomPCG, count: number): number | null {
  return count === 0 ? null : processRng.rand() % count;
}

/**
 * `Transform2D(normal, normal.orthogonal()).basis_xform(velocity)` in `real_t` float. Not
 * transform2DXform: its zero origin turns a -0 into a +0, and `basis_xform` adds no origin.
 */
export function turnedByNormal(normal: Vector2, velocity: Vector2): Vector2 {
  return {
    x: f(f(normal.x * velocity.x) + f(normal.y * velocity.y)),
    y: f(f(normal.y * velocity.x) + f(-normal.x * velocity.y)),
  };
}

export function colorCount(flat: Float32Array): number {
  return flat.length / FLOATS_PER_COLOR;
}

export function colorAt(flat: Float32Array, index: number): Rgba {
  const at = index * FLOATS_PER_COLOR;
  return { r: flat[at]!, g: flat[at + 1]!, b: flat[at + 2]!, a: flat[at + 3]! };
}
