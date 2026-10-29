/** GPUParticlesCollisionBox3D parser: the Node3D parse plus the size the editor gizmo draws. */

import type { ParsedHeading } from '../../../../../parser/utils';
import { parseBoxVolume } from '../../volume/parseBoxVolume';

export function parseGPUParticlesCollisionBox3D(heading: ParsedHeading, properties: Record<string, string>) {
  return parseBoxVolume(heading, properties);
}
