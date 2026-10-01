/**
 * ConvertTransformModifier3D's rule that needs a sibling: `_get_property_list` picks the
 * `PROPERTY_HINT_RANGE` for a setting's `range_min`/`range_max` from that setting's `transform_mode`,
 * for `apply/` (convert_transform_modifier_3d.cpp:133-140) and `reference/` (:146-153). Every setter
 * assigns past an `ERR_FAIL_INDEX` on the index (:208, :220, :257, :269), so each threshold only warns.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armEmits, type RuleArms } from '../../../../linter/ruleArms.js';
import { rangeAdvisories, type RangeThreshold } from '../../../../linter/rangeAdvisory.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { RADIAN_ROUNDTRIP_EPSILON } from '../../../../linter/validators/v.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { firstSegment, indexedElements, indexedKeyRegex, stringToInt } from '../../../../godot/index.js';
import { resolveConvertSettingLeaf } from './linterParser.js';

const arms = {
  rangeOutsideModeHint: {
    severity: 'warning',
    ruleName: 'converttransformmodifier3d-range-outside-mode-hint',
    grounding: { kind: 'engine', at: 'convert_transform_modifier_3d.cpp:143' },
  },
} as const satisfies RuleArms<string>;

/**
 * Any `settings/<i>/…` key, its index and the path below it captured. `_set` reads the index with a
 * bare `path.get_slicec('/', 1).to_int()` and no validity gate (convert_transform_modifier_3d.cpp:41),
 * so {@link stringToInt} reads the whole segment as the `int` Godot stores.
 */
const SETTING_KEY_RE = indexedKeyRegex('^settings/(#)/(.+)$', 'to_int');
/** The four mode-dependent leaves, as `resolveConvertSettingLeaf` names them. */
const RANGE_LEAVES: ReadonlySet<string> = new Set([
  'apply/range_min',
  'apply/range_max',
  'reference/range_min',
  'reference/range_max',
]);

/** ConvertTransformModifier3D::TransformMode (convert_transform_modifier_3d.h:39-43). */
const TRANSFORM_MODE_POSITION = 0;
const TRANSFORM_MODE_ROTATION = 1;

/**
 * PI plus the epsilon `v.radians` uses, so the `3.1415927` Godot's own
 * serialiser writes does not warn against a bound it produced.
 */
const ROTATION_LIMIT = Math.PI + RADIAN_ROUNDTRIP_EPSILON;

/**
 * Thresholds for HINT_ROTATION "-180,180,0.01,radians_as_degrees" (:34): both ends closed, in radians. The
 * `.tscn` stores radians, and `Quaternion(rot_axis, point)` (:407) reads the value as an angle.
 */
function rotationThresholds(key: string): RangeThreshold[] {
  const explain =
    'the hint is radians_as_degrees, so the inspector shows -180..180 while the .tscn stores radians. ' +
    'The setter assigns the value unaltered, so it loads and runs; only the inspector cannot reach it.';
  return [
    {
      over: ROTATION_LIMIT,
      cite: 'convert_transform_modifier_3d.cpp:34',
      message: (value) =>
        `ConvertTransformModifier3D ${key} is ${value}, above the PI radians its transform_mode of Rotation permits: ${explain}`,
    },
    {
      under: -ROTATION_LIMIT,
      cite: 'convert_transform_modifier_3d.cpp:34',
      message: (value) =>
        `ConvertTransformModifier3D ${key} is ${value}, below the -PI radians its transform_mode of Rotation permits: ${explain}`,
    },
  ];
}

/**
 * Thresholds for HINT_SCALE "0,10,0.01,or_greater" (:35): a floor of 0, the ceiling open. It is the `else`
 * branch, so a mode outside the enum lands here too, and the mode itself is the validator's warning.
 */
function scaleThresholds(key: string): RangeThreshold[] {
  return [
    {
      under: 0,
      cite: 'convert_transform_modifier_3d.cpp:35',
      message: (value) =>
        `ConvertTransformModifier3D ${key} is ${value}, below the 0 floor its transform_mode of Scale permits; or_greater leaves the other end open, so only the floor is reportable. The setter assigns the value unaltered, so it loads and runs.`,
    },
  ];
}

function checkConvertTransformModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  // Grouped by the setting `_set` resolves each key to, so `settings/00/…` and `settings/0/…` are
  // one setting and a range finds the mode written beside it under either spelling.
  const settings = indexedElements(props, 'settings/', 'to_int', resolveConvertSettingLeaf);

  const table: Record<string, RangeThreshold[]> = {};
  for (const key of Object.keys(props)) {
    const match = SETTING_KEY_RE.exec(key);
    if (!match) continue;
    const leaf = resolveConvertSettingLeaf(match[2]!);
    if (leaf === null || !RANGE_LEAVES.has(leaf)) continue;
    const index = stringToInt(match[1]!);
    // A negative index is the validator's error, against the ERR_FAIL_INDEX_V
    // in `_set`. Reporting it again here would double up on one defect.
    if (index < 0) continue;

    const modeRaw = settings.get(index)?.get(`${firstSegment(leaf)}/transform_mode`);
    // Absent means Position, the struct's initialiser
    // (convert_transform_modifier_3d.h:46, :51), which Godot omits when unchanged.
    const mode = ruleInt(modeRaw, TRANSFORM_MODE_POSITION);
    // A malformed mode is already reported by its own validator, and a
    // non-finite one is altered at parse. Neither selects a threshold here.
    if (mode === null) continue;
    // HINT_POSITION "-10,10,0.01,or_greater,or_less,suffix:m" (:33) opens both ends: no bound.
    if (mode === TRANSFORM_MODE_POSITION) continue;

    table[key] = mode === TRANSFORM_MODE_ROTATION ? rotationThresholds(key) : scaleThresholds(key);
  }

  // The `CLAMP` at :405 applies to the interpolated result during processing, not the stored
  // property, so it grounds no error.
  return rangeAdvisories(node, table, arms.rangeOutsideModeHint);
}

const convertTransformModifier3DValidationRule: LintRule = {
  meta: {
    name: 'valid-converttransformmodifier3d-ranges',
    description:
      "Validates each ConvertTransformModifier3D settings/<i>/ range against the PROPERTY_HINT_RANGE its sibling transform_mode selects",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'ConvertTransformModifier3D'),
    emits: armEmits(arms),
  },
  check: checkConvertTransformModifier3D,
};

ruleRegistry.register(convertTransformModifier3DValidationRule);

export { convertTransformModifier3DValidationRule };
