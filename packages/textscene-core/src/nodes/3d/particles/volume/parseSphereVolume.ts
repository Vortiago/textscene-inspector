/** The Node3D parse plus the `radius` of a sphere (`scene/3d/gpu_particles_collision_3d.cpp:74-78`). */

import type { ParsedHeading } from '../../../../parser/utils';
import { realOr } from '../../../../parser/valueParsers';
import { parseNode3D } from '../../../base/node3d/parser';
import type { SphereVolumeProperties } from './types';

/** Godot's default radius (`scene/3d/gpu_particles_collision_3d.h:58,304`). */
const DEFAULT_RADIUS = 1;

export function parseSphereVolume(
  heading: ParsedHeading,
  properties: Record<string, string>
): SphereVolumeProperties {
  return {
    ...parseNode3D(heading, properties),
    radius: realOr(properties.radius, DEFAULT_RADIUS, `${heading.type} radius`),
  };
}
