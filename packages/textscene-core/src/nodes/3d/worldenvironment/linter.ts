/**
 * Semantic linter rules for WorldEnvironment
 *
 * Note: Format validation (resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., resource references exist, multiple WorldEnvironment nodes).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Resolve the `sky` reference stored inside the Environment SubResource that a
 * WorldEnvironment references. Only SubResource environment references can be
 * inspected (ExtResource environments live in another file); returns undefined
 * when the environment isn't a local SubResource or carries no sky property.
 */
function getEnvironmentSkyReference(
  scene: TscnScene,
  environmentRef: string
): string | undefined {
  const match = environmentRef.match(/^SubResource\("([\w-]+)"\)$/);
  if (!match) return undefined;
  const envId = match[1];
  const env = scene.internalResources?.find((r) => r.data?.id === envId);
  const sky = env?.data?.sky;
  return typeof sky === 'string' ? sky : undefined;
}

/**
 * Count WorldEnvironment nodes in the scene tree
 */
function countWorldEnvironmentNodes(nodes: TscnNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'WorldEnvironment') {
      count++;
    }
    count += countWorldEnvironmentNodes(node.children);
  }
  return count;
}

/**
 * Validate WorldEnvironment semantic rules
 */
function checkWorldEnvironment(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for WorldEnvironment nodes
  if (node.type !== 'WorldEnvironment') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if environment property exists (REQUIRED)
  if (!rawProps.environment) {
    diagnostics.push({
      severity: 'error',
      message: `WorldEnvironment requires an 'environment' property. A WorldEnvironment without an Environment resource does nothing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'worldenvironment-requires-environment',
    });
  } else {
    // Check if environment resource exists
    const resourceExists = checkResourceExists(scene, rawProps.environment);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Environment resource not found: ${rawProps.environment}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-worldenvironment-resources',
      });
    } else {
      // The Environment subresource may reference a Sky subresource; existence-check
      // it like the environment reference itself (the render parser reads sky too).
      const skyRef = getEnvironmentSkyReference(scene, rawProps.environment);
      if (skyRef && !checkResourceExists(scene, skyRef)) {
        diagnostics.push({
          severity: 'error',
          message: `Sky resource not found: ${skyRef}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-worldenvironment-resources',
        });
      }
    }
  }

  // Check if camera_attributes resource exists (if specified - this is optional)
  if (rawProps.camera_attributes) {
    const resourceExists = checkResourceExists(scene, rawProps.camera_attributes);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera attributes resource not found: ${rawProps.camera_attributes}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-worldenvironment-resources',
      });
    }
  }

  // Check if there are multiple WorldEnvironment nodes (only one should be active)
  const worldEnvCount = countWorldEnvironmentNodes(scene.nodes);
  if (worldEnvCount > 1) {
    diagnostics.push({
      severity: 'warning',
      message: `Scene contains ${worldEnvCount} WorldEnvironment nodes. Only one WorldEnvironment should be active in a scene to avoid conflicts.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'single-worldenvironment',
    });
  }

  return diagnostics;
}

/**
 * WorldEnvironment semantic validation rule
 */
const worldEnvironmentValidationRule: LintRule = {
  meta: {
    name: 'valid-worldenvironment',
    description: 'Validates WorldEnvironment resource references and ensures only one WorldEnvironment exists',
    category: 'validation',
    applicableNodeTypes: ['WorldEnvironment'],
  },
  check: checkWorldEnvironment,
};

// Self-register the rule
ruleRegistry.register(worldEnvironmentValidationRule);

// Export for testing
export { worldEnvironmentValidationRule };
