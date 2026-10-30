/** The box parse plus the `resolution` of the SDF cell grid (`scene/3d/gpu_particles_collision_3d.cpp:605-608`). */

import {
  GPU_PARTICLES_COLLISION_SDF_3D_DEFAULT_RESOLUTION,
  GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_VALUES,
} from '../../../../godot/scene/particlesCollision3d';
import type { ParsedHeading } from '../../../../parser/utils';
import { enumOr } from '../../../../parser/valueParsers';
import { parseBoxVolume } from './parseBoxVolume';
import type { SdfVolumeProperties } from './types';

export function parseSdfVolume(
  heading: ParsedHeading,
  properties: Record<string, string>
): SdfVolumeProperties {
  return {
    ...parseBoxVolume(heading, properties),
    resolution: enumOr(
      properties.resolution,
      GPU_PARTICLES_COLLISION_SDF_3D_DEFAULT_RESOLUTION,
      GPU_PARTICLES_COLLISION_SDF_3D_RESOLUTION_VALUES,
      `${heading.type} resolution`
    ),
  };
}
