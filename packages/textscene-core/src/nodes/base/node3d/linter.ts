/**
 * Semantic linter rules for Node3D
 *
 * Note: Format validation (Vector3, Transform3D, boolean formats, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., visibility_parent node path exists).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { resolveNodePath } from '../../../linter/nodePathResolve.js';
import { nodePathLiteral } from '../../../godot/index.js';

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
/**
 * One arm, reported with two messages: the format is a fallback for what
 * `linterParser` already rejects, and both say the same thing about the same
 * property at the same tier, so a second `ruleName` would name a distinction
 * nothing downstream makes.
 */
const arms = {
  visibilityParent: {
    severity: 'error',
    ruleName: 'valid-node3d-visibility',
    grounding: { kind: 'engine', at: 'node_3d.cpp:1312' },
  },
} as const satisfies RuleArms<'visibilityParent'>;

function checkNode3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Applicability is enforced by the rule's applicableNodeTypeMatcher (every
  // *3D subclass), so no per-type guard is needed here.
  //
  // Read off the bag rather than through a local interface: the slice's own
  // `Node3DProperties` is what the parser publishes and does not model this
  // key, so a second one declaring it narrowed to a union that has it on
  // neither arm — and its `name`/`parent` members are heading attributes the
  // strict parser never puts in `properties`, which is how every diagnostic
  // below came out naming `undefined`.
  const raw = (node.properties as Record<string, unknown>).visibility_parent;

  if (typeof raw === 'string' && raw !== '') {
    const visibilityPath: string | null = parseNodePath(raw);

    if (visibilityPath === null) {
      // Should be caught by linterParser, but double-check
      reportArm(diagnostics, arms.visibilityParent, node, `Invalid visibility_parent format: ${raw}`);
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
        reportArm(
          diagnostics,
          arms.visibilityParent,
          node,
          `Visibility parent node not found: "${visibilityPath}". Node does not exist in scene tree.`
        );
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
    emits: armEmits(arms),
  },
  check: checkNode3D,
};

// Self-register the rule
ruleRegistry.register(node3DValidationRule);

// Export for testing
export { node3DValidationRule };
