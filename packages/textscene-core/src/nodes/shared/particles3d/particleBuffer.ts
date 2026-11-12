/** The layout of the buffer `_update_particle_data_buffer` writes, which the simulations of both particle nodes and the draw share. */

import type { Transform3D } from '../../../godot/math/transform3d';

/** Floats per particle in the buffer: a 3×4 transform, a colour and the custom data (`cpu_particles_3d.cpp:1279-1312`). */
export const PARTICLE_FLOATS = 20;
/** Where a particle's colour starts in its {@link PARTICLE_FLOATS}. */
export const PARTICLE_COLOR_OFFSET = 12;
/** Where a particle's custom data starts: angle, phase, animation offset and lifetime ratio. */
export const PARTICLE_CUSTOM_OFFSET = 16;

/** A transform's three rows and origin as the buffer stores them: each row then its origin component. */
export function writeTransformRows(buffer: Float32Array, at: number, t: Transform3D): void {
  const { basis_x: x, basis_y: y, basis_z: z, origin } = t;
  buffer[at] = x.x;
  buffer[at + 1] = x.y;
  buffer[at + 2] = x.z;
  buffer[at + 3] = origin.x;
  buffer[at + 4] = y.x;
  buffer[at + 5] = y.y;
  buffer[at + 6] = y.z;
  buffer[at + 7] = origin.y;
  buffer[at + 8] = z.x;
  buffer[at + 9] = z.y;
  buffer[at + 10] = z.z;
  buffer[at + 11] = origin.z;
}
