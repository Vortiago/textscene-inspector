/** VoxelGI parser: the Node3D parse plus the size and the subdivision of its box, as Godot's setters leave them. */

import { VOXEL_GI_DEFAULTS, VOXEL_GI_SUBDIV_VALUES, voxelGiSize } from '../../../godot/scene/voxelGi';
import type { ParsedHeading } from '../../../parser/utils';
import { enumOr, vec3Or } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import type { VoxelGIProperties } from './types';

export function parseVoxelGI(heading: ParsedHeading, properties: Record<string, string>): VoxelGIProperties {
  return {
    ...parseNode3D(heading, properties),
    size: voxelGiSize(vec3Or(properties.size, VOXEL_GI_DEFAULTS.size, 'VoxelGI size')),
    subdiv: enumOr(properties.subdiv, VOXEL_GI_DEFAULTS.subdiv, VOXEL_GI_SUBDIV_VALUES, 'VoxelGI subdiv'),
  };
}
