/**
 * Marker2D parser: the Node2D transform and modulate, and `gizmo_extents`, the
 * cross-gizmo arm length (Godot default 10).
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { floatOr } from '../../../parser/valueParsers';
import type { Marker2DProperties } from './types';

export function parseMarker2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Marker2DProperties {
  const base = parseNode2D(heading, properties);
  return {
    ...base,
    gizmo_extents: floatOr(properties.gizmo_extents, 10),
  };
}
