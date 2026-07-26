/** CSGTorus3D parser - parses CSGTorus3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { boolOr, floatOr, intOr } from '../../../../parser/valueParsers';
import type { CSGTorus3DProperties } from './types';

// Godot's own defaults (csg_shape.cpp:2140-2147). An omitted property means Godot's
// value, so ours must match or a torus that writes none renders at the wrong size.
// Note smooth_faces defaults TRUE here; CSGPolygon3D defaults it false.
const DEFAULTS = {
  innerRadius: 0.5,
  outerRadius: 1,
  sides: 8,
  ringSides: 6,
  smoothFaces: true,
  flipFaces: false,
} as const;

export function parseCSGTorus3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGTorus3DProperties {
  const node3d = parseNode3D(heading, properties);

  const result: CSGTorus3DProperties = {
    ...node3d,
    innerRadius: floatOr(properties.inner_radius, DEFAULTS.innerRadius, 'CSGTorus3D inner_radius'),
    outerRadius: floatOr(properties.outer_radius, DEFAULTS.outerRadius, 'CSGTorus3D outer_radius'),
    sides: intOr(properties.sides, DEFAULTS.sides, 'CSGTorus3D sides'),
    ringSides: intOr(properties.ring_sides, DEFAULTS.ringSides, 'CSGTorus3D ring_sides'),
    smoothFaces: boolOr(properties.smooth_faces, DEFAULTS.smoothFaces, 'CSGTorus3D smooth_faces'),
    flipFaces: boolOr(properties.flip_faces, DEFAULTS.flipFaces, 'CSGTorus3D flip_faces'),
  };

  finishCsgParse(result, properties);

  return result;
}
