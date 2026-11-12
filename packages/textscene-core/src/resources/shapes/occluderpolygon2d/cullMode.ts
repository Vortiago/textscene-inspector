import { intOr } from '../../../parser/valueParsers';
import type { OccluderCullMode } from '../../../r3f/lighting2d/shadowVolumes';
import { OccluderPolygon2DCullMode } from '../../../godot/scene/lightOccluder2d';
import { enumMember } from '../../../godot/classdb/enumNames';

/**
 * `OccluderPolygon2D.cull_mode` from the raw sub-resource property, a bare enum
 * ordinal. Anything outside 0..2 falls back to Godot's default CULL_DISABLED,
 * which casts from every edge, so a garbled value still shadows.
 */
export function parseOccluderCullMode(raw: string | undefined): OccluderCullMode {
  const value = intOr(raw, OccluderPolygon2DCullMode.DISABLED, 'OccluderPolygon2D.cull_mode');
  return enumMember(OccluderPolygon2DCullMode, value) ?? OccluderPolygon2DCullMode.DISABLED;
}
