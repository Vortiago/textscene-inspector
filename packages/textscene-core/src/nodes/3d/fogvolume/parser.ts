/**
 * FogVolume parser: the Node3D parse plus the shape, the size and the material reference, with
 * Godot's defaults (`scene/3d/fog_volume.h:40-42`).
 */

import { FOG_VOLUME_DEFAULT_SHAPE, FOG_VOLUME_DEFAULT_SIZE } from '../../../godot/fogVolume';
import type { ParsedHeading } from '../../../parser/utils';
import { intOr, vec3Or } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import type { FogVolumeProperties } from './types';

export function parseFogVolume(
  heading: ParsedHeading,
  properties: Record<string, string>
): FogVolumeProperties {
  const size = vec3Or(properties.size, FOG_VOLUME_DEFAULT_SIZE, 'FogVolume size');
  return {
    ...parseNode3D(heading, properties),
    // `size.maxf(0)` clamps each component (`fog_volume.cpp:78`).
    size: { x: Math.max(0, size.x), y: Math.max(0, size.y), z: Math.max(0, size.z) },
    shape: intOr(properties.shape, FOG_VOLUME_DEFAULT_SHAPE, 'FogVolume shape'),
    material: properties.material,
  };
}
