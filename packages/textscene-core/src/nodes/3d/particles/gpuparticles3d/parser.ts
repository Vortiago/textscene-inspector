/** The render parse of a GPUParticles3D: its instance state and its `visibility_aabb`. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalAabb } from '../../../../parser/valueParsers';
import { GPU_PARTICLES_DEFAULT_VISIBILITY_AABB } from '../../../../godot/gpuParticles';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import type { GPUParticles3DProperties } from './types';

export function parseGPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GPUParticles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb:
      parseOptionalAabb(properties.visibility_aabb, 'visibility_aabb') ??
      GPU_PARTICLES_DEFAULT_VISIBILITY_AABB,
  };
}
