/**
 * MeshInstance3D parser - parses MeshInstance3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { MeshInstance3DProperties } from './types';
import { parseNode3D } from '../../base/node3d/parser';

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

  if (properties.material_override) {
    meshInstance3DProps.materialOverride = properties.material_override;
  }

  if (properties.material_overlay) {
    meshInstance3DProps.materialOverlay = properties.material_overlay;
  }

  if (properties.cast_shadow) {
    meshInstance3DProps.castShadow = parseInt(properties.cast_shadow, 10);
  }

  if (properties.gi_mode) {
    meshInstance3DProps.giMode = parseInt(properties.gi_mode, 10);
  }

  if (properties.gi_lightmap_scale) {
    meshInstance3DProps.giLightmapScale = parseInt(properties.gi_lightmap_scale, 10);
  }

  if (properties.visibility_range_begin) {
    meshInstance3DProps.visibilityRangeBegin = parseFloat(properties.visibility_range_begin);
  }

  if (properties.visibility_range_begin_margin) {
    meshInstance3DProps.visibilityRangeBeginMargin = parseFloat(properties.visibility_range_begin_margin);
  }

  if (properties.visibility_range_end) {
    meshInstance3DProps.visibilityRangeEnd = parseFloat(properties.visibility_range_end);
  }

  if (properties.visibility_range_end_margin) {
    meshInstance3DProps.visibilityRangeEndMargin = parseFloat(properties.visibility_range_end_margin);
  }

  if (properties.visibility_range_fade_mode) {
    meshInstance3DProps.visibilityRangeFadeMode = parseInt(properties.visibility_range_fade_mode, 10);
  }

  if (properties.layers) {
    meshInstance3DProps.layers = parseInt(properties.layers, 10);
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
