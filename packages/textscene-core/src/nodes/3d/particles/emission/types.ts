/** The emission of a ParticleProcessMaterial as the editor gizmo reads it. */

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
}

export interface ParticleProcessMaterialData {
  emission: ParticleEmission;
  emissionShapeOffset: Vector3;
  emissionShapeScale: Vector3;
}
