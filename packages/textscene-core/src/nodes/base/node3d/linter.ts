/**
 * Semantic linter rules for Node3D
 *
 * Note: Format validation (Vector3, Transform3D, boolean formats, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., visibility_parent node path exists).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/**
 * Node3D properties interface for type checking
 */
interface Node3DProperties {
  name: string;
  parent?: string;
  transform?: unknown;
  visible?: boolean;
  top_level?: boolean;
  visibility_parent?: string;
  position?: unknown;
  rotation?: unknown;
  rotation_degrees?: unknown;
  scale?: unknown;
  quaternion?: unknown;
  basis?: unknown;
  global_position?: unknown;
  global_rotation?: unknown;
  global_rotation_degrees?: unknown;
  global_basis?: unknown;
  global_transform?: unknown;
  rotation_order?: number;
}

/**
 * Check if properties contain Node3D properties
 */
function hasNode3DProperties(props: unknown): props is Node3DProperties {
  return typeof props === 'object' && props !== null;
}

/**
 * Build a map of all node paths in the scene for fast lookup
 */
function buildNodePathMap(nodes: TscnNode[]): Map<string, TscnNode> {
  const pathMap = new Map<string, TscnNode>();

  function buildPath(node: TscnNode, parentPath: string): string {
    const nodeName = (node.properties as { name?: string }).name || '';
    const nodePath = parentPath ? `${parentPath}/${nodeName}` : nodeName;
    pathMap.set(nodePath, node);
    return nodePath;
  }

  function traverse(node: TscnNode, parentPath: string) {
    const currentPath = buildPath(node, parentPath);
    if (node.children) {
      for (const child of node.children) {
        traverse(child, currentPath);
      }
    }
  }

  // Find root nodes (nodes without parent or with parent=".")
  for (const node of nodes) {
    const props = node.properties as { parent?: string };
    if (!props.parent || props.parent === '.') {
      traverse(node, '');
    }
  }

  return pathMap;
}

/**
 * Parse NodePath value to extract the actual path
 * @param nodePathValue - Value like NodePath("path/to/node") or NodePath("")
 * @returns The extracted path, or null if invalid format
 */
function parseNodePath(nodePathValue: string): string | null {
  const match = nodePathValue.match(/^NodePath\("([^"]*)"\)$/);
  return match && match[1] !== undefined ? match[1] : null;
}

/**
 * Validate Node3D semantic rules (visibility_parent exists, etc.)
 */
function checkNode3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for Node3D nodes and its subclasses
  // Note: All 3D nodes inherit from Node3D, so this applies broadly
  if (node.type !== 'Node3D' && !node.type.endsWith('3D')) {
    return diagnostics;
  }

  // Type guard for properties
  if (!hasNode3DProperties(node.properties)) {
    return diagnostics;
  }

  const props = node.properties;

  // Check if visibility_parent NodePath exists (if specified)
  if (props.visibility_parent) {
    const visibilityPath: string | null = parseNodePath(props.visibility_parent);

    if (visibilityPath === null) {
      // Should be caught by linterParser, but double-check
      diagnostics.push({
        severity: 'error',
        message: `Invalid visibility_parent format: ${props.visibility_parent}`,
        nodeName: props.name,
        nodeType: node.type,
        ruleName: 'valid-node3d-visibility',
      });
    } else if (visibilityPath !== '') {
      // Empty path is valid (means no visibility parent), but non-empty must exist
      const nodePathMap = buildNodePathMap(scene.nodes);

      // Handle relative paths (starting with "." or containing "../")
      let resolvedPath = visibilityPath;

      // For absolute paths, check directly
      if (!visibilityPath.startsWith('.') && !visibilityPath.includes('../')) {
        if (!nodePathMap.has(resolvedPath)) {
          diagnostics.push({
            severity: 'error',
            message: `Visibility parent node not found: "${visibilityPath}". Node does not exist in scene tree.`,
            nodeName: props.name,
            nodeType: node.type,
            ruleName: 'valid-node3d-visibility',
          });
        }
      } else {
        // For relative paths, we'd need current node's path to resolve
        // This is more complex and can be added if needed
        diagnostics.push({
          severity: 'warning',
          message: `Relative visibility_parent paths like "${visibilityPath}" cannot be validated. Use absolute paths for better linting.`,
          nodeName: props.name,
          nodeType: node.type,
          ruleName: 'valid-node3d-visibility',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * Node3D semantic validation rule
 */
const node3DValidationRule: LintRule = {
  meta: {
    name: 'valid-node3d-visibility',
    description: 'Validates Node3D visibility_parent references exist in scene tree',
    category: 'validation',
    applicableNodeTypes: ['Node3D'], // Also applies to all Node3D subclasses
  },
  check: checkNode3D,
};

// Self-register the rule
ruleRegistry.register(node3DValidationRule);

// Export for testing
export { node3DValidationRule };
