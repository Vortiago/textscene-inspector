/**
 * ParticleProcessMaterial decode: the emission shape the editor gizmo draws, with the offset and
 * the scale that only the material has (`particle_process_material.cpp:2413-2414`).
 */

import { PARTICLE_EMISSION_DEFAULTS as DEFAULTS } from '../../../godot/scene/particles3d';
import { realVec3Or } from '../../../parser/valueParsers';
import type { ResourceKind } from '../../reading';
import { readParticleEmission } from './emission';
import type { ParticleEmission } from './types';

export function decodeParticleProcessMaterial(
  properties: Readonly<Record<string, string>>
): ParticleEmission {
  return {
    ...readParticleEmission(properties),
    shapeOffset: realVec3Or(properties.emission_shape_offset, DEFAULTS.shapeOffset, 'emission_shape_offset'),
    shapeScale: realVec3Or(properties.emission_shape_scale, DEFAULTS.shapeScale, 'emission_shape_scale'),
  };
}

/**
 * A `ParticleProcessMaterial` from any origin. A ShaderMaterial draws no emission shape
 * (`particles_3d_emission_shape_gizmo_plugin.cpp:88-89`).
 */
export const PARTICLE_PROCESS_MATERIAL: ResourceKind<ParticleEmission> = {
  name: 'ParticleProcessMaterial',
  accepts: (type) => type === 'ParticleProcessMaterial',
  decode: (held) => decodeParticleProcessMaterial(held.properties),
};
