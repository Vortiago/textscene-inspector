/**
 * Semantic linter rules for MeshInstance3D
 *
 * Note: Format validation (cast_shadow values, transform format, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { MeshInstance3DProperties } from './types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Threshold for warning about unusually high surface indices.
 * Most meshes have 1-8 surfaces; indices above this may indicate an issue.
 */
const SURFACE_INDEX_WARNING_THRESHOLD = 32;

/**
 * Check if properties are valid MeshInstance3D properties
 */
function isMeshInstance3DProperties(props: unknown): props is MeshInstance3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Recursively find a node by name in the scene tree
 */
function findNodeByName(nodes: TscnNode[], name: string): TscnNode | null {
  for (const node of nodes) {
    if (node.name === name) {
      return node;
    }
    const found = findNodeByName(node.children, name);
    if (found) {
      return found;
    }
  }
  return null;
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

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if mesh resource exists (if specified)
  if (rawProps.mesh) {
    const resourceExists = checkResourceExists(scene, rawProps.mesh);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Mesh resource not found: ${rawProps.mesh}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if material_override resource exists (if specified)
  if (rawProps.material_override) {
    const resourceExists = checkResourceExists(scene, rawProps.material_override);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Material override resource not found: ${rawProps.material_override}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if material_overlay resource exists (if specified)
  if (rawProps.material_overlay) {
    const resourceExists = checkResourceExists(scene, rawProps.material_overlay);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Material overlay resource not found: ${rawProps.material_overlay}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if skin resource exists (if specified)
  if (rawProps.skin) {
    const resourceExists = checkResourceExists(scene, rawProps.skin);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Skin resource not found: ${rawProps.skin}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-resources',
      });
    }
  }

  // Check if surface material override resources exist and validate indices
  for (const [key, value] of Object.entries(rawProps)) {
    const match = key.match(/^surface_material_override\/(\d+)$/);
    if (match) {
      const surfaceIndex = parseInt(match[1]!, 10);

      // Warn on unusually high indices (may indicate a problem)
      if (surfaceIndex > SURFACE_INDEX_WARNING_THRESHOLD) {
        diagnostics.push({
          severity: 'warning',
          message: `Surface material override index ${surfaceIndex} is unusually high (most meshes have < 32 surfaces), may indicate an error or impact performance`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-surface-index',
        });
      }

      // Check if resource exists
      const resourceExists = checkResourceExists(scene, value);
      if (!resourceExists) {
        diagnostics.push({
          severity: 'error',
          message: `Surface material override resource not found for surface ${surfaceIndex}: ${value}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-meshinstance3d-resources',
        });
      }
    }
  }

  // Validate visibility range logical consistency
  if (rawProps.visibility_range_begin !== undefined && rawProps.visibility_range_end !== undefined) {
    const rangeBegin = parseFloat(rawProps.visibility_range_begin);
    const rangeEnd = parseFloat(rawProps.visibility_range_end);
    if (!isNaN(rangeBegin) && !isNaN(rangeEnd) && rangeBegin > rangeEnd) {
      diagnostics.push({
        severity: 'error',
        message: `Invalid visibility range: begin (${rangeBegin}) must be less than or equal to end (${rangeEnd})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-meshinstance3d-visibility-range',
      });
    }
  }

  // Check if skeleton NodePath references an existing node
  if (rawProps.skeleton) {
    // Extract NodePath value
    const nodePathMatch = rawProps.skeleton.match(/^NodePath\("([^"]*)"\)$/);
    if (nodePathMatch && nodePathMatch[1]) {
      const skeletonPath = nodePathMatch[1];

      // Empty path is valid (means no skeleton)
      if (skeletonPath !== '') {
        // Extract the node name from the path (could be "NodeName" or "Parent/NodeName")
        const pathParts = skeletonPath.split('/');
        const nodeName = pathParts[pathParts.length - 1];

        // Find the skeleton node in the scene tree
        const skeletonNode = nodeName ? findNodeByName(scene.nodes, nodeName) : null;

        if (!skeletonNode) {
          diagnostics.push({
            severity: 'error',
            message: `Skeleton node not found: NodePath("${skeletonPath}")`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'valid-meshinstance3d-skeleton',
          });
        } else if (skeletonNode.type !== 'Skeleton3D') {
          diagnostics.push({
            severity: 'error',
            message: `Skeleton property points to a ${skeletonNode.type} node, but must point to a Skeleton3D node`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: 'valid-meshinstance3d-skeleton',
          });
        }
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
    description: 'Validates MeshInstance3D resource references, skeleton paths, and visibility ranges',
    category: 'validation',
    applicableNodeTypes: ['MeshInstance3D'],
  },
  check: checkMeshInstance3D,
};

// Self-register the rule
ruleRegistry.register(meshInstance3DValidationRule);

// Export for testing
export { meshInstance3DValidationRule };
