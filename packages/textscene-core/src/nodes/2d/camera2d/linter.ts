/**
 * Semantic linter rules for Camera2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { isViewportBoundary } from '../../viewport/subviewport/viewportBoundary.js';
import { searchAncestors } from '../../../linter/parentType.js';
import { parseGodotFloat, parseGodotInt } from '../../../linter/validators/commonValidators.js';

/**
 * The SubViewport a node draws into, or null for the scene's own viewport.
 *
 * Godot's current-camera slot is per-viewport: `Camera2D` joins
 * `"__cameras_" + itos(vp.get_id())` (camera_2d.cpp:349) and `make_current` is
 * gated on `!viewport->get_camera_2d()` (:354), where `camera_2d` is a member of
 * Viewport itself (viewport.h:764). Two enabled cameras in different
 * sub-viewports each become current in their own and never contend.
 *
 * `undefined` rather than `null` for an ancestor whose class this file does not
 * declare: an instanced sub-scene may be rooted at a SubViewport, and reading it
 * as an ordinary node pools its cameras into the outer viewport's scope — the
 * very false positive the scoping was added to remove. Distinct from `null`,
 * which is the real scene-root viewport, so two such cameras never compare equal.
 */
function viewportScopeOf(scene: TscnScene, node: TscnNode): TscnNode | null | undefined {
  const search = searchAncestors(scene, node, (ancestor) =>
    isViewportBoundary(ancestor.type) ? ancestor : undefined
  );
  if (search.kind === 'unknowable') return undefined;
  return search.kind === 'found' ? search.value : null;
}

/** Enabled unless the key says otherwise: `enabled` defaults true (camera_2d.h:67). */
function cameraIsEnabled(node: TscnNode): boolean {
  if (!isValidProperties(node.properties)) return true;
  return (node.properties as Record<string, string>).enabled !== 'false';
}

/** Enabled Camera2D nodes sharing `scope`'s viewport, the set that really contends. */
function countEnabledCamerasInScope(scene: TscnScene, scope: TscnNode | null): number {
  let count = 0;

  function traverse(nodes: TscnScene['nodes']): void {
    for (const node of nodes) {
      // An `undefined` scope never equals `scope`, so a camera whose viewport
      // this file cannot determine is left out of the contending set.
      if (node.type === 'Camera2D' && cameraIsEnabled(node) && viewportScopeOf(scene, node) === scope) {
        count++;
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(scene.nodes);
  return count;
}

/**
 * Smoothing is on, but the speed freezes it: enabled with a speed of exactly 0.
 *
 * ZERO is the only tier this rule owns. `MAX(0, p_speed)` (camera_2d.cpp:703,
 * :715) does refuse a NEGATIVE speed, but so does this slice's own
 * `v.nonNegativeFloat(…, { enforced: 'camera_2d.cpp:703' })`, at the same tier
 * and from the same line — a rule for it reports the one value twice and still
 * misses `-inf`, which the validator reads and `parseFloat` does not. Zero is
 * what the validator cannot see: a legal non-negative value that the setter
 * stores unchanged, leaving the interpolation factor at 0 so the smoothed
 * position never moves (:199-200, :216-217).
 *
 * Only the CLASSIFICATION is shared between the two axes. Each `ruleName` stays
 * a literal at its push site, because `ruleCoverage.test.ts` pairs `severity:`
 * with the next `ruleName:` by reading the source — a name reached through a
 * config object is a name the guard cannot see, so it reads as invented.
 */
function smoothingIsFrozen(
  rawProps: Record<string, string>,
  enabledKey: string,
  speedKey: string
): boolean {
  const raw = rawProps[speedKey];
  if (rawProps[enabledKey] !== 'true' || raw === undefined) return false;
  return parseGodotFloat(raw) === 0;
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
  const scope = viewportScopeOf(scene, node);
  if (cameraIsEnabled(node) && scope !== undefined) {
    const enabledCount = countEnabledCamerasInScope(scene, scope);
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
    const left = parseGodotInt(rawProps.limit_left);
    const right = parseGodotInt(rawProps.limit_right);

    if (left !== null && right !== null && right < left) {
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
    const top = parseGodotInt(rawProps.limit_top);
    const bottom = parseGodotInt(rawProps.limit_bottom);

    if (top !== null && bottom !== null && bottom < top) {
      diagnostics.push({
        severity: 'warning',
        message: `Camera2D 'limit_bottom' (${bottom}) is less than 'limit_top' (${top}). This creates an invalid vertical scroll area and may cause unexpected camera behavior.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'camera2d-invalid-vertical-limits',
      });
    }
  }

  if (smoothingIsFrozen(rawProps, 'position_smoothing_enabled', 'position_smoothing_speed')) {
    diagnostics.push({
      severity: 'warning',
      message: `Camera2D has 'position_smoothing_enabled' set to true but 'position_smoothing_speed' is 0. The value is kept, but it makes the interpolation factor 0, so the smoothed position never follows the camera.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'camera2d-smoothing-speed-zero',
    });
  }

  if (smoothingIsFrozen(rawProps, 'rotation_smoothing_enabled', 'rotation_smoothing_speed')) {
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
        ruleName: 'camera2d-smoothing-speed-zero',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'camera_2d.cpp:199',
          unused: 'a zero factor leaves the smoothed position where it started',
        },
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
