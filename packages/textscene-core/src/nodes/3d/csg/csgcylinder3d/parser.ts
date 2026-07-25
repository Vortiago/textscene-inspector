/** CSGCylinder3D parser - parses CSGCylinder3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { CSGCylinder3DProperties } from './types';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { boolOr, floatOr, intOr } from '../../../../parser/valueParsers';

// Godot's own defaults (class_csgcylinder3d): radius 0.5, height 2.0, sides 8,
// cone false. An omitted property means Godot's value, so ours must match or a
// cylinder that writes none renders at the wrong size.
const DEFAULTS = {
  radius: 0.5,
  height: 2,
  sides: 8,
  cone: false,
  smoothFaces: true,
  flipFaces: false,
} as const;

export function parseCSGCylinder3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGCylinder3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGCylinder3DProperties = {
    ...node3d,
    radius: floatOr(properties.radius, DEFAULTS.radius, 'CSGCylinder3D radius'),
    height: floatOr(properties.height, DEFAULTS.height, 'CSGCylinder3D height'),
    sides: intOr(properties.sides, DEFAULTS.sides, 'CSGCylinder3D sides'),
    cone: properties.cone === undefined ? DEFAULTS.cone : properties.cone === 'true',
    smoothFaces: boolOr(properties.smooth_faces, DEFAULTS.smoothFaces, 'CSGCylinder3D smooth_faces'),
    flipFaces: boolOr(properties.flip_faces, DEFAULTS.flipFaces, 'CSGCylinder3D flip_faces'),
  };

  finishCsgParse(result, properties);

  return result;
}
