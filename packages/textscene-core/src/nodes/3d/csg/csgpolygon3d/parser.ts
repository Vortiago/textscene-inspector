/** CSGPolygon3D parser - parses CSGPolygon3D nodes from TSCN. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseNode3D } from '../../../base/node3d/parser';
import { finishCsgParse } from '../sharedParser';
import { boolOr, floatOr, intOr } from '../../../../parser/valueParsers';
import { parsePackedVector2Array } from '../../../../resources/shapes/packedArray';
import { warn } from '../../../../logger';
import type { CSGPolygon3DProperties } from './types';

/**
 * Godot's defaults (csg_shape.cpp:2808-2829). `polygon` defaults to a unit square, not an empty
 * array, so a CSGPolygon3D that writes nothing still renders a solid. `pathRotation` defaults to
 * PATH_FOLLOW (2), not POLYGON (0), and `smoothFaces` to false, where CSGTorus3D defaults it true.
 */
const DEFAULT_POLYGON = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0]);
const DEFAULTS = {
  mode: 0,
  depth: 1,
  spinDegrees: 360,
  spinSides: 8,
  pathIntervalType: 0,
  pathInterval: 1,
  pathSimplifyAngle: 0,
  pathRotation: 2,
  pathRotationAccurate: false,
  pathLocal: false,
  pathContinuousU: true,
  pathUDistance: 1,
  pathJoined: false,
  smoothFaces: false,
  flipFaces: false,
} as const;

export function parseCSGPolygon3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CSGPolygon3DProperties {
  const node3d = parseNode3D(heading, properties);

  let polygon: Float32Array<ArrayBufferLike> = DEFAULT_POLYGON;
  if (properties.polygon) {
    try {
      polygon = parsePackedVector2Array(properties.polygon);
    } catch (error) {
      // Falls back to EMPTY rather than to the default square: a malformed outline is
      // not the same as an unwritten one, and silently substituting a unit square
      // would draw a shape the scene never asked for.
      polygon = new Float32Array(0);
      warn(`[CSGPolygon3D] Failed to parse polygon: ${String(error)}`);
    }
  }

  const result: CSGPolygon3DProperties = {
    ...node3d,
    polygon,
    mode: intOr(properties.mode, DEFAULTS.mode, 'CSGPolygon3D mode'),
    depth: floatOr(properties.depth, DEFAULTS.depth, 'CSGPolygon3D depth'),
    spinDegrees: floatOr(properties.spin_degrees, DEFAULTS.spinDegrees, 'CSGPolygon3D spin_degrees'),
    spinSides: intOr(properties.spin_sides, DEFAULTS.spinSides, 'CSGPolygon3D spin_sides'),
    pathIntervalType: intOr(
      properties.path_interval_type,
      DEFAULTS.pathIntervalType,
      'CSGPolygon3D path_interval_type'
    ),
    pathInterval: floatOr(properties.path_interval, DEFAULTS.pathInterval, 'CSGPolygon3D path_interval'),
    pathSimplifyAngle: floatOr(
      properties.path_simplify_angle,
      DEFAULTS.pathSimplifyAngle,
      'CSGPolygon3D path_simplify_angle'
    ),
    pathRotation: intOr(properties.path_rotation, DEFAULTS.pathRotation, 'CSGPolygon3D path_rotation'),
    pathRotationAccurate: boolOr(
      properties.path_rotation_accurate,
      DEFAULTS.pathRotationAccurate,
      'CSGPolygon3D path_rotation_accurate'
    ),
    pathLocal: boolOr(properties.path_local, DEFAULTS.pathLocal, 'CSGPolygon3D path_local'),
    pathContinuousU: boolOr(
      properties.path_continuous_u,
      DEFAULTS.pathContinuousU,
      'CSGPolygon3D path_continuous_u'
    ),
    pathUDistance: floatOr(properties.path_u_distance, DEFAULTS.pathUDistance, 'CSGPolygon3D path_u_distance'),
    pathJoined: boolOr(properties.path_joined, DEFAULTS.pathJoined, 'CSGPolygon3D path_joined'),
    smoothFaces: boolOr(properties.smooth_faces, DEFAULTS.smoothFaces, 'CSGPolygon3D smooth_faces'),
    flipFaces: boolOr(properties.flip_faces, DEFAULTS.flipFaces, 'CSGPolygon3D flip_faces'),
  };

  // Kept as the raw `NodePath("…")` literal; the scene-wide pass resolves it, because a
  // component cannot see its siblings.
  if (properties.path_node) result.pathNode = properties.path_node;

  finishCsgParse(result, properties);

  return result;
}
