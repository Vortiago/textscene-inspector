/**
 * The scale warning of `Light3D::get_configuration_warnings()` (light_3d.cpp:181-189),
 * for every descendant through `applicableNodeTypeMatcher`, AreaLight3D included
 * through `UNCATALOGUED`. Light3D is abstract, and `RuleRegistry` matches
 * `applicableNodeTypes` by exact name.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { hasNonUnitScale3D } from '../../../../linter/transformBasis.js';

const SCALE_RULE = 'light3d-non-unit-scale';

function checkLight3DScale(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // Only `transform` serialises the pose (node_3d.cpp:1526-1531). `Basis::get_scale()`
  // (core/math/basis.cpp:299-321) folds one det sign across all axes and
  // `decomposeTransform3D` into one axis, but a reflection leaves an axis negative
  // under both, so they agree on `(1, 1, 1)`, as in `xrorigin3d/linter.ts`.
  if (!hasNonUnitScale3D(properties.transform)) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' has a non-unit scale. A light's scale does not affect the visual size of the light, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: SCALE_RULE,
    },
  ];
}

const light3DScaleValidationRule: LintRule = {
  meta: {
    name: 'valid-light3d-scale',
    description:
      "Mirrors Light3D::get_configuration_warnings' own-scale check across every concrete light type",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Light3D'),
    emits: [{ ruleName: SCALE_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkLight3DScale,
};

ruleRegistry.register(light3DScaleValidationRule);

export { light3DScaleValidationRule };
