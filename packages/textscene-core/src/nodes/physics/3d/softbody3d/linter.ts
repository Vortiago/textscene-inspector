/**
 * Semantic linter rule for SoftBody3D: ports get_configuration_warnings
 * (soft_body_3d.cpp:401-407). MeshInstance3D adds no mesh warning
 * (visual_instance_3d.cpp), so the one check is a presence test on this node's
 * own `mesh` resource key, not a NodePath to resolve.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  missingMesh: groundedArm('valid-softbody3d-mesh', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

function checkSoftBody3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.rawProperties;

  if (resourceSlotIsEmpty(rawProps.mesh)) {
    reportArm(diagnostics, arms.missingMesh, node, 'This body will be ignored until you set a mesh.');
  }

  return diagnostics;
}

const softBody3DValidationRule: LintRule = {
  meta: {
    name: 'valid-softbody3d-mesh',
    description: "Warns when a SoftBody3D has no mesh set, matching Godot's own configuration warning",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SoftBody3D'),
    emits: armEmits(arms),
  },
  check: checkSoftBody3D,
};

ruleRegistry.register(softBody3DValidationRule);

// Export for testing
export { softBody3DValidationRule };
