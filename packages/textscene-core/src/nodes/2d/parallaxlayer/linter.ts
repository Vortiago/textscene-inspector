/**
 * Semantic linter rule for ParallaxLayer — Godot's own configuration warning,
 * `ParallaxLayer::get_configuration_warnings()`:
 *
 *     if (!Object::cast_to<ParallaxBackground>(get_parent())) {
 *         warnings.push_back(RTR("ParallaxLayer node only works when set as child of a ParallaxBackground node."));
 *     }
 *
 * It is not cosmetic: `set_base_offset_and_scale` is only ever reached from
 * `ParallaxBackground::_update_scroll`, which walks its OWN direct children, so a
 * layer anywhere else has its `motion_*` surface silently ignored.
 *
 * The parent's type has to be KNOWN before this can fire. A `.tscn` heading that
 * carries `instance=` and no `type=` takes its type from the instanced scene,
 * which the linter does not open (it lints one file), so such a parent is left
 * alone rather than reported as "not a ParallaxBackground".
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/** The node that holds `target` in its `children`, or null when it is a root. */
function findParent(nodes: readonly TscnNode[], target: TscnNode): TscnNode | null {
  for (const node of nodes) {
    if (node.children.includes(target)) return node;
    const nested = findParent(node.children, target);
    if (nested) return nested;
  }
  return null;
}

function checkParallaxLayer(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const parent = findParent(scene.nodes, node);
  // An instanced parent's type lives in another file; treat it as unknown.
  if (parent && (parent.instance || !parent.type)) return [];
  if (parent?.type === 'ParallaxBackground') return [];

  const where = parent ? `a ${parent.type} node` : 'the scene root';
  return [
    {
      severity: 'warning',
      message: `ParallaxLayer '${node.name}' is ${parent ? 'a child of' : ''} ${where}. ParallaxLayer only works as a direct child of a ParallaxBackground; elsewhere its motion_scale, motion_offset and motion_mirroring have no effect.`,
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
    emits: [{ ruleName: 'parallaxlayer-outside-parallaxbackground', severity: 'warning' }],
  },
  check: checkParallaxLayer,
};

ruleRegistry.register(parallaxLayerParentRule);

export { parallaxLayerParentRule };
