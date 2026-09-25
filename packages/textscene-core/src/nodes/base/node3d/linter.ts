/**
 * Semantic linter rules for Node3D. linterParser.ts validates the format during strict parsing.
 * These rules need the full scene, for example whether the `visibility_parent` node exists.
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

/** Validates the Node3D semantic rules: `visibility_parent` names an existing node. */
function checkNode3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // The rule's applicableNodeTypeMatcher limits it to Node3D descendants. Read off the bag:
  // `Node3DProperties` does not model this key, and its `name`/`parent` are heading attributes
  // the strict parser never puts in `properties`.
  const raw = (node.properties as Record<string, unknown>).visibility_parent;

  if (typeof raw === 'string' && raw !== '') {
    const visibilityPath: string | null = parseNodePath(raw);

    if (visibilityPath === null) {
      // Should be caught by linterParser, but double-check
      reportArm(diagnostics, arms.visibilityParent, node, `Invalid visibility_parent format: ${raw}`);
    } else if (visibilityPath !== '') {
      // An empty path means no visibility parent. `_update_visibility_parent` calls
      // `get_node_or_null` on the node itself, which walks its children (node.cpp:1941), so a bare
      // `Mesh` is this node's own child, and `%Name` resolves through the owner
      // (node.cpp:1930-1937). `resolveNodePath` ports both.
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
    // Node3D and every spatial descendant. getRulesForNodeType matches exact type names, so this
    // needs a predicate. It asks the real chain: `endsWith('3D')` would claim NavigationAgent3D
    // (a plain Node) and miss the unsuffixed spatial types (GridMap, Decal, ReflectionProbe, …).
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Node3D'),
    emits: armEmits(arms),
  },
  check: checkNode3D,
};

ruleRegistry.register(node3DValidationRule);

// Export for testing
export { node3DValidationRule };
