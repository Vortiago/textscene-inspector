/**
 * Semantic linter rules for Camera3D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { rangeAdvisories } from '../../../linter/rangeAdvisory.js';

// Thresholds for warnings
const MIN_NEAR_CLIPPING_WARNING = 0.01;
const MAX_FAR_CLIPPING_WARNING = 10000;
const MIN_NORMAL_FOV = 20;
const MAX_NORMAL_FOV = 120;

/**
 * Validate Camera3D semantic rules
 */
function checkCamera3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for Camera3D nodes
  if (node.type !== 'Camera3D') {
    return diagnostics;
  }

  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // No missing-fov rule: Godot's serializer OMITS default-valued properties,
  // so an editor-authored perspective camera at the default fov (75, per
  // camera_3d.h) has no `fov` line at all — absence is the normal form, and
  // the parser supplies the same default. Only explicit out-of-range values
  // are worth flagging (the range advisories below).

  // ERROR: near must be less than far (cross-field consistency, not a range advisory)
  if (rawProps.near !== undefined && rawProps.far !== undefined) {
    const near = parseFloat(rawProps.near);
    const far = parseFloat(rawProps.far);

    if (!isNaN(near) && !isNaN(far)) {
      if (near >= far) {
        diagnostics.push({
          severity: 'error',
          message: `Camera3D 'near' clipping plane (${near}) must be less than 'far' clipping plane (${far}). Invalid clipping planes will cause rendering issues.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'camera3d-invalid-clipping-planes',
        });
      }
    }
  }

  // Range advisories: tiny near plane, huge far plane, extreme fov.
  diagnostics.push(
    ...rangeAdvisories(node, {
      near: [
        {
          under: MIN_NEAR_CLIPPING_WARNING,
          ruleName: 'camera3d-small-near-plane',
          message: (near) =>
            `Camera3D 'near' clipping plane is very small (${near}). Values below ${MIN_NEAR_CLIPPING_WARNING} can cause z-fighting and depth precision issues.`,
        },
      ],
      far: [
        {
          over: MAX_FAR_CLIPPING_WARNING,
          ruleName: 'camera3d-large-far-plane',
          message: (far) =>
            `Camera3D 'far' clipping plane is very large (${far}). Values above ${MAX_FAR_CLIPPING_WARNING} can cause depth precision issues and reduce rendering quality.`,
        },
      ],
      fov: [
        {
          under: MIN_NORMAL_FOV,
          ruleName: 'camera3d-extreme-fov',
          message: (fov) =>
            `Camera3D field of view is very narrow (${fov} degrees). Values below ${MIN_NORMAL_FOV} degrees are unusual for games and may create a 'tunnel vision' effect.`,
        },
        {
          over: MAX_NORMAL_FOV,
          ruleName: 'camera3d-extreme-fov',
          message: (fov) =>
            `Camera3D field of view is very wide (${fov} degrees). Values above ${MAX_NORMAL_FOV} degrees are unusual for games and may cause distortion at screen edges.`,
        },
      ],
    })
  );

  return diagnostics;
}

/**
 * Camera3D semantic validation rule
 */
const camera3DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera3d-properties',
    description: 'Validates Camera3D property values, required properties, clipping plane relationships, and performance considerations',
    category: 'validation',
    emits: [
      { ruleName: 'camera3d-invalid-clipping-planes', severity: 'error' },
      { ruleName: 'camera3d-small-near-plane', severity: 'warning' },
      { ruleName: 'camera3d-large-far-plane', severity: 'warning' },
      { ruleName: 'camera3d-extreme-fov', severity: 'warning' },
    ],
    applicableNodeTypes: ['Camera3D'],
  },
  check: checkCamera3D,
};

// Self-register the rule
ruleRegistry.register(camera3DValidationRule);

// Export for testing
export { camera3DValidationRule };
