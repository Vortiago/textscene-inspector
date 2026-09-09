/**
 * How many frames the sweep walks and how many end caps it gets
 * (csg_shape.cpp:2201-2231), plus the two PATH approximations worth telling the
 * user about.
 *
 * Part of the CSGPolygon3D port; the derivation notice is in
 * `polygonGeometry.ts`.
 */

import { warnOnce } from './polygonSweepFrames';
import {
  MAX_PATH_EXTRUSIONS,
  PathIntervalType,
  PathRotation,
  PolygonMode,
  type CsgPolygonSpec,
} from './polygonSweepSpec';

export interface ExtrusionCounts {
  extrusions: number;
  endCount: number;
}

/**
 * `null` for a sweep that produces nothing: an unknown mode, or a count that is
 * not a finite frame at all.
 */
export function extrusionCounts(spec: CsgPolygonSpec, curveLength: number): ExtrusionCounts | null {
  const { mode, path } = spec;

  // Every mode assigns; an unknown one bails out of the switch's default.
  let extrusions: number;
  let endCount = 0;
  switch (mode) {
    case PolygonMode.DEPTH:
      extrusions = 1;
      endCount = 2;
      break;
    case PolygonMode.SPIN:
      extrusions = spec.spinSides;
      if (spec.spinDegrees < 360) endCount = 2;
      break;
    case PolygonMode.PATH: {
      extrusions =
        spec.pathIntervalType === PathIntervalType.DISTANCE
          ? Math.max(1, Math.ceil(curveLength / spec.pathInterval)) + 1
          : Math.ceil(path!.pointCount / spec.pathInterval);
      if (!spec.pathJoined) {
        endCount = 2;
        extrusions -= 1;
      }
      break;
    }
    default:
      return null;
  }

  if (!Number.isFinite(extrusions) || extrusions < 1) return null;
  if (extrusions > MAX_PATH_EXTRUSIONS) {
    warnOnce(
      'csgpolygon-extrusions',
      `[CSGPolygon3D] ${extrusions} extrusions exceeds the ${MAX_PATH_EXTRUSIONS} cap — ` +
        'clamping. Raise path_interval to sweep the whole curve.'
    );
    extrusions = MAX_PATH_EXTRUSIONS;
  }

  if (mode === PolygonMode.PATH) {
    if (spec.pathRotation === PathRotation.PATH_FOLLOW) {
      warnOnce(
        'csgpolygon-path-follow',
        '[CSGPolygon3D] path_rotation = PATH_FOLLOW renders as PATH: the curve’s baked ' +
          'up-vectors and per-point tilts are not reproduced, so a banking path differs.'
      );
    }
    if (spec.pathRotationAccurate) {
      warnOnce(
        'csgpolygon-rotation-accurate',
        '[CSGPolygon3D] path_rotation_accurate renders as false: sampling with rotation ' +
          'is not reproduced.'
      );
    }
  }

  return { extrusions, endCount };
}
