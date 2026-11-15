/**
 * The `vec3` operations of the particle shaders, each rounded to a float as the GPU rounds it. A
 * result is `[x, y, z]`. The helpers allocate: the settle runs once, not each frame.
 */

import { storedReal as f } from '../../../godot/math/real.js';

export type Float3 = [number, number, number];

export function add(a: Float3, b: Float3): Float3 {
  return [f(a[0] + b[0]), f(a[1] + b[1]), f(a[2] + b[2])];
}

export function subtract(a: Float3, b: Float3): Float3 {
  return [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
}

export function scale(a: Float3, s: number): Float3 {
  return [f(a[0] * s), f(a[1] * s), f(a[2] * s)];
}

export function cross(a: Float3, b: Float3): Float3 {
  return [
    f(f(a[1] * b[2]) - f(b[1] * a[2])),
    f(f(a[2] * b[0]) - f(b[2] * a[0])),
    f(f(a[0] * b[1]) - f(b[0] * a[1])),
  ];
}

export function dot(a: Float3, b: Float3): number {
  return f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
}

export function length(a: Float3): number {
  return f(Math.sqrt(f(f(f(a[0] * a[0]) + f(a[1] * a[1])) + f(a[2] * a[2]))));
}

/** `normalize`: a zero vector gives NaN, which no later `length(v) > 0.0` test passes. */
export function normalize(a: Float3): Float3 {
  const size = length(a);
  return [f(a[0] / size), f(a[1] / size), f(a[2] / size)];
}

/** GLSL `mix(a, b, t)` on scalars: `a * (1 - t) + b * t`. */
export function mix(a: number, b: number, t: number): number {
  return f(f(a * f(1 - t)) + f(b * t));
}

export function mixVector(a: Float3, b: Float3, t: number): Float3 {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

/** The shaders' `length(v) > 0.0` test, which a NaN vector fails. */
export function hasLength(a: Float3): boolean {
  return length(a) > 0;
}
