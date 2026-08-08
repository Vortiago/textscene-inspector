/**
 * Semantic linter rules for Camera2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

/**
 * Count enabled Camera2D nodes in the scene
 */
function countEnabledCameras(scene: TscnScene): number {
  let count = 0;

  function traverse(nodes: TscnScene['nodes']): void {
    for (const node of nodes) {
      if (node.type === 'Camera2D') {
        if (isValidProperties(node.properties)) {
          const props = node.properties as Record<string, string>;
          // Default is enabled=true if not specified
          const enabled = props.enabled !== 'false';
          if (enabled) {
            count++;
          }
        } else {
          // No properties means defaults, so enabled=true
          count++;
        }
      }
      // Recursively check children
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(scene.nodes);
  return count;
}

/**
 * Validate Camera2D semantic rules
 */
function checkCamera2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Check for multiple enabled cameras first (before properties guard)
  // This check should run even if properties are empty (defaults to enabled=true)
  const rawProps = isValidProperties(node.properties) ? (node.properties as Record<string, string>) : {};
  const thisEnabled = rawProps.enabled !== 'false'; // Default is enabled=true
  if (thisEnabled) {
    const enabledCount = countEnabledCameras(scene);
    if (enabledCount > 1) {
      diagnostics.push({
        severity: 'warning',
        message: `Multiple enabled Camera2D nodes detected in scene (${enabledCount} total). Only one Camera2D should typically be enabled at a time to avoid viewport conflicts.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-multiple-enabled',
      });
    }
  }

  // Type guard for remaining validations (skip if no properties)
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  // Validate limit consistency
  if (rawProps.limit_left !== undefined && rawProps.limit_right !== undefined) {
    const left = parseInt(rawProps.limit_left, 10);
    const right = parseInt(rawProps.limit_right, 10);

    if (!isNaN(left) && !isNaN(right) && right < left) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D 'limit_right' (${right}) is less than 'limit_left' (${left}). This creates an invalid horizontal scroll area and may cause unexpected camera behavior.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-invalid-horizontal-limits',
      });
    }
  }

  if (rawProps.limit_top !== undefined && rawProps.limit_bottom !== undefined) {
    const top = parseInt(rawProps.limit_top, 10);
    const bottom = parseInt(rawProps.limit_bottom, 10);

    if (!isNaN(top) && !isNaN(bottom) && bottom < top) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D 'limit_bottom' (${bottom}) is less than 'limit_top' (${top}). This creates an invalid vertical scroll area and may cause unexpected camera behavior.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-invalid-vertical-limits',
      });
    }
  }

  // WARNING: position_smoothing_enabled with a speed that cannot smooth
  if (
    rawProps.position_smoothing_enabled === 'true' &&
    rawProps.position_smoothing_speed !== undefined
  ) {
    const speed = parseFloat(rawProps.position_smoothing_speed);
    if (!isNaN(speed) && speed <= 0) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is ${speed}. Speed must be greater than 0 for smoothing to work.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-smoothing-speed-invalid',
      });
    }
  }

  // WARNING: rotation_smoothing_enabled with a speed that cannot smooth
  if (
    rawProps.rotation_smoothing_enabled === 'true' &&
    rawProps.rotation_smoothing_speed !== undefined
  ) {
    const speed = parseFloat(rawProps.rotation_smoothing_speed);
    if (!isNaN(speed) && speed <= 0) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D has 'rotation_smoothing_enabled' set to true but 'rotation_smoothing_speed' is ${speed}. Speed must be greater than 0 for rotation smoothing to work.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-rotation-smoothing-speed-invalid',
      });
    }
  }

  return diagnostics;
}

/**
 * Camera2D semantic validation rule
 */
const camera2DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera2d-properties',
    description: 'Validates Camera2D limit consistency and smoothing configuration',
    category: 'validation',
    applicableNodeTypes: ['Camera2D'],
    emits: [
      {
        ruleName: 'camera2d-multiple-enabled',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:354',
          unused: 'a second camera entering a tree that already has a current one never becomes current',
        },
      },
      {
        ruleName: 'camera2d-invalid-horizontal-limits',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:229',
          unused: 'the degenerate branch centres the view instead of applying the limits',
        },
      },
      {
        ruleName: 'camera2d-invalid-vertical-limits',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:241',
          unused: 'the degenerate branch centres the view instead of applying the limits',
        },
      },
      {
        ruleName: 'camera2d-smoothing-speed-invalid',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'camera_2d.cpp:703' },
      },
      {
        ruleName: 'camera2d-rotation-smoothing-speed-invalid',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'camera_2d.cpp:715' },
      },
    ],
  },
  check: checkCamera2D,
};

// Self-register the rule
ruleRegistry.register(camera2DValidationRule);

// Export for testing
export { camera2DValidationRule };
