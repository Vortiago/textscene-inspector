/** The emission of a ParticleProcessMaterial or a CPUParticles3D as the editor gizmo reads it. */

import type { Vector3 } from '../../../../godot/math/vector';

/** The emission keys that ParticleProcessMaterial and CPUParticles3D declare alike. */
export interface ParticleEmission {
  /** An `EmissionShape` value (`godot/scene/particles3d.ts`). */
  shape: number;
  sphereRadius: number;
  /** Half the box size, not the size (`particles_3d_emission_shape_gizmo_plugin.cpp:132`). */
  boxExtents: Vector3;
  ringAxis: Vector3;
  ringHeight: number;
  ringRadius: number;
  ringInnerRadius: number;
  /** In degrees. */
  ringConeAngle: number;
  /** The material's `emission_shape_offset`. A CPUParticles3D has none, so it keeps the default. */
  shapeOffset: Vector3;
  /** The material's `emission_shape_scale`. A CPUParticles3D has none, so it keeps the default. */
  shapeScale: Vector3;
}
