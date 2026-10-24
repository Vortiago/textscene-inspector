/**
 * ParticleProcessMaterial decode: the emission shape the editor gizmo draws, with the offset and
 * the scale that only the material has (`particle_process_material.cpp:2413-2414`).
 */

import { PARTICLE_EMISSION_DEFAULTS as DEFAULTS } from '../../../godot/scene/particles3d';
import { realVec3Or } from '../../../parser/valueParsers';
import { readParticleEmission } from './emission';
import type { ParticleEmission } from './types';

export function decodeParticleProcessMaterial(properties: Record<string, string>): ParticleEmission {
  return {
    ...readParticleEmission(properties),
    shapeOffset: realVec3Or(properties.emission_shape_offset, DEFAULTS.shapeOffset, 'emission_shape_offset'),
    shapeScale: realVec3Or(properties.emission_shape_scale, DEFAULTS.shapeScale, 'emission_shape_scale'),
  };
}
