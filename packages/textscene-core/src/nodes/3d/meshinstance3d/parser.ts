/**
 * MeshInstance3D parser - parses MeshInstance3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { MeshInstance3DProperties } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';

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
    const val = parseOptionalInt(properties.cast_shadow);
    if (val !== undefined) meshInstance3DProps.castShadow = val;
  }

  if (properties.gi_mode) {
    const val = parseOptionalInt(properties.gi_mode);
    if (val !== undefined) meshInstance3DProps.giMode = val;
  }

  if (properties.gi_lightmap_scale) {
    const val = parseOptionalInt(properties.gi_lightmap_scale);
    if (val !== undefined) meshInstance3DProps.giLightmapScale = val;
  }

  if (properties.visibility_range_begin) {
    const val = parseOptionalFloat(properties.visibility_range_begin);
    if (val !== undefined) meshInstance3DProps.visibilityRangeBegin = val;
  }

  if (properties.visibility_range_begin_margin) {
    const val = parseOptionalFloat(properties.visibility_range_begin_margin);
    if (val !== undefined) meshInstance3DProps.visibilityRangeBeginMargin = val;
  }

  if (properties.visibility_range_end) {
    const val = parseOptionalFloat(properties.visibility_range_end);
    if (val !== undefined) meshInstance3DProps.visibilityRangeEnd = val;
  }

  if (properties.visibility_range_end_margin) {
    const val = parseOptionalFloat(properties.visibility_range_end_margin);
    if (val !== undefined) meshInstance3DProps.visibilityRangeEndMargin = val;
  }

  if (properties.visibility_range_fade_mode) {
    const val = parseOptionalInt(properties.visibility_range_fade_mode);
    if (val !== undefined) meshInstance3DProps.visibilityRangeFadeMode = val;
  }

  if (properties.layers) {
    const val = parseOptionalInt(properties.layers);
    if (val !== undefined) meshInstance3DProps.layers = val;
  }

  if (properties.skeleton) {
    meshInstance3DProps.skeleton = properties.skeleton;
  }

  if (properties.skin) {
    meshInstance3DProps.skin = properties.skin;
  }

  return meshInstance3DProps;
}
