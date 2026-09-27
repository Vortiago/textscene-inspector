/** Parses MeshInstance3D nodes from TSCN. */

import type { ParsedHeading } from '../../../parser/utils';
import type { MeshInstance3DProperties } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import { indexedKeyRegex, stringToInt } from '../../../godot/index.js';

/**
 * `_set` reads the index with a bare `get_slicec('/', 1).to_int()` into an `int`
 * (mesh_instance_3d.cpp:66), so {@link stringToInt} decides the number: `+2` is
 * surface 2, `abc` is surface 0. Unanchored: `get_slicec` ignores the rest
 * (ustring.cpp:941-964), so `surface_material_override/0/extra` names surface 0.
 */
const SURFACE_OVERRIDE_KEY_RE = indexedKeyRegex('^surface_material_override/(#)', 'to_int');

/** Assigns only a present value: the optional readers already drop an absent or unreadable one. */
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
    const indexedMatch = SURFACE_OVERRIDE_KEY_RE.exec(key);
    if (!indexedMatch) continue;
    const surfaceIndex = stringToInt(indexedMatch[1]!);
    // `if (idx >= surface_override_materials.size() || idx < 0) return false`
    // (mesh_instance_3d.cpp:68). Only the sign is knowable here: the renderer resolves
    // the surface count from the mesh.
    if (surfaceIndex < 0) continue;
    surfaceMaterialOverrides.set(surfaceIndex, value);
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
  assignIfDefined(meshInstance3DProps, 'layers', parseOptionalInt(properties.layers, 'uint32'));

  if (properties.skeleton) {
    meshInstance3DProps.skeleton = properties.skeleton;
  }

  if (properties.skin) {
    meshInstance3DProps.skin = properties.skin;
  }

  return meshInstance3DProps;
}
