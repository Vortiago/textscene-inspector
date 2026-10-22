/**
 * ParticleProcessMaterial decode: the emission shape the editor gizmo draws, with the offset and
 * the scale that only the material has (`particle_process_material.cpp:2413-2414`).
 */

import { PARTICLE_EMISSION_DEFAULTS as DEFAULTS } from '../../../../godot/scene/particles3d';
import { readParticleEmission, vector } from './emission';
import type { ParticleProcessMaterialData } from './types';

export function decodeParticleProcessMaterial(
  properties: Record<string, string>
): ParticleProcessMaterialData {
  return {
    emission: readParticleEmission(properties),
    emissionShapeOffset: vector(
      properties.emission_shape_offset,
      DEFAULTS.shapeOffset,
      'emission_shape_offset'
    ),
    emissionShapeScale: vector(properties.emission_shape_scale, DEFAULTS.shapeScale, 'emission_shape_scale'),
  };
}
