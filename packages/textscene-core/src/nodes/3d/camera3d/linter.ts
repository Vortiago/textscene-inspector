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

// Projection mode constants
const PROJECTION_PERSPECTIVE = 0;

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

  // Get projection mode (default to PERSPECTIVE if not specified)
  const projection = rawProps.projection !== undefined ? parseInt(rawProps.projection, 10) : PROJECTION_PERSPECTIVE;

  // ERROR: fov is required for PERSPECTIVE projection (unless attributes overrides it)
  if (projection === PROJECTION_PERSPECTIVE && rawProps.fov === undefined && rawProps.attributes === undefined) {
    diagnostics.push({
      severity: 'error',
      message: `Camera3D with PERSPECTIVE projection (projection=0) requires 'fov' property. This defines the field of view in degrees.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera3d-missing-fov',
    });
  }

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
      { ruleName: 'camera3d-missing-fov', severity: 'error' },
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
