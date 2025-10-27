/**
 * MeshInstance3D parser - parses MeshInstance3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../parser/utils';
import type { MeshInstance3DProperties } from './types';
import { parseNode3D } from '../node3d/parser';

export function parseMeshInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): MeshInstance3DProperties {
  const node3dProps = parseNode3D(heading, properties);

  const surfaceMaterialOverrides = new Map<number, string>();

  for (const [key, value] of Object.entries(properties)) {
    const indexedMatch = key.match(/^surface_material_override\/(\d+)$/);
    if (indexedMatch && indexedMatch[1]) {
      const surfaceIndex = parseInt(indexedMatch[1], 10);
      surfaceMaterialOverrides.set(surfaceIndex, value);
    }
  }

  const meshInstance3DProps: MeshInstance3DProperties = {
    ...node3dProps,
    surfaceMaterialOverrides,
  };

  if (properties.mesh) {
    meshInstance3DProps.mesh = properties.mesh;
  }

  if (properties.cast_shadow) {
    meshInstance3DProps.castShadow = parseInt(properties.cast_shadow, 10);
  }

  if (properties.skeleton) {
    meshInstance3DProps.skeleton = properties.skeleton;
  }

  if (properties.skin) {
    meshInstance3DProps.skin = properties.skin;
  }

  return meshInstance3DProps;
}

export function isMeshInstance3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'MeshInstance3D';
}
