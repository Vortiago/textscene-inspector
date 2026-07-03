/**
 * MeshInstance3D parser - parses MeshInstance3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { MeshInstance3DProperties } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';

/** Assign only when the decoded value is present (the optional readers already drop absent/garbage). */
function assignIfDefined<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) target[key] = value;
}

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

  assignIfDefined(meshInstance3DProps, 'castShadow', parseOptionalInt(properties.cast_shadow));
  assignIfDefined(meshInstance3DProps, 'giMode', parseOptionalInt(properties.gi_mode));
  assignIfDefined(
    meshInstance3DProps,
    'giLightmapScale',
    parseOptionalInt(properties.gi_lightmap_scale)
  );
  assignIfDefined(
    meshInstance3DProps,
    'visibilityRangeBegin',
    parseOptionalFloat(properties.visibility_range_begin)
  );
  assignIfDefined(
    meshInstance3DProps,
    'visibilityRangeBeginMargin',
    parseOptionalFloat(properties.visibility_range_begin_margin)
  );
  assignIfDefined(
    meshInstance3DProps,
    'visibilityRangeEnd',
    parseOptionalFloat(properties.visibility_range_end)
  );
  assignIfDefined(
    meshInstance3DProps,
    'visibilityRangeEndMargin',
    parseOptionalFloat(properties.visibility_range_end_margin)
  );
  assignIfDefined(
    meshInstance3DProps,
    'visibilityRangeFadeMode',
    parseOptionalInt(properties.visibility_range_fade_mode)
  );
  assignIfDefined(meshInstance3DProps, 'layers', parseOptionalInt(properties.layers));

  if (properties.skeleton) {
    meshInstance3DProps.skeleton = properties.skeleton;
  }

  if (properties.skin) {
    meshInstance3DProps.skin = properties.skin;
  }

  return meshInstance3DProps;
}
