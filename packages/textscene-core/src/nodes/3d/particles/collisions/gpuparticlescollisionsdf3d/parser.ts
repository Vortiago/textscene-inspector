/** GPUParticlesCollisionSDF3D parser: the Node3D parse plus the size and the resolution the editor gizmo draws. */

import type { ParsedHeading } from '../../../../../parser/utils';
import { parseSdfVolume } from '../../volume/parseSdfVolume';

export function parseGPUParticlesCollisionSDF3D(heading: ParsedHeading, properties: Record<string, string>) {
  return parseSdfVolume(heading, properties);
}
