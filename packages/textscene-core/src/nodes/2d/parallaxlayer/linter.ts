/**
 * Ports `ParallaxLayer::get_configuration_warnings()`, which warns when the parent
 * is not a ParallaxBackground. Only `ParallaxBackground::_update_scroll` reaches
 * `set_base_offset_and_scale`, so elsewhere the `motion_*` keys do nothing. An
 * untyped `instance=` parent is left alone: its type is in a file this lint never opens.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../linter/ruleArms.js';
import { parentTypeVerdict, placementPhrase } from '../../../linter/parentType.js';

const arms = {
  outsideParallaxBackground: {
    severity: 'warning',
    ruleName: 'parallaxlayer-outside-parallaxbackground',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

function checkParallaxLayer(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const verdict = parentTypeVerdict(scene, node, 'ParallaxBackground');
  if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

  return [
    armDiagnostic(
      arms.outsideParallaxBackground,
      node,
      `ParallaxLayer '${node.name}' is ${placementPhrase(verdict)}. ParallaxLayer only works as a direct child of a ParallaxBackground; elsewhere its motion_scale, motion_offset and motion_mirroring have no effect.`
    ),
  ];
}

const parallaxLayerParentRule: LintRule = {
  meta: {
    name: 'valid-parallaxlayer-parent',
    description:
      'Warns when a ParallaxLayer is not a direct child of a ParallaxBackground, where Godot never applies its motion properties',
    category: 'validation',
    applicableNodeTypes: ['ParallaxLayer'],
    emits: armEmits(arms),
  },
  check: checkParallaxLayer,
};

ruleRegistry.register(parallaxLayerParentRule);

export { parallaxLayerParentRule };
