/** The layout of the buffer `_update_particle_data_buffer` writes, which the simulation and the draw share. */

/** Floats per particle in the buffer: a 3×4 transform, a colour and the custom data (`cpu_particles_3d.cpp:1279-1312`). */
export const PARTICLE_FLOATS = 20;
/** Where a particle's colour starts in its {@link PARTICLE_FLOATS}. */
export const PARTICLE_COLOR_OFFSET = 12;
/** Where a particle's custom data starts: angle, phase, animation offset and lifetime ratio. */
export const PARTICLE_CUSTOM_OFFSET = 16;
