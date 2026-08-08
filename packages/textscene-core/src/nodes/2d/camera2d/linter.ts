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
 * Which tier a smoothing speed falls in, or null when it is fine or absent.
 *
 * Only the CLASSIFICATION is shared between the two axes. Each `ruleName` stays
 * a literal at its push site, because `ruleCoverage.test.ts` pairs `severity:`
 * with the next `ruleName:` by reading the source — a name reached through a
 * config object is a name the guard cannot see, so it reads as invented.
 */
function smoothingSpeedTier(
  rawProps: Record<string, string>,
  enabledKey: string,
  speedKey: string
): { tier: 'negative' | 'zero'; speed: number } | null {
  const raw = rawProps[speedKey];
  if (rawProps[enabledKey] !== 'true' || raw === undefined) return null;
  const speed = parseFloat(raw);
  if (isNaN(speed) || speed > 0) return null;
  return { tier: speed < 0 ? 'negative' : 'zero', speed };
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

  // Zero and negative are two ADR-0032 tiers, not one condition. The setters
  // store `MAX(0, p_speed)` (camera_2d.cpp:703, :715): a NEGATIVE speed is
  // overwritten before it reaches the field, which is the error tier, while
  // ZERO is stored exactly as written and only makes the interpolation factor
  // zero, freezing the smoothed position where it started (:199-200, :216-217).
  const position = smoothingSpeedTier(
    rawProps,
    'position_smoothing_enabled',
    'position_smoothing_speed'
  );
  if (position?.tier === 'negative') {
    diagnostics.push({
      severity: 'error',
      message: `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is ${position.speed}. Godot stores 0 instead, so the authored value never applies.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-smoothing-speed-negative',
    });
  } else if (position?.tier === 'zero') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is 0. The value is kept, but it makes the interpolation factor 0, so the smoothed position never follows the camera.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-smoothing-speed-zero',
    });
  }

  const rotation = smoothingSpeedTier(
    rawProps,
    'rotation_smoothing_enabled',
    'rotation_smoothing_speed'
  );
  if (rotation?.tier === 'negative') {
    diagnostics.push({
      severity: 'error',
      message: `Camera2D has 'rotation_smoothing_enabled' set to true but 'rotation_smoothing_speed' is ${rotation.speed}. Godot stores 0 instead, so the authored value never applies.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-rotation-smoothing-speed-negative',
    });
  } else if (rotation?.tier === 'zero') {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has 'rotation_smoothing_enabled' set to true but 'rotation_smoothing_speed' is 0. The value is kept, but it makes the step 0, so the smoothed rotation never follows the camera.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-rotation-smoothing-speed-zero',
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
        ruleName: 'camera2d-smoothing-speed-negative',
        severity: 'error',
        grounding: { kind: 'engine', at: 'camera_2d.cpp:703' },
      },
      {
        ruleName: 'camera2d-smoothing-speed-zero',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:199',
          unused: 'a zero factor leaves the smoothed position where it started',
        },
      },
      {
        ruleName: 'camera2d-rotation-smoothing-speed-negative',
        severity: 'error',
        grounding: { kind: 'engine', at: 'camera_2d.cpp:715' },
      },
      {
        ruleName: 'camera2d-rotation-smoothing-speed-zero',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:216',
          unused: 'a zero step leaves lerp_angle at the angle it started from',
        },
      },
    ],
  },
  check: checkCamera2D,
};

// Self-register the rule
ruleRegistry.register(camera2DValidationRule);

// Export for testing
export { camera2DValidationRule };
