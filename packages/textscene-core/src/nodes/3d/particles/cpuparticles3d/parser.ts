/** The render parse of a CPUParticles3D: its instance state and what its box reads. */

import type { ParsedHeading } from '../../../../parser/utils';
import { holdsResource } from '../../../../godot/geometryBase';
import { parseBox, parseGeometryInstance3D } from '../../geometryinstance3d/parser';
import type { CPUParticles3DProperties } from './types';

export function parseCPUParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CPUParticles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb: parseBox(properties.visibility_aabb, 'visibility_aabb'),
    hasMesh: holdsResource(properties.mesh),
  };
}
