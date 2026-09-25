/**
 * Semantic linter rule for SpringBoneCollision3D: Godot's own configuration warning "Parent node
 * should be a SpringBoneSimulator3D node." from
 * `SpringBoneCollision3D::get_configuration_warnings()`. Per doc/classes/SpringBoneCollision3D.xml,
 * the simulator does the colliding, so a collision anywhere else has no effect.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';

function checkSpringBoneCollision3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;

  const verdict = parentTypeVerdict(scene, node, 'SpringBoneSimulator3D');
  // A parent heading with `instance=` and no `type=` takes its type from a scene the linter does
  // not open, so an `unknowable` parent is left alone.
  if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

  return [
    {
      severity: 'warning',
      message: `SpringBoneCollision3D '${node.name}' is ${placementPhrase(verdict)}. SpringBoneCollision3D only has an effect as a child of a SpringBoneSimulator3D; elsewhere it is never consulted and collides with nothing.`,
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
    emits: [{ ruleName: 'springbonecollision3d-outside-springbonesimulator3d', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkSpringBoneCollision3D,
};

ruleRegistry.register(springBoneCollision3DParentRule);

export { springBoneCollision3DParentRule };
