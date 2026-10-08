/** The render state that CPUParticles3D and GPUParticles3D share. */

import type { Aabb } from '../../../godot/aabb';
import type { GeometryInstance3DProperties } from '../geometryinstance3d/types';

/** A particle emitter's GeometryInstance3D state, with the box it culls by. */
export interface Particles3DProperties extends GeometryInstance3DProperties {
  /**
   * `visibility_aabb`, which each sets as its base's own box (`cpu_particles_3d.cpp:113`,
   * `gpu_particles_3d.cpp:141`). Null for none.
   */
  visibilityAabb: Aabb | null;
}
