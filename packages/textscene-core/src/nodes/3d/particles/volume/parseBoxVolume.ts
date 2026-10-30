/** The Node3D parse plus the `size` of a box (`scene/3d/gpu_particles_collision_3d.cpp:122-126`). */

import type { ParsedHeading } from '../../../../parser/utils';
import { realVec3Or } from '../../../../parser/valueParsers';
import { parseNode3D } from '../../../base/node3d/parser';
import type { BoxVolumeProperties } from './types';

/** Godot's default size (`scene/3d/gpu_particles_collision_3d.h:76,114,228,322,344`). */
const DEFAULT_SIZE = Object.freeze({ x: 2, y: 2, z: 2 });

export function parseBoxVolume(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoxVolumeProperties {
  return {
    ...parseNode3D(heading, properties),
    size: realVec3Or(properties.size, DEFAULT_SIZE, `${heading.type} size`),
  };
}
