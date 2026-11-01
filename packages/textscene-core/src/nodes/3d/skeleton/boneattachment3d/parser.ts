/**
 * BoneAttachment3D parser: the Node3D base parse plus the five own properties. Each stays as the
 * loader stores it: the name's plain text, the index as written, and the flags' bools. The literal
 * of `external_skeleton` keeps its spelling, which the seat pass resolves against the live tree.
 */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { literalText } from '../../../../godot/string/string';
import { parseNode3D } from '../../../base/node3d/parser';
import type { BoneAttachment3DProperties } from './types';

export function parseBoneAttachment3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): BoneAttachment3DProperties {
  return {
    ...parseNode3D(heading, properties),
    boneName: literalText(properties.bone_name ?? ''),
    boneIdx: intOr(properties.bone_idx, -1, 'BoneAttachment3D bone_idx'),
    overridePose: boolOr(properties.override_pose, false, 'BoneAttachment3D override_pose'),
    useExternalSkeleton: boolOr(
      properties.use_external_skeleton,
      false,
      'BoneAttachment3D use_external_skeleton'
    ),
    externalSkeleton: properties.external_skeleton,
  };
}
