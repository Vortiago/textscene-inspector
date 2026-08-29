/**
 * Semantic linter rules for Camera2D
 *
 * Note: Format validation is handled by linterParser.ts during strict parsing.
 * This file focuses on semantic validation requiring full context (e.g., logical consistency).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties, nodesOfType } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { searchAncestors } from '../../../linter/parentType.js';
import { parseGodotFloat, ruleInt } from '../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../godot/index.js';

/**
 * The Viewport a node draws into, or null for the scene's own viewport.
 *
 * Godot's current-camera slot is per-viewport: `Camera2D` takes
 * `viewport = get_viewport()` (camera_2d.cpp:342), joins
 * `"__cameras_" + itos(vp.get_id())` (:349), and `make_current` is gated on
 * `!viewport->get_camera_2d()` (:354), where `camera_2d` is a member of
 * Viewport itself (viewport.h:764). Two enabled cameras in different viewports
 * each become current in their own and never contend.
 *
 * The scope is therefore the nearest Viewport ANCESTOR (`node.cpp:345-347`),
 * every subclass included: `Window` is a Viewport (`window.h:43`), so a camera
 * inside a window, popup or dialog is scoped exactly as one inside a
 * SubViewport. Read off the base chain rather than a type list, so a subclass
 * needs no edit here.
 *
 * `undefined` rather than `null` for an ancestor whose class this file does not
 * declare: an instanced sub-scene may be rooted at a Viewport, and reading it
 * as an ordinary node pools its cameras into the outer viewport's scope — the
 * very false positive this scoping exists to prevent. Distinct from `null`,
 * which is the real scene-root viewport, so two such cameras never compare equal.
 */
function viewportScopeOf(scene: TscnScene, node: TscnNode): TscnNode | null | undefined {
  // `searchAncestors` hands `visit` only ancestors whose type this file states
  // and the catalog knows, which is what makes a bare `descendsFrom` correct.
  const search = searchAncestors(scene, node, (ancestor) =>
    descendsFrom(ancestor.type, 'Viewport') ? ancestor : undefined
  );
  if (search.kind === 'unknowable') return undefined;
  return search.kind === 'found' ? search.value : null;
}

/** Enabled unless the key says otherwise: `enabled` defaults true (camera_2d.h:67). */
function cameraIsEnabled(node: TscnNode): boolean {
  if (!isValidProperties(node.properties)) return true;
  return boolSlotValue((node.properties as Record<string, string>).enabled) !== false;
}

/**
 * Enabled Camera2D nodes per viewport scope, tallied once per scene.
 *
 * The rule runs on every Camera2D and every one of them asks for the same
 * table, so it is built from the shared per-type index rather than recursed
 * per call: a fresh walk of `scene.nodes` with a depth-N ancestor climb inside
 * it made this O(matches x nodes x depth), and the pathological input is
 * exactly the scene the rule exists to detect. Keyed on the roots array like
 * every other per-scene fact, and correct on the same terms — `searchAncestors`
 * reads nothing of `scene` but `nodes`.
 */
const enabledCamerasByScope = new WeakMap<TscnNode[], Map<TscnNode | null, number>>();

/** Enabled Camera2D nodes sharing `scope`'s viewport, the set that really contends. */
function countEnabledCamerasInScope(scene: TscnScene, scope: TscnNode | null): number {
  let tally = enabledCamerasByScope.get(scene.nodes);
  if (!tally) {
    tally = new Map<TscnNode | null, number>();
    for (const camera of nodesOfType(scene.nodes, 'Camera2D')) {
      if (!cameraIsEnabled(camera)) continue;
      // A camera whose viewport this file cannot determine is left out of the
      // contending set: `undefined` is never a scope a caller holds.
      const cameraScope = viewportScopeOf(scene, camera);
      if (cameraScope === undefined) continue;
      tally.set(cameraScope, (tally.get(cameraScope) ?? 0) + 1);
    }
    enabledCamerasByScope.set(scene.nodes, tally);
  }
  return tally.get(scope) ?? 0;
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
  if (boolSlotValue(rawProps[enabledKey]) !== true || raw === undefined) return false;
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
    const left = ruleInt(rawProps.limit_left);
    const right = ruleInt(rawProps.limit_right);

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
    const top = ruleInt(rawProps.limit_top);
    const bottom = ruleInt(rawProps.limit_bottom);

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
