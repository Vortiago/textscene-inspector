/**
 * Marker3D parser — the Node3D transform surface plus `gizmo_extents` (the
 * cross-gizmo arm length; Godot default 0.25 world units).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { floatOr } from '../../../parser/valueParsers';
import type { Marker3DProperties } from './types';

export function parseMarker3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Marker3DProperties {
  const base = parseNode3D(heading, properties);
  return {
    ...base,
    gizmo_extents: floatOr(properties.gizmo_extents, 0.25),
  };
}
