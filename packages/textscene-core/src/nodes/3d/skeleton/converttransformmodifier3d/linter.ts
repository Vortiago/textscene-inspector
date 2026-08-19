/**
 * Semantic linter rules for ConvertTransformModifier3D.
 *
 * Format validation is linterParser.ts's, which checks each `settings/<i>/<leaf>`
 * in isolation. This file holds the one claim that needs a SIBLING property to be
 * decidable, so no per-property validator can make it.
 *
 * ## The range hint is picked at runtime from the neighbouring transform_mode
 *
 * `_get_property_list` chooses the `PROPERTY_HINT_RANGE` string for a setting's
 * `range_min` / `range_max` pair from that same setting's `transform_mode`, once
 * for the `apply/` group (convert_transform_modifier_3d.cpp:133-140) and again
 * for `reference/` (:146-153):
 *
 *   Position (0) -> HINT_POSITION "-10,10,0.01,or_greater,or_less,suffix:m" (:33)
 *   Rotation (1) -> HINT_ROTATION "-180,180,0.01,radians_as_degrees"        (:34)
 *   anything else -> HINT_SCALE   "0,10,0.01,or_greater"                    (:35)
 *
 * The third arm really is `else`, not a test for Scale, so a mode outside the
 * enum lands there too; the mode value itself is the validator's warning.
 *
 * Under ADR-0032 each arm reads differently:
 *
 * - Position opens BOTH ends (`or_greater` AND `or_less`), so it grounds nothing.
 *   This is also the struct default (convert_transform_modifier_3d.h:46, :51),
 *   which is why an absent `transform_mode` produces no diagnostic.
 * - Rotation is `radians_as_degrees`: the inspector shows degrees while the
 *   `.tscn` stores radians, so the hint's -180..180 is a stored -PI..PI. The
 *   value is read back as an angle in radians (`Quaternion(rot_axis, point)`,
 *   :407), which confirms the unit.
 * - Scale opens only the max end, leaving a floor of 0.
 *
 * Every setter is a bare assignment past an `ERR_FAIL_INDEX` on the setting
 * index (:208, :220, :257, :269), so nothing here is ever an error: the value
 * loads and runs, and only the inspector's spinner cannot reach it. The `CLAMP`
 * at :405 is applied to the interpolated result during processing, not to the
 * stored property, so it grounds nothing either.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { rangeAdvisories, type RangeArm } from '../../../../linter/rangeAdvisory.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { RADIAN_ROUNDTRIP_EPSILON } from '../../../../linter/validators/v.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { indexedElements, indexedKeyRegex, toIntIndex } from '../../../../godot/index.js';

const RULE_NAME = 'converttransformmodifier3d-range-outside-mode-hint';

/**
 * `settings/<i>/apply|reference/range_min|range_max`, the four mode-dependent
 * leaves. `_set` reads the index with a bare
 * `path.get_slicec('/', 1).to_int()` and no validity gate
 * (convert_transform_modifier_3d.cpp:41), so the grammar is the whole segment
 * and {@link toIntIndex} is what turns it into a number.
 */
const RANGE_KEY_RE = indexedKeyRegex('^settings/(#)/(apply|reference)/(range_min|range_max)$', 'to_int');

/** ConvertTransformModifier3D::TransformMode (convert_transform_modifier_3d.h:39-43). */
const TRANSFORM_MODE_POSITION = 0;
const TRANSFORM_MODE_ROTATION = 1;

/**
 * PI plus the epsilon `v.radians` uses, so the `3.1415927` Godot's own
 * serialiser writes does not warn against a bound it produced.
 */
const ROTATION_LIMIT = Math.PI + RADIAN_ROUNDTRIP_EPSILON;

/** Arms for HINT_ROTATION: both ends closed, in radians rather than the hint's degrees. */
function rotationArms(key: string): RangeArm[] {
  const explain =
    'the hint is radians_as_degrees, so the inspector shows -180..180 while the .tscn stores radians. ' +
    'The setter assigns the value unaltered, so it loads and runs; only the inspector cannot reach it.';
  return [
    {
      ruleName: RULE_NAME,
      over: ROTATION_LIMIT,
      cite: 'convert_transform_modifier_3d.cpp:34',
      message: (value) =>
        `ConvertTransformModifier3D ${key} is ${value}, above the PI radians its transform_mode of Rotation permits: ${explain}`,
    },
    {
      ruleName: RULE_NAME,
      under: -ROTATION_LIMIT,
      cite: 'convert_transform_modifier_3d.cpp:34',
      message: (value) =>
        `ConvertTransformModifier3D ${key} is ${value}, below the -PI radians its transform_mode of Rotation permits: ${explain}`,
    },
  ];
}

/** Arms for HINT_SCALE: a floor of 0, with `or_greater` leaving the ceiling open. */
function scaleArms(key: string): RangeArm[] {
  return [
    {
      ruleName: RULE_NAME,
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

  // Grouped by the setting `_set` RESOLVES each key to, so `settings/00/…` and
  // `settings/0/…` are one setting and a range finds the mode written beside it
  // under either spelling. Keying on the index TEXT split them in two and read
  // the default Position for a mode the file states.
  const settings = indexedElements(props, 'settings/', 'to_int');

  const table: Record<string, RangeArm[]> = {};
  for (const key of Object.keys(props)) {
    const match = RANGE_KEY_RE.exec(key);
    if (!match) continue;
    const index = toIntIndex(match[1]!);
    // A negative index is the validator's error, against the ERR_FAIL_INDEX_V
    // in `_set`; reporting it again here would double up on one defect.
    if (!(index >= 0)) continue;

    const modeRaw = settings.get(index)?.[`${match[2]!}/transform_mode`];
    // Absent means Position, the struct's initialiser
    // (convert_transform_modifier_3d.h:46, :51), which Godot omits when unchanged.
    const mode = ruleInt(modeRaw, TRANSFORM_MODE_POSITION);
    // A malformed mode is already reported by its own validator, and a
    // non-finite one is altered at parse; neither selects an arm here.
    if (mode === null) continue;
    if (mode === TRANSFORM_MODE_POSITION) continue;

    table[key] = mode === TRANSFORM_MODE_ROTATION ? rotationArms(key) : scaleArms(key);
  }

  return rangeAdvisories(node, table);
}

const convertTransformModifier3DValidationRule: LintRule = {
  meta: {
    name: 'valid-converttransformmodifier3d-ranges',
    description:
      "Validates each ConvertTransformModifier3D settings/<i>/ range against the PROPERTY_HINT_RANGE its sibling transform_mode selects",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'ConvertTransformModifier3D'),
    emits: [
      {
        ruleName: RULE_NAME,
        severity: 'warning',
        grounding: { kind: 'engine', at: 'convert_transform_modifier_3d.cpp:143' },
      },
    ],
  },
  check: checkConvertTransformModifier3D,
};

ruleRegistry.register(convertTransformModifier3DValidationRule);

export { convertTransformModifier3DValidationRule };
