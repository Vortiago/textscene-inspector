/**
 * Semantic linter rules for Node3D
 *
 * Note: Format validation (Vector3, Transform3D, boolean formats, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., visibility_parent node path exists).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { nodePathLiteral } from '../../../godot/index.js';

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
 * Parse NodePath value to extract the actual path
 * @param nodePathValue - Value like NodePath("path/to/node") or NodePath("")
 * @returns The extracted path, or null if invalid format
 */
function parseNodePath(nodePathValue: string): string | null {
  return nodePathLiteral(nodePathValue);
}

/**
 * Validate Node3D semantic rules (visibility_parent exists, etc.)
 */
function checkNode3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Applicability is enforced by the rule's applicableNodeTypeMatcher (every
  // *3D subclass), so no per-type guard is needed here.

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
      // Empty path is valid — it means no visibility parent
      // (`_update_visibility_parent` clears the RID and returns).
      //
      // `resolveNodePath` rather than a path map keyed from the SCENE ROOT. The
      // map answered a different question: `_update_visibility_parent` calls
      // `get_node_or_null(visibility_parent_path)` on the node itself, which
      // walks `data.children.getptr(name)` from there (node.cpp:1941), so a bare
      // `Mesh` means THIS node's own child. Keyed from the root it means the root
      // node's, which made `visibility_parent = NodePath("Mesh")` on any non-root
      // node an ERROR on a scene Godot loads — and a name that happened to exist
      // at the root passed while Godot failed. `%Name` needed a special case for
      // the same mismatch; the port handles it (node.cpp:1930-1937) with none.
      const target = resolveNodePath(scene, node, visibilityPath);
      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'error',
          message: `Visibility parent node not found: "${visibilityPath}". Node does not exist in scene tree.`,
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
    // Applies to Node3D and every spatial subclass (MeshInstance3D, Camera3D, …).
    // A predicate is required because getRulesForNodeType matches exact type
    // names, so a literal ['Node3D'] would never reach the subclasses. Asking
    // the real chain rather than the name: `endsWith('3D')` claimed
    // NavigationAgent3D, which descends from plain Node, and missed the 16
    // spatial types Godot did not suffix (GridMap, Decal, ReflectionProbe, …).
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Node3D'),
    emits: [
      {
        ruleName: 'valid-node3d-visibility',
        severity: 'error',
        grounding: { kind: 'engine', at: 'node_3d.cpp:1312' },
      },
    ],
  },
  check: checkNode3D,
};

// Self-register the rule
ruleRegistry.register(node3DValidationRule);

// Export for testing
export { node3DValidationRule };
