/**
 * The `settings/<i>/…` family of a BoneConstraint3D, read the way `BoneConstraint3D::_set` and its
 * subclasses apply it (`bone_constraint_3d.cpp:32-58`): in file order, so a setting written before
 * `setting_count` has made its slot is refused (`ERR_FAIL_INDEX_V`, `:38`).
 */

import { indexedKeyRegex, firstSegment } from '../../../../godot/classdb/indexedKey.js';
import { literalText, stringToInt } from '../../../../godot/string/string.js';
import { parseNodePathLiteral, intOr, realOr } from '../../../../parser/valueParsers.js';
import { unquoteString } from '../../../../parser/utils.js';
import type { BoneConstraintSetting } from './types.js';

/** Writes `value` to a leaf of `setting`. */
export type SettingLeafSetter<Setting> = (setting: Setting, value: string, context: string) => void;

/** `settings/<i>/<leaf>`; the index is `to_int()` with no validity gate (`bone_constraint_3d.cpp:35`). */
const SETTING_KEY = indexedKeyRegex('^settings/(#)/(.+)$', 'to_int');

/** A setting as `memnew(BoneConstraint3DSetting)` makes it (`bone_constraint_3d.h:44-57`). */
export function newConstraintSetting(): BoneConstraintSetting {
  return {
    amount: 1,
    applyBoneName: '',
    applyBone: -1,
    referenceType: 0,
    referenceBoneName: '',
    referenceBone: -1,
    referenceNode: '',
  };
}

const stringLeaf = (value: string): string => unquoteString(literalText(value));

/** The leaves `BoneConstraint3D::_set` has an arm for (`bone_constraint_3d.cpp:39-54`). */
const BASE_LEAF_SETTERS: Readonly<Record<string, SettingLeafSetter<BoneConstraintSetting>>> = {
  amount: (setting, value, context) => {
    setting.amount = realOr(value, setting.amount, context);
  },
  apply_bone_name: (setting, value) => {
    setting.applyBoneName = stringLeaf(value);
  },
  apply_bone: (setting, value, context) => {
    setting.applyBone = intOr(value, setting.applyBone, context);
  },
  reference_type: (setting, value, context) => {
    setting.referenceType = intOr(value, setting.referenceType, context);
  },
  reference_bone_name: (setting, value) => {
    setting.referenceBoneName = stringLeaf(value);
  },
  reference_bone: (setting, value, context) => {
    setting.referenceBone = intOr(value, setting.referenceBone, context);
  },
  reference_node: (setting, value) => {
    setting.referenceNode = parseNodePathLiteral(value) ?? '';
  },
};

/**
 * The settings a node's `setting_count` and `settings/*` keys build. `create` makes a new setting,
 * and `ownLeaves` adds the leaves of the subclass to the seven the base reads.
 */
export function readConstraintSettings<Setting extends BoneConstraintSetting>(
  properties: Record<string, string>,
  create: () => Setting,
  ownLeaves: Readonly<Record<string, SettingLeafSetter<Setting>>>
): Setting[] {
  const settings: Setting[] = [];
  const leafSetters: Readonly<Record<string, SettingLeafSetter<Setting>>> = {
    ...(BASE_LEAF_SETTERS as Readonly<Record<string, SettingLeafSetter<Setting>>>),
    ...ownLeaves,
  };
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'setting_count') {
      resize(settings, intOr(value, settings.length, 'BoneConstraint3D setting_count'), create);
      continue;
    }
    const match = SETTING_KEY.exec(key);
    if (!match) continue;
    const setting = settings[stringToInt(match[1]!)];
    const leaf = firstSegment(match[2]!);
    const setter = Object.hasOwn(leafSetters, leaf) ? leafSetters[leaf] : undefined;
    if (setting && setter) setter(setting, value, `BoneConstraint3D ${key}`);
  }
  return settings;
}

/**
 * The most settings a file may ask for. Godot resizes to any count, but a count in the millions in a
 * crafted file would exhaust the memory of the previewer, the linter and the language server.
 */
const MAX_SETTING_COUNT = 10_000;

/** `set_setting_count` (`bone_constraint_3d.cpp:131-150`): a negative count is refused, and so is one past the ceiling. */
function resize<Setting>(settings: Setting[], count: number, create: () => Setting): void {
  if (count < 0 || count > MAX_SETTING_COUNT) return;
  settings.length = Math.min(settings.length, count);
  while (settings.length < count) settings.push(create());
}
