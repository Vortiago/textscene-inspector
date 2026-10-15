/** The render state of a GPUParticles3D: its GeometryInstance3D state and its box. */

import type { Aabb } from '../../../../godot/math/aabb';
import type { GeometryInstance3DProperties } from '../../geometryinstance3d/types';

export interface GPUParticles3DProperties extends GeometryInstance3DProperties {
  /**
   * `visibility_aabb`, the whole box of the instance (`particles_storage.cpp:691-696`). An
   * authored `AABB()` stays empty, as the particles keep it.
   */
  visibilityAabb: Aabb;
}
