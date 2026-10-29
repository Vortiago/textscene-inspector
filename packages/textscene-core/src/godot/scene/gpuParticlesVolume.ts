/** Godot 4.6.3's shape defaults of the GPU particles collision and attractor nodes. */

/**
 * The size of a box, SDF, height field or vector field node, and the radius of a sphere node
 * (`scene/3d/gpu_particles_collision_3d.h:58,76,114,228,304,322,344`).
 */
export const GPU_PARTICLES_VOLUME_DEFAULTS = {
  size: { x: 2, y: 2, z: 2 },
  radius: 1,
} as const;
