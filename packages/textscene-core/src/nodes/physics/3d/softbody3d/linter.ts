/**
 * Semantic linter rule for SoftBody3D.
 *
 * Ports SoftBody3D::get_configuration_warnings (soft_body_3d.cpp:401-407): it
 * calls the base MeshInstance3D warnings (MeshInstance3D itself has none to
 * add: visual_instance_3d.cpp has no mesh-null check either), then adds its
 * own: `if (mesh.is_null()) warnings.push_back(RTR("This body will be ignored
 * until you set a mesh."));`. `mesh` is a plain resource property here, not a
 * NodePath, so nothing about resolving an instanced sub-scene's node types
 * applies: the check is a direct presence test on this node's own `mesh` key.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

/**
 * Validate SoftBody3D semantic rules.
 */
function checkSoftBody3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  if (!descendsFrom(node.type, 'SoftBody3D')) {
    return diagnostics;
  }

  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  if (!rawProps.mesh || rawProps.mesh.trim() === '') {
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

/**
 * SoftBody3D semantic validation rule.
 */
const softBody3DValidationRule: LintRule = {
  meta: {
    name: 'valid-softbody3d-mesh',
    description: 'Warns when a SoftBody3D has no mesh set, matching Godot\'s own configuration warning',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SoftBody3D'),
    emits: [{ ruleName: 'valid-softbody3d-mesh', severity: 'warning' }],
  },
  check: checkSoftBody3D,
};

// Self-register the rule
ruleRegistry.register(softBody3DValidationRule);

// Export for testing
export { softBody3DValidationRule };
