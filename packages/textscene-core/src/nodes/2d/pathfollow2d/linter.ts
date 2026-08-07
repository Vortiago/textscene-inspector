/**
 * Semantic linter rules for PathFollow2D (mirrors PathFollow3D, adapted to 2D).
 *
 * Format validation is in linterParser.ts. This file covers context-dependent
 * checks: PathFollow2D MUST be a direct child of a Path2D, and progress values
 * outside their valid ranges are flagged (Godot clamps them).
 *
 * The both-progress-properties message used to claim `progress_ratio` "takes
 * precedence" over `progress`. Neither half holds: `PackedScene::instantiate`
 * applies a node's stored properties in FILE ORDER through a plain sequential
 * `set()` loop (packed_scene.cpp:365-381), so whichever key appears LAST in
 * the file wins — and Godot's own saver can never write both, since
 * `progress_ratio` is declared `PROPERTY_USAGE_EDITOR` with no
 * `PROPERTY_USAGE_STORAGE` bit (path_2d.cpp:416), so the dual-key file only
 * arises when a human hand-writes both keys.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, findParentNode } from '../../../linter/linterUtils.js';

function checkPathFollow2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;

  const rawProps = node.properties as Record<string, string>;

  const parent = findParentNode(scene.nodes, node);
  if (!parent) {
    diagnostics.push({
      severity: 'error',
      message: `PathFollow2D '${node.name}' has no parent node. PathFollow2D MUST be a direct child of a Path2D node to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow2d-no-parent',
    });
  } else if (parent.type !== 'Path2D') {
    diagnostics.push({
      severity: 'error',
      message: `PathFollow2D '${node.name}' has parent '${parent.name}' of type '${parent.type}'. PathFollow2D MUST be a direct child of a Path2D node to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow2d-invalid-parent',
    });
  }

  if (rawProps.progress !== undefined) {
    const progress = parseFloat(rawProps.progress);
    if (!Number.isNaN(progress) && progress < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow2D 'progress' is negative (${progress}). Godot will clamp this to 0. Consider using 0 or a positive value.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow2d-negative-progress',
      });
    }
  }

  if (rawProps.progress_ratio !== undefined) {
    const ratio = parseFloat(rawProps.progress_ratio);
    if (!Number.isNaN(ratio) && (ratio < 0 || ratio > 1)) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow2D 'progress_ratio' is outside the 0-1 range (${ratio}). Godot will clamp this value. Valid range: 0.0 (start) to 1.0 (end).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow2d-progress-ratio-out-of-range',
      });
    }
  }

  // Neither always wins: Godot applies stored properties in FILE ORDER
  // (packed_scene.cpp:365-381), so whichever key comes last takes effect —
  // and this file could only exist hand-written, since progress_ratio carries
  // no PROPERTY_USAGE_STORAGE bit (path_2d.cpp:416) and Godot's own saver
  // never writes it.
  if (rawProps.progress !== undefined && rawProps.progress_ratio !== undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `PathFollow2D has both 'progress' and 'progress_ratio' set. Godot applies stored properties in file order (packed_scene.cpp:365-381), so whichever key appears LAST in the file wins — not always 'progress_ratio'. Godot's own saver never writes both: 'progress_ratio' has no PROPERTY_USAGE_STORAGE bit (path_2d.cpp:416), so this state only arises in a hand-written file.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow2d-both-progress-properties',
    });
  }

  return diagnostics;
}

const pathFollow2DValidationRule: LintRule = {
  meta: {
    name: 'valid-pathfollow2d',
    description: 'Validates PathFollow2D parent relationship and progress values',
    category: 'validation',
    applicableNodeTypes: ['PathFollow2D'],
    emits: [
      { ruleName: 'pathfollow2d-no-parent', severity: 'error' },
      { ruleName: 'pathfollow2d-invalid-parent', severity: 'error' },
      { ruleName: 'pathfollow2d-negative-progress', severity: 'warning' },
      { ruleName: 'pathfollow2d-progress-ratio-out-of-range', severity: 'warning' },
      { ruleName: 'pathfollow2d-both-progress-properties', severity: 'warning' },
    ],
  },
  check: checkPathFollow2D,
};

ruleRegistry.register(pathFollow2DValidationRule);

export { pathFollow2DValidationRule };
