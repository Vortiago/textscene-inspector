/** The render state of a CPUParticles3D: its GeometryInstance3D state, what its box reads and its emission. */

import type { Aabb } from '../../../../godot/math/aabb';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';
import type { GeometryInstance3DProperties } from '../../geometryinstance3d/types';

export interface CPUParticles3DProperties extends GeometryInstance3DProperties {
  /**
   * `visibility_aabb`, which sets the multimesh's custom box (`cpu_particles_3d.cpp:113`). Null
   * for none, or for `AABB()`, which clears it (`mesh_storage.cpp:2236`).
   */
  visibilityAabb: Aabb | null;
  /** Whether `mesh` holds a mesh, which the multimesh box measures (`mesh_storage.cpp:1832`). */
  hasMesh: boolean;
  /** The emission shape the editor gizmo draws. Its own keys, with no offset and no scale. */
  emission: ParticleEmission;
}
