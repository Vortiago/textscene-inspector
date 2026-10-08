/** DirectionalLight2D semantic rule: an inverted layer window. A directional light has no z test. */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { invertedRangeWindowMessage, LAYER_WINDOW } from '../lights/shared/invertedRangeWindow.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  invertedLayerRange: groundedArm('directionallight2d-inverted-layer-range', {
    kind: 'engine-inert',
    at: 'renderer_viewport.cpp:681',
    unused: 'the inclusive layer test can never pass, so the light reaches no canvas',
  }),
} as const satisfies RuleArms<string>;

function checkDirectionalLight2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const message = invertedRangeWindowMessage('DirectionalLight2D', node.rawProperties, LAYER_WINDOW);
  const diagnostics: Diagnostic[] = [];
  if (message) reportArm(diagnostics, arms.invertedLayerRange, node, message);
  return diagnostics;
}

const directionalLight2DValidationRule: LintRule = {
  meta: {
    name: 'valid-directionallight2d-ranges',
    description: 'Validates that a DirectionalLight2D layer range window does not invert',
    category: 'validation',
    applicableNodeTypes: ['DirectionalLight2D'],
    emits: armEmits(arms),
  },
  check: checkDirectionalLight2D,
};

ruleRegistry.register(directionalLight2DValidationRule);

export { directionalLight2DValidationRule };
