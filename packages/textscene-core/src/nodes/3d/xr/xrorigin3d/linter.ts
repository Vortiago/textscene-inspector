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
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  missingCameraChild: groundedArm('xrorigin3d-missing-camera-child', { kind: 'configuration-warning' }),
  unsupportedScale: groundedArm('xrorigin3d-unsupported-scale', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

function checkXROrigin3D(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // An explicitly hidden origin never reaches Godot's own check either.
  if (isExplicitlyHidden(node)) return [];

  const diagnostics: Diagnostic[] = [];

  // `get_child(i)` cast to `XRCamera3D` (xr_nodes.cpp:687-693). A child whose class lives
  // elsewhere may be one, so it keeps the rule quiet.
  if (!hasChildOfType(node, ['XRCamera3D'])) {
    reportArm(
      diagnostics,
      arms.missingCameraChild,
      node,
      `XROrigin3D '${node.name}' has no XRCamera3D child. XROrigin3D requires an XRCamera3D child node, the same configuration warning Godot's own editor reports.`
    );
  }

  // `!get_scale().is_equal_approx(Vector3(1, 1, 1))` (xr_nodes.cpp:698), which signs all three axes by
  // the determinant (core/math/basis.cpp:297-321). It reads the `transform` Basis, since
  // `position`/`rotation`/`scale` are `PROPERTY_USAGE_EDITOR`-only (node_3d.cpp:1526-1531).
  if (hasNonUnitScale3D(node.rawProperties.transform)) {
    reportArm(
      diagnostics,
      arms.unsupportedScale,
      node,
      `XROrigin3D '${node.name}' has a non-identity scale. Changing the scale on the XROrigin3D node is not supported, change the World Scale (world_scale) instead — the same configuration warning Godot's own editor reports.`
    );
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
    emits: armEmits(arms),
  },
  check: checkXROrigin3D,
};

ruleRegistry.register(xrOrigin3DValidationRule);

export { xrOrigin3DValidationRule };
