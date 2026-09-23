/**
 * The non-uniform-scale rule shared by every CollisionObject3D-derived node,
 * reached through `applicableNodeTypeMatcher` and `descendsFrom`, since
 * `RuleRegistry` matches exact types. It checks the body's own transform
 * (collision_object_3d.cpp:744), not a child's (collision_shape_3d.cpp:155).
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
