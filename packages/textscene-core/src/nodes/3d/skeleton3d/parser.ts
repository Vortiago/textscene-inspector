/** Skeleton3D parser: the Node3D base parse plus the bone table, `show_rest_only` and `motion_scale`. */

import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, realOr } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import { readBones } from './readBones';
import type { Skeleton3DProperties } from './types';

export function parseSkeleton3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Skeleton3DProperties {
  return {
    ...parseNode3D(heading, properties),
    bones: readBones(properties),
    showRestOnly: boolOr(properties.show_rest_only, false, 'Skeleton3D show_rest_only'),
    motionScale: motionScaleOf(properties.motion_scale),
  };
}

/** `set_motion_scale` stores 1 for a value at or below 0 (`skeleton_3d.cpp:585-591`). */
function motionScaleOf(written: string | undefined): number {
  const scale = realOr(written, 1, 'Skeleton3D motion_scale');
  return scale > 0 ? scale : 1;
}
