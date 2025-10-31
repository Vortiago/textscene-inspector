/**
 * Semantic linter rules for Camera2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/**
 * Check if properties object exists and is valid
 */
function isValidProperties(props: unknown): props is Record<string, string> {
  return typeof props === 'object' && props !== null;
}

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

  // Only run for Camera2D nodes
  if (node.type !== 'Camera2D') {
    return diagnostics;
  }

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

  // Validate zoom components (parsed value check for semantic validation)
  if (rawProps.zoom !== undefined) {
    const match = rawProps.zoom.match(/^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/);
    if (match && match[1] && match[2]) {
      const x = parseFloat(match[1]);
      const y = parseFloat(match[2]);

      // Already checked in linterParser, but double-check for semantic context
      if (x <= 0 || y <= 0) {
        diagnostics.push({
          severity: 'error',
          message: `Camera2D 'zoom' components must be positive (got Vector2(${x}, ${y})). Zero or negative zoom will cause rendering issues.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'camera2d-invalid-zoom',
        });
      }
    }
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

  // WARNING: position_smoothing_enabled without valid speed
  if (rawProps.position_smoothing_enabled === 'true') {
    if (rawProps.position_smoothing_speed === undefined) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is not set. Smoothing may not work as expected without a speed value.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-smoothing-speed-missing',
      });
    } else {
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
  }

  // WARNING: rotation_smoothing_enabled without valid speed
  if (rawProps.rotation_smoothing_enabled === 'true') {
    if (rawProps.rotation_smoothing_speed === undefined) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D has 'rotation_smoothing_enabled' set to true but 'rotation_smoothing_speed' is not set. Rotation smoothing may not work as expected without a speed value.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-rotation-smoothing-speed-missing',
      });
    } else {
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
  }

  // WARNING: drag margins set but drag not enabled
  const hasHorizontalMargins = rawProps.drag_left_margin !== undefined || rawProps.drag_right_margin !== undefined;
  const hasVerticalMargins = rawProps.drag_top_margin !== undefined || rawProps.drag_bottom_margin !== undefined;

  if (hasHorizontalMargins && rawProps.drag_horizontal_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has horizontal drag margins set (drag_left_margin or drag_right_margin) but 'drag_horizontal_enabled' is not true. These margins will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-horizontal-margins-without-drag',
    });
  }

  if (hasVerticalMargins && rawProps.drag_vertical_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has vertical drag margins set (drag_top_margin or drag_bottom_margin) but 'drag_vertical_enabled' is not true. These margins will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-vertical-margins-without-drag',
    });
  }

  // WARNING: drag offsets set but drag not enabled
  if (rawProps.drag_horizontal_offset !== undefined && rawProps.drag_horizontal_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has 'drag_horizontal_offset' set but 'drag_horizontal_enabled' is not true. This offset will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-horizontal-offset-without-drag',
    });
  }

  if (rawProps.drag_vertical_offset !== undefined && rawProps.drag_vertical_enabled !== 'true') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has 'drag_vertical_offset' set but 'drag_vertical_enabled' is not true. This offset will have no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-vertical-offset-without-drag',
    });
  }

  return diagnostics;
}

/**
 * Camera2D semantic validation rule
 */
const camera2DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera2d-properties',
    description: 'Validates Camera2D property values, zoom constraints, limit consistency, smoothing configuration, and drag settings',
    category: 'validation',
    applicableNodeTypes: ['Camera2D'],
  },
  check: checkCamera2D,
};

// Self-register the rule
ruleRegistry.register(camera2DValidationRule);

// Export for testing
export { camera2DValidationRule };
