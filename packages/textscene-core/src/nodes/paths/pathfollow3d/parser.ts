/**
 * PathFollow3D parser — the Node3D surface plus the follow controls. `progress`
 * and `progress_ratio` stay optional (undefined when unset) so the component can
 * tell which one the scene authored; rotation_mode defaults to Godot's XYZ.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { floatOr, intOr } from '../../../parser/valueParsers';
import { RotationMode, type PathFollow3DProperties } from './types';

function boolOrTrue(value: string | undefined): boolean {
  return value === undefined ? true : value !== 'false';
}

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
    cubic_interp: boolOrTrue(properties.cubic_interp),
    loop: boolOrTrue(properties.loop),
    tilt_enabled: boolOrTrue(properties.tilt_enabled),
    use_model_front: properties.use_model_front === 'true',
  };
  if (properties.progress !== undefined) result.progress = floatOr(properties.progress, 0);
  if (properties.progress_ratio !== undefined) {
    result.progress_ratio = floatOr(properties.progress_ratio, 0);
  }
  return result;
}
