/**
 * Decal parser — parses Decal TSCN properties into a typed shape.
 *
 * Defaults follow Godot's Decal:
 *   - size = Vector3(2, 2, 2)
 *   - modulate = white opaque
 *   - albedo_mix = 1, emission_energy = 1
 *   - normal_fade = 0, upper_fade = lower_fade = 0.3
 *   - cull_mask = 0xFFFFF (1048575 — Godot's default: the 20 editor-visible layers)
 *   - distance_fade_enabled = false, distance_fade_begin = 40, distance_fade_length = 10
 * Texture references are optional and only set when present.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseColor } from '../../../utils/colorParser';
import { parseVector3, type Vector3 } from '../../../parser/vectors';
import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';
import { warn } from '../../../logger';
import type { DecalProperties } from './types';

/** Godot Decal default box size. */
const DEFAULT_SIZE: Vector3 = { x: 2, y: 2, z: 2 };

/**
 * Godot Decal default `cull_mask` — all 20 render layers enabled
 * (`Decal::cull_mask = (1 << 20) - 1`). Exported so the projection's own default
 * argument cannot drift from what the parser hands it.
 */
export const DECAL_DEFAULT_CULL_MASK = 0xfffff;

export function parseDecal(
  heading: ParsedHeading,
  properties: Record<string, string>
): DecalProperties {
  const baseProperties = parseNode3D(heading, properties);

  let size: Vector3 = { ...DEFAULT_SIZE };
  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(`[Decal] Failed to parse size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const result: DecalProperties = {
    ...baseProperties,
    size,
    modulate: properties.modulate ? parseColor(properties.modulate) : { r: 1, g: 1, b: 1, a: 1 },
    albedo_mix: floatOr(properties.albedo_mix, 1),
    emission_energy: floatOr(properties.emission_energy, 1),
    normal_fade: floatOr(properties.normal_fade, 0),
    // Godot clamps both exponents at the setter (`Decal::set_upper_fade` /
    // `set_lower_fade`), so a negative authored value means zero, not a
    // NaN-producing `pow` base later.
    upper_fade: Math.max(0, floatOr(properties.upper_fade, 0.3)),
    lower_fade: Math.max(0, floatOr(properties.lower_fade, 0.3)),
    cull_mask: intOr(properties.cull_mask, DECAL_DEFAULT_CULL_MASK, 'Decal.cull_mask', 'uint32'),
    distance_fade_enabled: boolOr(properties.distance_fade_enabled, false),
    distance_fade_begin: floatOr(properties.distance_fade_begin, 40),
    distance_fade_length: floatOr(properties.distance_fade_length, 10),
  };

  if (properties.texture_albedo) result.texture_albedo = properties.texture_albedo;
  if (properties.texture_normal) result.texture_normal = properties.texture_normal;
  if (properties.texture_orm) result.texture_orm = properties.texture_orm;
  if (properties.texture_emission) result.texture_emission = properties.texture_emission;

  return result;
}
