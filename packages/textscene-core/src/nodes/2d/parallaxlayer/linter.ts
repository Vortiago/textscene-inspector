/**
 * Ports `ParallaxLayer::get_configuration_warnings()`, which warns when the parent
 * is not a ParallaxBackground. Only `ParallaxBackground::_update_scroll` reaches
 * `set_base_offset_and_scale`, so elsewhere the `motion_*` keys do nothing. An
 * untyped `instance=` parent is left alone: its type is in a file this lint never opens.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { parentTypeVerdict, placementPhrase } from '../../../linter/parentType.js';

function checkParallaxLayer(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const verdict = parentTypeVerdict(scene, node, 'ParallaxBackground');
  if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

  return [
    {
      severity: 'warning',
      message: `ParallaxLayer '${node.name}' is ${placementPhrase(verdict)}. ParallaxLayer only works as a direct child of a ParallaxBackground; elsewhere its motion_scale, motion_offset and motion_mirroring have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'parallaxlayer-outside-parallaxbackground',
    },
  ];
}

const parallaxLayerParentRule: LintRule = {
  meta: {
    name: 'valid-parallaxlayer-parent',
    description:
      'Warns when a ParallaxLayer is not a direct child of a ParallaxBackground, where Godot never applies its motion properties',
    category: 'validation',
    applicableNodeTypes: ['ParallaxLayer'],
    emits: [{ ruleName: 'parallaxlayer-outside-parallaxbackground', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkParallaxLayer,
};

ruleRegistry.register(parallaxLayerParentRule);

export { parallaxLayerParentRule };
