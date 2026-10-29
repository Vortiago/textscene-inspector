/** GPUParticlesAttractorSphere3D parser: the Node3D parse plus the radius the editor gizmo draws. */

import type { ParsedHeading } from '../../../../../parser/utils';
import { parseSphereVolume } from '../../volume/parseSphereVolume';

export function parseGPUParticlesAttractorSphere3D(
  heading: ParsedHeading,
  properties: Record<string, string>
) {
  return parseSphereVolume(heading, properties);
}
