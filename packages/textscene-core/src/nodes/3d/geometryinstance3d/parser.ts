/**
 * GeometryInstance3D parser: the Node3D transform plus the instance state, which every
 * GeometryInstance3D leaf parser starts from. An unreadable value keeps Godot's default.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseOptionalAabb, parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import type { Aabb } from '../../../godot/aabb';
import type { VisibilityRange } from '../../../godot/visibilityRange';
import { parseNode3D } from '../../base/node3d/parser';
import { GEOMETRY_INSTANCE_DEFAULTS, type GeometryInstance3DProperties } from './types';

export function parseGeometryInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): GeometryInstance3DProperties {
  return {
    ...parseNode3D(heading, properties),
    transparency: parseOptionalFloat(properties.transparency) ?? GEOMETRY_INSTANCE_DEFAULTS.transparency,
    castShadow: parseOptionalInt(properties.cast_shadow) ?? GEOMETRY_INSTANCE_DEFAULTS.castShadow,
    visibilityRange: parseVisibilityRange(properties),
    customAabb: parseBox(properties.custom_aabb, 'custom_aabb'),
  };
}

function parseVisibilityRange(properties: Record<string, string>): VisibilityRange {
  const fallback = GEOMETRY_INSTANCE_DEFAULTS.visibilityRange;
  return {
    begin: parseOptionalFloat(properties.visibility_range_begin) ?? fallback.begin,
    beginMargin: parseOptionalFloat(properties.visibility_range_begin_margin) ?? fallback.beginMargin,
    end: parseOptionalFloat(properties.visibility_range_end) ?? fallback.end,
    endMargin: parseOptionalFloat(properties.visibility_range_end_margin) ?? fallback.endMargin,
    fadeMode: parseOptionalInt(properties.visibility_range_fade_mode) ?? fallback.fadeMode,
  };
}

/** An `AABB()` clears a custom box (`renderer_scene_cull.cpp:1093`, `mesh_storage.cpp:2236`). */
export function parseBox(value: string | undefined, key: string): Aabb | null {
  const box = parseOptionalAabb(value, key);
  if (!box) return null;
  const { position, size } = box;
  const isEmpty = [position.x, position.y, position.z, size.x, size.y, size.z].every((c) => c === 0);
  return isEmpty ? null : box;
}
