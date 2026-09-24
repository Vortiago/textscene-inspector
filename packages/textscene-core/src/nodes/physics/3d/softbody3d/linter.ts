/**
 * Semantic linter rule for SoftBody3D: ports get_configuration_warnings
 * (soft_body_3d.cpp:401-407). MeshInstance3D adds no mesh warning
 * (visual_instance_3d.cpp), so the one check is a presence test on this node's
 * own `mesh` resource key, not a NodePath to resolve.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';

function checkSoftBody3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;


  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  if (resourceSlotIsEmpty(rawProps.mesh)) {
    diagnostics.push({
      severity: 'warning',
      message: 'This body will be ignored until you set a mesh.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-softbody3d-mesh',
    });
  }

  return diagnostics;
}

const softBody3DValidationRule: LintRule = {
  meta: {
    name: 'valid-softbody3d-mesh',
    description: 'Warns when a SoftBody3D has no mesh set, matching Godot\'s own configuration warning',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SoftBody3D'),
    emits: [{ ruleName: 'valid-softbody3d-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkSoftBody3D,
};

ruleRegistry.register(softBody3DValidationRule);

// Export for testing
export { softBody3DValidationRule };
