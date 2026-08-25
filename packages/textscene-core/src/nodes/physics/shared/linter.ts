/**
 * Semantic linter rule shared by every CollisionObject3D-derived node.
 *
 * Registered under the abstract key `CollisionObject3D`, the same shape
 * `physics/shared/linterParser.ts` uses for its format validators, but for a
 * `LintRule` there is no base-chain walk to lean on (`RuleRegistry`
 * applicability is exact-match by design): `applicableNodeTypeMatcher` +
 * `descendsFrom` does the reaching instead.
 *
 * `CollisionObject3D::get_configuration_warnings()` (collision_object_3d.cpp:744)
 * checks the BODY'S OWN transform, not any child `CollisionShape3D`'s — a
 * different node and a different (though textually similar) test from
 * `collisionshape3d-non-uniform-scale` (collision_shape_3d.cpp:155), which
 * `collisionShapeLinterRule.ts` already covers:
 *
 *     Vector3 scale = get_transform().get_basis().get_scale();
 *     if (!(Math::is_zero_approx(scale.x - scale.y) && Math::is_zero_approx(scale.y - scale.z))) {
 *         warnings.push_back(RTR("With a non-uniform scale this node will probably not
 *             function as expected.\nPlease make its scale uniform ..."));
 *     }
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { isZeroApprox } from '../../../godot/math.js';
import { basisColumnScales } from '../../../linter/physics/basisColumnScales.js';

const RULE_NAME = 'collisionobject3d-non-uniform-scale';

function checkCollisionObject3DScale(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.properties as unknown as Record<string, string>;
  if (rawProps.transform === undefined) return [];

  const scales = basisColumnScales(rawProps.transform);
  if (!scales) return [];

  const [sx, sy, sz] = scales;
  if (isZeroApprox(sx - sy) && isZeroApprox(sy - sz)) return [];

  return [
    {
      severity: 'warning',
      message:
        `${node.type} '${node.name}' has a non-uniformly scaled transform ` +
        `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
        'function as expected. Keep its scale uniform and change the size of its collision ' +
        'shapes instead.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const collisionObject3DScaleRule: LintRule = {
  meta: {
    name: 'valid-collisionobject3d-scale',
    description:
      "Warns when a CollisionObject3D-derived node's own transform is scaled non-uniformly, which the physics engine cannot honour",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CollisionObject3D'),
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkCollisionObject3DScale,
};

ruleRegistry.register(collisionObject3DScaleRule);

export { collisionObject3DScaleRule };
