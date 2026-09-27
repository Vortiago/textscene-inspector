/**
 * Two of the three warnings of `XROrigin3D::get_configuration_warnings()` (xr_nodes.cpp:682-709): no
 * XRCamera3D child, and a scale other than (1, 1, 1). The third reads the project setting
 * `xr/shaders/enabled`, which no `.tscn` carries, outside the visibility guard, so it is not modelled.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isExplicitlyHidden } from '../../../../linter/parentType.js';
import { hasChildOfType } from '../../../../linter/childType.js';
import { hasNonUnitScale3D } from '../../../../linter/transformBasis.js';

const CAMERA_CHILD_RULE = 'xrorigin3d-missing-camera-child';
const SCALE_RULE = 'xrorigin3d-unsupported-scale';

function checkXROrigin3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const properties = node.properties as unknown as Record<string, string>;

  // An explicitly hidden origin never reaches Godot's own check either.
  if (isExplicitlyHidden(properties)) return [];

  const diagnostics: Diagnostic[] = [];

  // `get_child(i)` cast to `XRCamera3D` (xr_nodes.cpp:687-693). A child whose class lives
  // elsewhere may be one, so it keeps the rule quiet.
  if (!hasChildOfType(node, ['XRCamera3D'])) {
    diagnostics.push({
      severity: 'warning',
      message: `XROrigin3D '${node.name}' has no XRCamera3D child. XROrigin3D requires an XRCamera3D child node, the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: CAMERA_CHILD_RULE,
    });
  }

  // `!get_scale().is_equal_approx(Vector3(1, 1, 1))` (xr_nodes.cpp:698), which signs all three axes by
  // the determinant (core/math/basis.cpp:297-321). It reads the `transform` Basis, since
  // `position`/`rotation`/`scale` are `PROPERTY_USAGE_EDITOR`-only (node_3d.cpp:1526-1531).
  if (hasNonUnitScale3D(properties.transform)) {
    diagnostics.push({
      severity: 'warning',
      message: `XROrigin3D '${node.name}' has a non-identity scale. Changing the scale on the XROrigin3D node is not supported, change the World Scale (world_scale) instead — the same configuration warning Godot's own editor reports.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: SCALE_RULE,
    });
  }

  return diagnostics;
}

const xrOrigin3DValidationRule: LintRule = {
  meta: {
    name: 'valid-xrorigin3d',
    description:
      "Mirrors two of XROrigin3D::get_configuration_warnings' checks: a required XRCamera3D child, and an unsupported non-identity scale",
    category: 'validation',
    applicableNodeTypes: ['XROrigin3D'],
    emits: [
      { ruleName: CAMERA_CHILD_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: SCALE_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkXROrigin3D,
};

ruleRegistry.register(xrOrigin3DValidationRule);

export { xrOrigin3DValidationRule };
