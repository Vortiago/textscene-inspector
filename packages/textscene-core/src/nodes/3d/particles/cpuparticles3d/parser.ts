/** The render parse of a CPUParticles3D: its instance state, what its box reads and its emission. */

import type { ParsedHeading } from '../../../../parser/utils';
import { holdsResource } from '../../../../godot/scene/resourceLiteral';
import { parseNonEmptyAabb } from '../../../../parser/valueParsers';
import { readParticleEmission } from '../emission/emission';
import { parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import type { CPUParticles3DProperties } from './types';

export function parseCPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CPUParticles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb: parseNonEmptyAabb(properties.visibility_aabb, 'visibility_aabb'),
    hasMesh: holdsResource(properties.mesh),
    emission: readParticleEmission(properties),
  };
}
