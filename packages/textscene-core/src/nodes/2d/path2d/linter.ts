/**
 * Semantic linter rules for Path2D.
 *
 * Format validation (the `curve` reference format) is handled by linterParser.ts
 * during strict parsing. This file covers semantic checks that need scene
 * context: the referenced Curve2D exists, and the path is actually followed.
 *
 * Divergence from Path3D (which ERRORs on a missing curve): in real 2D games a
 * Path2D's curve is frequently assigned at runtime via an attached script (e.g.
 * godot-open-rpg's gamepiece.tscn), so a missing `curve` is a WARNING and is
 * suppressed entirely when the node has a `script`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/** Does this node have any PathFollow2D descendant? */
function hasPathFollowChildren(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'PathFollow2D') return true;
    if (hasPathFollowChildren(child)) return true;
  }
  return false;
}

function checkPath2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  if (!rawProps.curve) {
    // A script commonly assigns the curve at runtime — don't warn in that case.
    if (!rawProps.script) {
      diagnostics.push({
        severity: 'warning',
        message: `Path2D '${node.name}' has no 'curve'. It will draw nothing until a Curve2D is assigned (often set at runtime via script).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'path2d-missing-curve',
      });
    }
  } else if (!checkResourceExists(scene, rawProps.curve)) {
    diagnostics.push({
      severity: 'error',
      message: `Curve resource not found: ${rawProps.curve}. The referenced Curve2D resource must exist in the scene.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-path2d-resources',
    });
  }

  if (!hasPathFollowChildren(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `Path2D '${node.name}' has no PathFollow2D children. Paths are typically followed by a PathFollow2D; add one if you intend to move a node along this path.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path2d-unused',
    });
  }

  return diagnostics;
}

const path2DValidationRule: LintRule = {
  meta: {
    name: 'valid-path2d',
    description: 'Validates Path2D curve resource references and checks for PathFollow2D children',
    category: 'validation',
    applicableNodeTypes: ['Path2D'],
    emits: [
      { ruleName: 'path2d-missing-curve', severity: 'warning' },
      { ruleName: 'valid-path2d-resources', severity: 'error' },
      { ruleName: 'path2d-unused', severity: 'warning' },
    ],
  },
  check: checkPath2D,
};

ruleRegistry.register(path2DValidationRule);

export { path2DValidationRule };
