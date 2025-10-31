/**
 * Semantic linter rules for Path3D
 *
 * Note: Format validation (curve resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., curve resource exists, PathFollow3D children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Check if a node has any PathFollow3D children
 */
function hasPathFollowChildren(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'PathFollow3D') {
      return true;
    }
    // Recursively check nested children
    if (hasPathFollowChildren(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate Path3D semantic rules
 */
function checkPath3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for Path3D nodes
  if (node.type !== 'Path3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // ERROR: curve property is REQUIRED
  if (!rawProps.curve) {
    diagnostics.push({
      severity: 'error',
      message: `Path3D '${node.name}' is missing required property 'curve'. A Path3D without a Curve3D resource is useless.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path3d-requires-curve',
    });
  } else {
    // ERROR: Check if curve resource exists in scene
    const resourceExists = checkResourceExists(scene, rawProps.curve);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Curve resource not found: ${rawProps.curve}. The referenced Curve3D resource must exist in the scene.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-path3d-resources',
      });
    }
  }

  // WARNING: Check if Path3D has PathFollow3D children
  // Paths are typically used with PathFollow3D nodes, though they can be accessed programmatically
  if (!hasPathFollowChildren(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `Path3D '${node.name}' has no PathFollow3D children. While paths can be used programmatically, they are typically followed by PathFollow3D nodes. Consider adding a PathFollow3D child if you intend to animate objects along this path.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path3d-unused',
    });
  }

  return diagnostics;
}

/**
 * Path3D semantic validation rule
 */
const path3DValidationRule: LintRule = {
  meta: {
    name: 'valid-path3d',
    description: 'Validates Path3D curve resource references and checks for PathFollow3D children',
    category: 'validation',
    applicableNodeTypes: ['Path3D'],
  },
  check: checkPath3D,
};

// Self-register the rule
ruleRegistry.register(path3DValidationRule);

// Export for testing
export { path3DValidationRule };
