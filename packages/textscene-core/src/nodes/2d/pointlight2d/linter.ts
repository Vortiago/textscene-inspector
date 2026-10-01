/**
 * PointLight2D semantic rules: the missing-`texture` configuration warning
 * (light_2d.cpp:431-439), and an inverted z or layer window.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { POINT_LIGHT_2D_RANGE_DEFAULTS } from './types.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  requiresTexture: groundedArm('pointlight2d-requires-texture', { kind: 'configuration-warning' }),
  invertedZRange: groundedArm('pointlight2d-inverted-z-range', {
    kind: 'engine-inert',
    at: 'rasterizer_canvas_gles3.cpp:849',
    unused: 'the inclusive z test can never pass, so the light reaches no item',
  }),
  invertedLayerRange: groundedArm('pointlight2d-inverted-layer-range', {
    kind: 'engine-inert',
    at: 'renderer_viewport.cpp:672',
    unused: 'the inclusive layer test can never pass, so the light reaches no canvas',
  }),
} as const satisfies RuleArms<string>;

/**
 * Godot tests both windows inclusively (`_record_item_commands` in rasterizer_canvas_gles3.cpp
 * for z, `_draw_viewport` in renderer_viewport.cpp for the layer), and Light2D's setters only
 * assign, so an inverted window reaches nothing but still costs its pass: an advisory.
 */
const WINDOWS = [
  {
    min: 'range_z_min',
    max: 'range_z_max',
    minDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.zMin,
    maxDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.zMax,
    arm: arms.invertedZRange,
    reaches: 'no item at any z_index',
  },
  {
    min: 'range_layer_min',
    max: 'range_layer_max',
    minDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.layerMin,
    maxDefault: POINT_LIGHT_2D_RANGE_DEFAULTS.layerMax,
    arm: arms.invertedLayerRange,
    reaches: 'no canvas at any layer',
  },
] as const;

function checkPointLight2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  const diagnostics: Diagnostic[] = [];

  // light_2d.cpp:431-439: PointLight2D::get_configuration_warnings pushes this
  // exact message when `texture` is null. Absence is Godot's serialised form for
  // an unset `Ref`, so absence is the trigger.
  if (resourceSlotIsEmpty(props.texture)) {
    reportArm(
      diagnostics,
      arms.requiresTexture,
      node,
      "PointLight2D has no 'texture': Godot's own editor warning is " +
        '"A texture with the shape of the light must be supplied to the ' +
        "'Texture' property.\""
    );
  }

  // An absent half takes Godot's default: `range_z_max = -2000` alone is already
  // empty against the default `range_z_min` of -1024.
  for (const window of WINDOWS) {
    const min = ruleInt(props[window.min], window.minDefault);
    const max = ruleInt(props[window.max], window.maxDefault);
    if (min === null || max === null || min <= max) continue;
    reportArm(
      diagnostics,
      window.arm,
      node,
      `PointLight2D '${window.min}' (${min}) is above '${window.max}' (${max}). ` +
        `Godot tests the window inclusively and does not swap the bounds, so this ` +
        `light reaches ${window.reaches}.`
    );
  }
  return diagnostics;
}

const pointLight2DValidationRule: LintRule = {
  meta: {
    name: 'valid-pointlight2d-ranges',
    description: "Validates PointLight2D has a texture, and that its z and layer range windows don't invert",
    category: 'validation',
    applicableNodeTypes: ['PointLight2D'],
    emits: armEmits(arms),
  },
  check: checkPointLight2D,
};

ruleRegistry.register(pointLight2DValidationRule);

export { pointLight2DValidationRule };
