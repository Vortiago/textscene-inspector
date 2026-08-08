/**
 * Semantic linter rules for PathFollow3D, from Godot's own configuration
 * warnings (`path_3d.cpp:354-369`) plus the cross-field checks its properties
 * invite.
 *
 * Format validation lives in linterParser.ts; this file is the part that needs
 * the rest of the scene.
 *
 * Two things here were wrong for a long time and are worth naming, since the
 * shapes recur:
 *
 * - The placement rules reported `error`. Godot's signal is a configuration
 *   warning, which is advisory by construction, and ADR-0032 reserves `error`
 *   for a setter that refuses or alters the value. A misplaced PathFollow3D
 *   loads fine and every property in the file is well-formed.
 * - The ROTATION_ORIENTED rule fired on `rotation_mode = 4` alone. Godot's guard
 *   is `curve.is_valid() && !curve->is_up_vector_enabled() && rotation_mode ==
 *   ROTATION_ORIENTED` (path_3d.cpp:362), and `up_vector_enabled` defaults to
 *   true (curve.h:299) — so the rule warned about exactly the configuration that
 *   is correct, and stayed silent about nothing.
 * - The both-progress-properties message claimed `progress_ratio` "takes
 *   precedence". Neither half was true: `PackedScene::instantiate` applies a
 *   node's stored properties in FILE ORDER through a plain sequential `set()`
 *   loop (packed_scene.cpp:365-381), so whichever key appears LAST in the file
 *   wins, not `progress_ratio` unconditionally — and Godot's own saver can
 *   never produce this state to begin with, since `progress_ratio` is declared
 *   `PROPERTY_USAGE_EDITOR` with no `PROPERTY_USAGE_STORAGE` bit (path_3d.cpp:433),
 *   so the dual-key file only arises when a human hand-writes both keys.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { hiddenOrUnknowableInTree, parentTypeVerdict, placementPhrase } from '../../../linter/parentType.js';
import { resolveSubResourceRef } from '../../../resources/SubResourceResolver.js';

/** `PathFollow3D::ROTATION_ORIENTED` (path_3d.h), the mode that needs up vectors. */
const ROTATION_ORIENTED = 4;

/**
 * True only when the parent Path3D's curve is visible in THIS file and says
 * `up_vector_enabled = false`.
 *
 * Deliberately false for a curve behind an `ExtResource`, and for an absent
 * key: absence is Godot's default form and the default is `true`, so a missing
 * `up_vector_enabled` means up vectors ARE enabled and there is nothing to warn
 * about.
 */
function parentCurveDisablesUpVector(scene: TscnScene, parent: { properties: unknown }): boolean {
  const curveRef = (parent.properties as Record<string, string>)?.curve;
  const curve = resolveSubResourceRef(curveRef, scene.internalResources ?? []);
  const enabled = curve?.data?.up_vector_enabled;
  return enabled === false || enabled === 'false';
}

/**
 * Validate PathFollow3D semantic rules
 */
function checkPathFollow3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Type guard for properties
  if (!isValidProperties(node.properties)) {
    return diagnostics;
  }

  const rawProps = node.properties as Record<string, string>;

  // path_3d.cpp:357 — both of this override's warnings sit inside
  // `is_visible_in_tree() && is_inside_tree()`. The progress and dual-key
  // checks further down are this repo's own and carry no such gate.
  const gated = hiddenOrUnknowableInTree(scene, node);

  // path_3d.cpp:359 — the placement Godot itself flags, at the root too, where
  // the cast is `cast_to<Path3D>(nullptr)`. `parentTypeVerdict` supplies the
  // instanced/untyped-parent exemption: a parent whose type lives in a
  // sub-scene the linter never opens may well BE a Path3D.
  const placement = parentTypeVerdict(scene, node, 'Path3D');
  if (!gated) {
    if (placement.kind === 'root') {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D '${node.name}' is the scene root. It only works as a direct child of a Path3D node, and follows nothing here.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow3d-no-parent',
      });
    } else if (placement.kind === 'mismatch') {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D '${node.name}' is ${placementPhrase(placement)}. It only works as a direct child of a Path3D node, and follows nothing here.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow3d-invalid-parent',
      });
    }
  }

  // WARNING: progress < 0 (will be clamped to 0 by Godot)
  if (rawProps.progress !== undefined) {
    const progress = parseFloat(rawProps.progress);
    if (!isNaN(progress) && progress < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D 'progress' is negative (${progress}). Godot resolves it against the curve's length once the node enters the tree — wrapping it when 'loop' is on, clamping it to 0 when off — so the value in the file is not the one that takes effect.`,
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

  // Warning: both progress and progress_ratio set. Neither always wins: Godot
  // applies stored properties in FILE ORDER (packed_scene.cpp:365-381), so
  // whichever key comes last takes effect — and this file could only exist
  // hand-written, since progress_ratio carries no PROPERTY_USAGE_STORAGE bit
  // (path_3d.cpp:433) and Godot's own saver never writes it.
  if (rawProps.progress !== undefined && rawProps.progress_ratio !== undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `PathFollow3D has both 'progress' and 'progress_ratio' set. Godot applies stored properties in file order (packed_scene.cpp:365-381), so whichever key appears LAST in the file wins — not always 'progress_ratio'. Godot's own saver never writes both: 'progress_ratio' has no PROPERTY_USAGE_STORAGE bit (path_3d.cpp:433), so this state only arises in a hand-written file.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-both-progress-properties',
    });
  }

  // path_3d.cpp:362 — all three conjuncts, not just the mode. The curve must be
  // readable here AND say up vectors are off; a curve behind an ExtResource, or
  // one that simply omits the key, is the default `true` and is fine.
  if (
    !gated &&
    parseInt(rawProps.rotation_mode ?? '', 10) === ROTATION_ORIENTED &&
    placement.kind === 'satisfied' &&
    parentCurveDisablesUpVector(scene, placement.parent)
  ) {
    diagnostics.push({
      severity: 'warning',
      message: `PathFollow3D '${node.name}' uses ROTATION_ORIENTED, but its parent Path3D's Curve3D sets 'up_vector_enabled = false'. Godot needs up vectors for that mode.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-oriented-mode-requires-up-vector',
    });
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
      { ruleName: 'pathfollow3d-no-parent', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'pathfollow3d-invalid-parent', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'pathfollow3d-negative-progress',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'path_3d.cpp:461' },
      },
      {
        ruleName: 'pathfollow3d-progress-ratio-out-of-range',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'path_3d.cpp:466' },
      },
      {
        ruleName: 'pathfollow3d-both-progress-properties',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'packed_scene.cpp:369',
          unused: 'properties apply in file order, so the earlier key is overwritten',
        },
      },
      { ruleName: 'pathfollow3d-oriented-mode-requires-up-vector', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkPathFollow3D,
};

// Self-register the rule
ruleRegistry.register(pathFollow3DValidationRule);

// Export for testing
export { pathFollow3DValidationRule };
