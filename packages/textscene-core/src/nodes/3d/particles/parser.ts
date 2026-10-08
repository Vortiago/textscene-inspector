/** The render parse of a particle emitter: its instance state and its `visibility_aabb`. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseBox, parseGeometryInstance3D } from '../geometryinstance3d/parser';
import type { Particles3DProperties } from './types';

/** The parse CPUParticles3D and GPUParticles3D share. */
export function parseParticles3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Particles3DProperties {
  return {
    ...parseGeometryInstance3D(heading, properties),
    visibilityAabb: parseBox(properties.visibility_aabb, 'visibility_aabb'),
  };
}
