/**
 * PathFollow3D parser: the Node3D surface plus the follow controls. rotation_mode defaults to
 * Godot's XYZ. `progress` and `progress_ratio` stay undefined when unset, so an unparseable value
 * is reported, not read as 0. Nothing positions from `progress_ratio`, since Godot binds the
 * parent Path3D after it applies properties, but it is read so a bad value is diagnosed.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { floatOr, intOr, boolOr } from '../../../parser/valueParsers';
import { RotationMode, type PathFollow3DProperties } from './types';
import { boolSlotValue } from '../../../godot/index.js';

export function parsePathFollow3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): PathFollow3DProperties {
  const base = parseNode3D(heading, properties);
  const result: PathFollow3DProperties = {
    ...base,
    h_offset: floatOr(properties.h_offset, 0),
    v_offset: floatOr(properties.v_offset, 0),
    rotation_mode: intOr(properties.rotation_mode, RotationMode.XYZ),
    cubic_interp: boolOr(properties.cubic_interp, true),
    loop: boolOr(properties.loop, true),
    tilt_enabled: boolOr(properties.tilt_enabled, true),
    use_model_front: boolSlotValue(properties.use_model_front) === true,
  };
  if (properties.progress !== undefined) result.progress = floatOr(properties.progress, 0);
  if (properties.progress_ratio !== undefined) {
    result.progress_ratio = floatOr(properties.progress_ratio, 0);
  }
  return result;
}
