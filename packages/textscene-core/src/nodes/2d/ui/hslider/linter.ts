/**
 * Semantic rule for HSlider: the `Range` property-order hazard, derived from
 * range.cpp in `linter.test.ts` and computed by `shared/rangeLinter.ts`. VSlider registers
 * the same check under its own name: `NODE_BASE_TYPES` has no authorable Range
 * type to hang one shared rule on.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../../linter/ruleArms.js';
import { rangeOrderHazard } from '../shared/rangeLinter.js';

const arms = {
  propertyOrder: {
    severity: 'warning',
    ruleName: 'hslider-property-order',
    grounding: { kind: 'engine', at: 'range.cpp:106' },
  },
} as const satisfies RuleArms<string>;

function checkHSliderPropertyOrder(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.rawProperties;

  const laterTriggers = rangeOrderHazard(props);
  if (!laterTriggers) return [];

  return [
    armDiagnostic(
      arms.propertyOrder,
      node,
      `'value' is authored before ${laterTriggers.join(', ')} on ${node.name}. Godot applies a ` +
        `node's properties in the order the file lists them (SceneState::instantiate, ` +
        `scene/resources/packed_scene.cpp), and Range::set_min/set_max/set_page each re-clamp ` +
        `'value' against whatever bounds exist at that moment (scene/gui/range.cpp:211-266) — so ` +
        `'value' can be silently clamped against stale (default) bounds, and a later ` +
        `min_value/max_value/page line cannot recover the original intent. Move 'value' after ` +
        `${laterTriggers.join(', ')}.`
    ),
  ];
}

const hSliderPropertyOrderRule: LintRule = {
  meta: {
    name: 'hslider-property-order',
    description:
      "Warns when an HSlider authors 'value' in a file order Range's own min_value/max_value/page " +
      'setters silently re-clamp against.',
    category: 'validation',
    applicableNodeTypes: ['HSlider'],
    emits: armEmits(arms),
  },
  check: checkHSliderPropertyOrder,
};

ruleRegistry.register(hSliderPropertyOrderRule);

export { hSliderPropertyOrderRule };
