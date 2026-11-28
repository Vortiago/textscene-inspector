/** Skeleton3D parser: the Node3D base parse plus the bone table, `show_rest_only` and `motion_scale`. */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, realOr } from '../../../parser/valueParsers';
import { parseNode3D } from '../../base/node3d/parser';
import { readBones, type BoneChange } from './readBones';
import type { Skeleton3DProperties } from './types';

export function parseSkeleton3D(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<Skeleton3DProperties>
): Skeleton3DProperties {
  const changes: BoneChange[] = [];
  const bones = override ? readBones(override.written, override.held.bones, changes) : readBones(properties);
  const showRestOnly = boolOr(properties.show_rest_only, false, 'Skeleton3D show_rest_only');
  const result: Skeleton3DProperties = {
    ...parseNode3D(heading, properties),
    bones,
    showRestOnly,
    motionScale: motionScaleOf(properties.motion_scale),
  };
  if (!override) return result;
  const previous = override.held.poseOverrides;
  if (changes.length || override.written.show_rest_only !== undefined) {
    const layer = {
      changes,
      beforeParenting: override.beforeParenting,
      file: override.file,
      line: override.line,
      showRestOnly: override.written.show_rest_only === undefined ? undefined : showRestOnly,
    };
    result.poseOverrides = {
      base: previous?.base ?? override.held,
      layers: [...(previous?.layers ?? []), layer],
    };
  } else if (previous) {
    result.poseOverrides = previous;
  }
  return result;
}

/** `set_motion_scale` stores 1 for a value at or below 0 (`skeleton_3d.cpp:585-591`). */
function motionScaleOf(written: string | undefined): number {
  const scale = realOr(written, 1, 'Skeleton3D motion_scale');
  return scale > 0 ? scale : 1;
}
