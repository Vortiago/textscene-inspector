/**
 * Semantic linter rules for PathFollow3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, findParentNode } from '../../../linter/linterUtils.js';

/**
 * Validate PathFollow3D semantic rules
 */
function checkPathFollow3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for PathFollow3D nodes
  if (node.type !== 'PathFollow3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // CRITICAL: Check parent is Path3D (most common mistake with PathFollow3D)
  const parent = findParentNode(scene.nodes, node);
  if (!parent) {
    // PathFollow3D at root level (no parent)
    diagnostics.push({
      severity: 'error',
      message: `PathFollow3D '${node.name}' has no parent node. PathFollow3D MUST be a direct child of a Path3D node to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-no-parent',
    });
  } else if (parent.type !== 'Path3D') {
    // Parent exists but is not Path3D
    diagnostics.push({
      severity: 'error',
      message: `PathFollow3D '${node.name}' has parent '${parent.name}' of type '${parent.type}'. PathFollow3D MUST be a direct child of a Path3D node to function.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-invalid-parent',
    });
  }

  // WARNING: progress < 0 (will be clamped to 0 by Godot)
  if (rawProps.progress !== undefined) {
    const progress = parseFloat(rawProps.progress);
    if (!isNaN(progress) && progress < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D 'progress' is negative (${progress}). Godot will clamp this to 0. Consider using 0 or a positive value.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow3d-negative-progress',
      });
    }
  }

  // WARNING: progress_ratio outside 0-1 range (will be clamped)
  if (rawProps.progress_ratio !== undefined) {
    const progressRatio = parseFloat(rawProps.progress_ratio);
    if (!isNaN(progressRatio)) {
      if (progressRatio < 0 || progressRatio > 1) {
        diagnostics.push({
          severity: 'warning',
          message: `PathFollow3D 'progress_ratio' is outside the 0-1 range (${progressRatio}). Godot will clamp this value. Valid range: 0.0 (start) to 1.0 (end).`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'pathfollow3d-progress-ratio-out-of-range',
        });
      }
    }
  }

  // Warning: Both progress and progress_ratio set (progress_ratio takes precedence)
  if (rawProps.progress !== undefined && rawProps.progress_ratio !== undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `PathFollow3D has both 'progress' and 'progress_ratio' set. Note that 'progress_ratio' takes precedence and 'progress' will be ignored.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-both-progress-properties',
    });
  }

  // WARNING: rotation_mode ORIENTED requires Curve3D.up_vector_enabled
  if (rawProps.rotation_mode !== undefined) {
    const rotationMode = parseInt(rawProps.rotation_mode, 10);
    if (!isNaN(rotationMode) && rotationMode === 4) {
      // ROTATION_ORIENTED = 4
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D uses ROTATION_ORIENTED mode (rotation_mode=4). This requires the parent Path3D's Curve3D to have 'up_vector_enabled' set to true.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow3d-oriented-mode-requires-up-vector',
      });
    }
  }

  return diagnostics;
}

/**
 * PathFollow3D semantic validation rule
 */
const pathFollow3DValidationRule: LintRule = {
  meta: {
    name: 'valid-pathfollow3d',
    description: 'Validates PathFollow3D parent relationship, progress values, and rotation mode requirements',
    category: 'validation',
    applicableNodeTypes: ['PathFollow3D'],
    emits: [
      { ruleName: 'pathfollow3d-no-parent', severity: 'error' },
      { ruleName: 'pathfollow3d-invalid-parent', severity: 'error' },
      { ruleName: 'pathfollow3d-negative-progress', severity: 'warning' },
      { ruleName: 'pathfollow3d-progress-ratio-out-of-range', severity: 'warning' },
      { ruleName: 'pathfollow3d-both-progress-properties', severity: 'warning' },
      { ruleName: 'pathfollow3d-oriented-mode-requires-up-vector', severity: 'warning' },
    ],
  },
  check: checkPathFollow3D,
};

// Self-register the rule
ruleRegistry.register(pathFollow3DValidationRule);

// Export for testing
export { pathFollow3DValidationRule };
