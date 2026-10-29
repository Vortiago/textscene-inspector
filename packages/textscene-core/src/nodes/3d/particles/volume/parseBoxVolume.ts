/** The Node3D parse plus the `size` of a box (`scene/3d/gpu_particles_collision_3d.cpp:122-126`). */

import { GPU_PARTICLES_VOLUME_DEFAULTS } from '../../../../godot/scene/gpuParticlesVolume';
import type { ParsedHeading } from '../../../../parser/utils';
import { realVec3Or } from '../../../../parser/valueParsers';
import { parseNode3D } from '../../../base/node3d/parser';
import type { BoxVolumeProperties } from './types';

export function parseBoxVolume(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoxVolumeProperties {
  return {
    ...parseNode3D(heading, properties),
    size: realVec3Or(properties.size, GPU_PARTICLES_VOLUME_DEFAULTS.size, `${heading.type} size`),
  };
}
