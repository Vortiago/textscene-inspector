/** GPUParticles3D facts the previewer reads without simulating a particle. */

import type { Aabb } from './aabb.js';

/**
 * The `visibility_aabb` the constructor sets (`gpu_particles_3d.cpp:896`), and so the box of an
 * emitter that authors none: the instance reads the particles' custom AABB alone
 * (`particles_storage.cpp:691-696`).
 */
export const GPU_PARTICLES_DEFAULT_VISIBILITY_AABB: Aabb = Object.freeze({
  position: Object.freeze({ x: -4, y: -4, z: -4 }),
  size: Object.freeze({ x: 8, y: 8, z: 8 }),
});
