/**
 * Semantic linter rule for SpringBoneCollision3D — Godot's own configuration
 * warning, `SpringBoneCollision3D::get_configuration_warnings()`:
 *
 *     SpringBoneSimulator3D *parent = Object::cast_to<SpringBoneSimulator3D>(get_parent());
 *     if (!parent) {
 *         warnings.push_back(RTR("Parent node should be a SpringBoneSimulator3D node."));
 *     }
 *
 * It is not cosmetic: per doc/classes/SpringBoneCollision3D.xml, "The colliding
 * and sliding are done in the SpringBoneSimulator3D's modification process...
 * If it is not a child of SpringBoneSimulator3D, it has no effect." A collision
 * anywhere else is inert — never consulted by any simulation pass.
 *
 * The parent's type has to be KNOWN before this can fire. A `.tscn` heading that
 * carries `instance=` and no `type=` takes its type from the instanced scene,
 * which the linter does not open (it lints one file), so such a parent is left
 * alone rather than reported as "not a SpringBoneSimulator3D".
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { findParentNode } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';

function checkSpringBoneCollision3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const parent = findParentNode(scene.nodes, node);
  // An instanced parent's type lives in another file; treat it as unknown.
  if (parent && isTypeUnknowable(parent)) return [];
  if (parent?.type === 'SpringBoneSimulator3D') return [];

  const where = parent ? `a child of a ${parent.type} node` : 'the scene root';
  return [
    {
      severity: 'warning',
      message: `SpringBoneCollision3D '${node.name}' is ${where}. SpringBoneCollision3D only has an effect as a child of a SpringBoneSimulator3D; elsewhere it is never consulted and collides with nothing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonecollision3d-outside-springbonesimulator3d',
    },
  ];
}

const springBoneCollision3DParentRule: LintRule = {
  meta: {
    name: 'valid-springbonecollision3d-parent',
    description:
      'Warns when a SpringBoneCollision3D is not a direct child of a SpringBoneSimulator3D, where Godot never consults it',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SpringBoneCollision3D'),
    emits: [{ ruleName: 'springbonecollision3d-outside-springbonesimulator3d', severity: 'warning' }],
  },
  check: checkSpringBoneCollision3D,
};

ruleRegistry.register(springBoneCollision3DParentRule);

export { springBoneCollision3DParentRule };
