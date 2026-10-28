/** CopyTransformModifier3D parser: the SkeletonModifier3D parse plus its `settings/<i>/` entries. */

import type { ParsedHeading } from '../../../../parser/utils';
import { boolOr, intOr } from '../../../../parser/valueParsers';
import { parseSkeletonModifier3D } from '../skeletonmodifier3d/parser';
import {
  newConstraintSetting,
  readConstraintSettings,
  type SettingLeafSetter,
} from '../boneconstraint3d/settings';
import type { CopyTransformModifier3DProperties, CopyTransformSetting } from './types';

/** `TransformFlag::ALL` and `AxisFlag::ALL` (`copy_transform_modifier_3d.h:40-49`). */
const ALL_FLAGS = 7;

function newCopyTransformSetting(): CopyTransformSetting {
  return {
    ...newConstraintSetting(),
    copyFlags: ALL_FLAGS,
    axisFlags: ALL_FLAGS,
    invertFlags: 0,
    relative: true,
    additive: false,
  };
}

/** The five leaves `CopyTransformModifier3D::_set` adds (`copy_transform_modifier_3d.cpp:41-52`). */
const OWN_LEAVES: Readonly<Record<string, SettingLeafSetter<CopyTransformSetting>>> = {
  copy: (setting, value, context) => {
    setting.copyFlags = intOr(value, setting.copyFlags, context);
  },
  axes: (setting, value, context) => {
    setting.axisFlags = intOr(value, setting.axisFlags, context);
  },
  invert: (setting, value, context) => {
    setting.invertFlags = intOr(value, setting.invertFlags, context);
  },
  relative: (setting, value, context) => {
    setting.relative = boolOr(value, setting.relative, context);
  },
  additive: (setting, value, context) => {
    setting.additive = boolOr(value, setting.additive, context);
  },
};

export function parseCopyTransformModifier3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): CopyTransformModifier3DProperties {
  return {
    ...parseSkeletonModifier3D(heading, properties),
    settings: readConstraintSettings(properties, newCopyTransformSetting, OWN_LEAVES),
  };
}
