/**
 * Semantic linter rules for Camera2D: the checks that need the whole node or
 * scene. linterParser.ts validates each value's format during strict parsing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { nodesOfType } from '../../../linter/linterUtils.js';
import { viewportScopeCounter, viewportScopeOf } from '../../../linter/viewportScope.js';
import { parseGodotFloat, ruleInt } from '../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../godot/index.js';

const arms = {
  multipleEnabled: groundedArm('camera2d-multiple-enabled', {
    kind: 'engine-inert',
    at: 'camera_2d.cpp:354',
    unused: 'a second camera entering a tree that already has a current one never becomes current',
  }),
  invertedHorizontalLimits: groundedArm('camera2d-invalid-horizontal-limits', {
    kind: 'engine-inert',
    at: 'camera_2d.cpp:229',
    unused: 'the degenerate branch centres the view instead of applying the limits',
  }),
  invertedVerticalLimits: groundedArm('camera2d-invalid-vertical-limits', {
    kind: 'engine-inert',
    at: 'camera_2d.cpp:241',
    unused: 'the degenerate branch centres the view instead of applying the limits',
  }),
  zeroSmoothingSpeed: groundedArm('camera2d-smoothing-speed-zero', {
    kind: 'engine-inert',
    at: 'camera_2d.cpp:199',
    unused: 'a zero factor leaves the smoothed position where it started',
  }),
  zeroRotationSmoothingSpeed: groundedArm('camera2d-rotation-smoothing-speed-zero', {
    kind: 'engine-inert',
    at: 'camera_2d.cpp:216',
    unused: 'a zero step leaves lerp_angle at the angle it started from',
  }),
} as const satisfies RuleArms<string>;

/** Enabled unless the key says otherwise: `enabled` defaults true (camera_2d.h:67). */
function cameraIsEnabled(node: TscnNode): boolean {
  return boolSlotValue(node.rawProperties.enabled) !== false;
}

/** Enabled Camera2D nodes sharing `scope`'s viewport, the set that really contends. */
const countEnabledCamerasInScope = viewportScopeCounter((roots) =>
  nodesOfType(roots, 'Camera2D').filter(cameraIsEnabled)
);

/**
 * Smoothing is on with a speed of exactly 0: the setter stores it, and the
 * interpolation factor stays 0 (camera_2d.cpp:199-200, :216-217). A negative speed
 * belongs to `v.nonNegativeFloat(…, { enforced: 'camera_2d.cpp:703' })`, grounded
 * in `MAX(0, p_speed)` (camera_2d.cpp:703, :715).
 */
function smoothingIsFrozen(rawProps: Record<string, string>, enabledKey: string, speedKey: string): boolean {
  const raw = rawProps[speedKey];
  if (boolSlotValue(rawProps[enabledKey]) !== true || raw === undefined) return false;
  return parseGodotFloat(raw) === 0;
}

function checkCamera2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Before the properties guard: a camera with no properties is enabled.
  const rawProps = node.rawProperties;
  const scope = viewportScopeOf(scene, node);
  if (cameraIsEnabled(node) && scope !== undefined) {
    const enabledCount = countEnabledCamerasInScope(scene, scope);
    if (enabledCount > 1) {
      reportArm(
        diagnostics,
        arms.multipleEnabled,
        node,
        `Multiple enabled Camera2D nodes detected in scene (${enabledCount} total). Only one Camera2D should typically be enabled at a time to avoid viewport conflicts.`
      );
    }
  }

  if (rawProps.limit_left !== undefined && rawProps.limit_right !== undefined) {
    const left = ruleInt(rawProps.limit_left);
    const right = ruleInt(rawProps.limit_right);

    if (left !== null && right !== null && right < left) {
      reportArm(
        diagnostics,
        arms.invertedHorizontalLimits,
        node,
        `Camera2D 'limit_right' (${right}) is less than 'limit_left' (${left}). This creates an invalid horizontal scroll area and may cause unexpected camera behavior.`
      );
    }
  }

  if (rawProps.limit_top !== undefined && rawProps.limit_bottom !== undefined) {
    const top = ruleInt(rawProps.limit_top);
    const bottom = ruleInt(rawProps.limit_bottom);

    if (top !== null && bottom !== null && bottom < top) {
      reportArm(
        diagnostics,
        arms.invertedVerticalLimits,
        node,
        `Camera2D 'limit_bottom' (${bottom}) is less than 'limit_top' (${top}). This creates an invalid vertical scroll area and may cause unexpected camera behavior.`
      );
    }
  }

  if (smoothingIsFrozen(rawProps, 'position_smoothing_enabled', 'position_smoothing_speed')) {
    reportArm(
      diagnostics,
      arms.zeroSmoothingSpeed,
      node,
      `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is 0. The value is kept, but it makes the interpolation factor 0, so the smoothed position never follows the camera.`
    );
  }

  if (smoothingIsFrozen(rawProps, 'rotation_smoothing_enabled', 'rotation_smoothing_speed')) {
    reportArm(
      diagnostics,
      arms.zeroRotationSmoothingSpeed,
      node,
      `Camera2D has 'rotation_smoothing_enabled' set to true but 'rotation_smoothing_speed' is 0. The value is kept, but it makes the step 0, so the smoothed rotation never follows the camera.`
    );
  }

  return diagnostics;
}

const camera2DValidationRule: LintRule = {
  meta: {
    name: 'valid-camera2d-properties',
    description: 'Validates Camera2D limit consistency and smoothing configuration',
    category: 'validation',
    applicableNodeTypes: ['Camera2D'],
    emits: armEmits(arms),
  },
  check: checkCamera2D,
};

ruleRegistry.register(camera2DValidationRule);

export { camera2DValidationRule };
