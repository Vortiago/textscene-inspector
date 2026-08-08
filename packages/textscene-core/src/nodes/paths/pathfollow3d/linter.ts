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
 *
 * `progress` and `progress_ratio` are NOT two spellings of one value at load
 * time. `PackedScene::instantiate` applies a node's stored properties BEFORE
 * adding it to its parent (packed_scene.cpp:492 sets, :541 parents), and
 * `PathFollow3D::path` is only assigned on NOTIFICATION_ENTER_TREE. So
 * `set_progress` finds `path == nullptr`, skips the wrap/clamp branch and
 * stores whatever was written; `set_progress_ratio` opens with
 * `ERR_FAIL_NULL_MSG(path)` (path_3d.cpp:503) and drops EVERY authored ratio,
 * in range or not. File order decides no contest between them.
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

  // The value survives; what does not survive is the travel it asks for. Every
  // sampler clamps the offset into the curve, so the follower parks at the
  // start rather than extrapolating backwards off the end.
  if (rawProps.progress !== undefined) {
    const progress = parseFloat(rawProps.progress);
    if (!isNaN(progress) && progress < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow3D 'progress' is negative (${progress}). Godot keeps the value, but clamps it when sampling the curve, so the follower sits at the start of the path.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow3d-negative-progress',
      });
    }
  }

  // Unconditional: the guard is on the missing parent, not on the value.
  if (rawProps.progress_ratio !== undefined) {
    diagnostics.push({
      severity: 'error',
      message: `PathFollow3D 'progress_ratio' is set. A scene file cannot carry it: the setter needs a Path3D parent that is already in the tree, and properties are applied before the node is parented, so Godot drops it. Use 'progress' instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow3d-progress-ratio-ignored',
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
        grounding: {
          kind: 'engine-inert',
          at: 'curve.cpp:2024',
          unused: 'the sampler clamps the offset, so travel before the start moves nothing',
        },
      },
      {
        ruleName: 'pathfollow3d-progress-ratio-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'path_3d.cpp:503' },
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
