/**
 * PointLight2D semantic rules: the missing-`texture` configuration warning
 * (light_2d.cpp:431-439), and an inverted z or layer window.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { invertedRangeWindowMessage, LAYER_WINDOW, Z_WINDOW } from '../lights/shared/invertedRangeWindow.js';
import { resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
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

const WINDOWS = [
  { window: Z_WINDOW, arm: arms.invertedZRange },
  { window: LAYER_WINDOW, arm: arms.invertedLayerRange },
] as const;

function checkPointLight2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.rawProperties;

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

  for (const { window, arm } of WINDOWS) {
    const message = invertedRangeWindowMessage('PointLight2D', props, window);
    if (message) reportArm(diagnostics, arm, node, message);
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
