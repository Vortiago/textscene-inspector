/**
 * The emission keys of a ParticleProcessMaterial and of a CPUParticles3D, which spell and default
 * them alike. Their setters assign bare, except `set_emission_shape`, which refuses an index past
 * the enum (`particle_process_material.cpp:1630`, `cpu_particles_3d.cpp:424`).
 */

import { enumOr, floatOr, vec3Or } from '../../../../parser/valueParsers';
import { storedReal, storedVector3 } from '../../../../godot/math/real';
import type { Vector3 } from '../../../../godot/math/vector';
import { EmissionShape, PARTICLE_EMISSION_DEFAULTS as DEFAULTS } from '../../../../godot/scene/particles3d';
import type { ParticleEmission } from './types';

const SHAPES = Object.values(EmissionShape);

export function readParticleEmission(properties: Record<string, string>): ParticleEmission {
  return {
    shape: enumOr(properties.emission_shape, DEFAULTS.shape, SHAPES, 'emission_shape'),
    sphereRadius: real(properties.emission_sphere_radius, DEFAULTS.sphereRadius, 'emission_sphere_radius'),
    boxExtents: vector(properties.emission_box_extents, DEFAULTS.boxExtents, 'emission_box_extents'),
    ringAxis: vector(properties.emission_ring_axis, DEFAULTS.ringAxis, 'emission_ring_axis'),
    ringHeight: real(properties.emission_ring_height, DEFAULTS.ringHeight, 'emission_ring_height'),
    ringRadius: real(properties.emission_ring_radius, DEFAULTS.ringRadius, 'emission_ring_radius'),
    ringInnerRadius: real(
      properties.emission_ring_inner_radius,
      DEFAULTS.ringInnerRadius,
      'emission_ring_inner_radius'
    ),
    ringConeAngle: real(
      properties.emission_ring_cone_angle,
      DEFAULTS.ringConeAngle,
      'emission_ring_cone_angle'
    ),
  };
}

/** The `real_t` field `value` assigns, which holds single precision. */
function real(value: string | undefined, fallback: number, context: string): number {
  return storedReal(floatOr(value, fallback, context));
}

export function vector(value: string | undefined, fallback: Vector3, context: string): Vector3 {
  return storedVector3(vec3Or(value, fallback, context));
}
