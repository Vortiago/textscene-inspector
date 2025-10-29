/**
 * Semantic linter rules for MeshInstance3D
 *
 * Note: Format validation (cast_shadow values, transform format, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../linter/types.js';
import type { MeshInstance3DProperties } from './types.js';
import { ruleRegistry } from '../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../linter/resourceChecker.js';

/**
 * Check if properties are valid MeshInstance3D properties
 */
function isMeshInstance3DProperties(props: unknown): props is MeshInstance3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Validate MeshInstance3D semantic rules (resource references, etc.)
 */
function checkMeshInstance3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for MeshInstance3D nodes
  if (node.type !== 'MeshInstance3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isMeshInstance3DProperties(node.properties)) {
    return diagnostics;
  }

  const props = node.properties;

  // Check if mesh resource exists (if specified)
  if (props.mesh) {
    const resourceExists = checkResourceExists(scene, props.mesh);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Mesh resource not found: ${props.mesh}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if skin resource exists (if specified)
  if (props.skin) {
    const resourceExists = checkResourceExists(scene, props.skin);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Skin resource not found: ${props.skin}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if surface material override resources exist
  if (props.surfaceMaterialOverrides) {
    for (const [surfaceIndex, materialRef] of props.surfaceMaterialOverrides.entries()) {
      const resourceExists = checkResourceExists(scene, materialRef);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Surface material override resource not found for surface ${surfaceIndex}: ${materialRef}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-resources',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * MeshInstance3D semantic validation rule
 */
const meshInstance3DValidationRule: LintRule = {
  meta: {
    name: 'valid-meshinstance3d-resources',
    description: 'Validates MeshInstance3D resource references (mesh, skin, surface materials exist)',
    category: 'validation',
    applicableNodeTypes: ['MeshInstance3D'],
  },
  check: checkMeshInstance3D,
};

// Self-register the rule
ruleRegistry.register(meshInstance3DValidationRule);

// Export for testing
export { meshInstance3DValidationRule };
