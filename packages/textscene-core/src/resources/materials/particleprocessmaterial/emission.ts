/**
 * The emission keys of a ParticleProcessMaterial and of a CPUParticles3D, which spell and default
 * them alike. Their setters assign bare, except `set_emission_shape`, which refuses an index past
 * the enum (`particle_process_material.cpp:1630`, `cpu_particles_3d.cpp:424`).
 */

import { enumOr, realOr, realVec3Or } from '../../../parser/valueParsers';
import { EmissionShape, PARTICLE_EMISSION_DEFAULTS as DEFAULTS } from '../../../godot/scene/particles3d';
import type { ParticleEmission } from './types';

const SHAPES = Object.values(EmissionShape);

export function readParticleEmission(properties: Record<string, string>): ParticleEmission {
  return {
    shape: enumOr(properties.emission_shape, DEFAULTS.shape, SHAPES, 'emission_shape'),
    sphereRadius: realOr(properties.emission_sphere_radius, DEFAULTS.sphereRadius, 'emission_sphere_radius'),
    boxExtents: realVec3Or(properties.emission_box_extents, DEFAULTS.boxExtents, 'emission_box_extents'),
    ringAxis: realVec3Or(properties.emission_ring_axis, DEFAULTS.ringAxis, 'emission_ring_axis'),
    ringHeight: realOr(properties.emission_ring_height, DEFAULTS.ringHeight, 'emission_ring_height'),
    ringRadius: realOr(properties.emission_ring_radius, DEFAULTS.ringRadius, 'emission_ring_radius'),
    ringInnerRadius: realOr(
      properties.emission_ring_inner_radius,
      DEFAULTS.ringInnerRadius,
      'emission_ring_inner_radius'
    ),
    ringConeAngle: realOr(
      properties.emission_ring_cone_angle,
      DEFAULTS.ringConeAngle,
      'emission_ring_cone_angle'
    ),
    shapeOffset: DEFAULTS.shapeOffset,
    shapeScale: DEFAULTS.shapeScale,
  };
}
