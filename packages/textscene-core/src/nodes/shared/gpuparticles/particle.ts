/** One GPU particle as `particles.glsl` holds it, and the frame of the emission transform it is born in. */

import type { Float3 } from './float3';

export interface GpuParticle {
  active: boolean;
  /** `FRAME.cycle` at the restart, the `flags >> 16` that numbers the particle (`particles.glsl:445`). */
  cycle: number;
  /** `TRANSFORM[0..2]`, the columns of the basis. */
  columns: [Float3, Float3, Float3];
  /** `TRANSFORM[3].xyz`. */
  origin: Float3;
  velocity: Float3;
  /** `COLOR`, in linear light. */
  color: [number, number, number, number];
  /** `CUSTOM`: the angle, the age, the animation frame and the share of the lifetime it lives. */
  custom: [number, number, number, number];
}

/** `EMISSION_TRANSFORM`: the columns of the basis and the origin. */
export interface EmissionFrame {
  columns: readonly [Float3, Float3, Float3];
  origin: Float3;
}

export function inactiveParticle(): GpuParticle {
  return {
    active: false,
    cycle: 0,
    columns: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    origin: [0, 0, 0],
    velocity: [0, 0, 0],
    color: [1, 1, 1, 1],
    custom: [0, 0, 0, 0],
  };
}
