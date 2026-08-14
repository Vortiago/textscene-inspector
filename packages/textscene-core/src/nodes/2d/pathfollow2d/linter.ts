/**
 * Semantic linter rules for PathFollow2D (mirrors PathFollow3D, adapted to 2D).
 *
 * Format validation is in linterParser.ts. This file covers context-dependent
 * checks: PathFollow2D MUST be a direct child of a Path2D, and the two ways of
 * authoring a position along the curve behave nothing alike in a `.tscn`.
 *
 * `progress` and `progress_ratio` are NOT two spellings of one value at load
 * time. `PackedScene::instantiate` applies a node's stored properties BEFORE
 * adding it to its parent (packed_scene.cpp:492 sets, :541 parents), and
 * `PathFollow2D::path` is only assigned on NOTIFICATION_ENTER_TREE
 * (path_2d.cpp:347). So:
 *
 *   - `set_progress` finds `path == nullptr`, skips the wrap/clamp branch
 *     entirely, and stores whatever was written — including a negative value,
 *     which nothing later rewrites;
 *   - `set_progress_ratio` opens with `ERR_FAIL_NULL_MSG(path)`
 *     (path_2d.cpp:472), so EVERY authored ratio is dropped, in range or not.
 *
 * Which is why file order does not decide a contest between them: `progress`
 * wins even when `progress_ratio` is written after it.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { hiddenOrUnknowableInTree, parentTypeVerdict, placementPhrase } from '../../../linter/parentType.js';
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';

function checkPathFollow2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;

  const rawProps = node.properties as Record<string, string>;

  // path_2d.cpp:384-388 — the placement Godot itself flags, and it is a
  // get_configuration_warnings() entry, so it is advisory (ADR-0032) rather
  // than a setter that refuses a value. Both arms are one `push_back` behind
  // `is_visible_in_tree()`: at the root the cast is `cast_to<Path2D>(nullptr)`,
  // which is null. `parentTypeVerdict` supplies the instanced/untyped-parent
  // exemption: a parent whose type lives in a sub-scene the linter never opens
  // may well BE a Path2D. The progress checks below are this repo's own and
  // carry no such gate.
  if (!hiddenOrUnknowableInTree(scene, node)) {
    const placement = parentTypeVerdict(scene, node, 'Path2D');
    if (placement.kind === 'root') {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow2D '${node.name}' is the scene root. It only works as a direct child of a Path2D node, and follows nothing here.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow2d-no-parent',
      });
    } else if (placement.kind === 'mismatch') {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow2D '${node.name}' is ${placementPhrase(placement)}. It only works as a direct child of a Path2D node, and follows nothing here.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow2d-invalid-parent',
      });
    }
  }

  // The value survives; what does not survive is the travel it asks for. Every
  // sampler clamps the offset into the curve, so the follower parks at the
  // start rather than extrapolating backwards off the end.
  if (rawProps.progress !== undefined) {
    const progress = parseGodotFloat(rawProps.progress);
    // `set_progress` opens with ERR_FAIL_COND(!std::isfinite(p_progress))
    // (path_2d.cpp:425), so a non-finite one never lands and this rule has
    // nothing to say about the travel it would have asked for.
    if (progress !== null && Number.isFinite(progress) && progress < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `PathFollow2D 'progress' is negative (${progress}). Godot keeps the value, but clamps it when sampling the curve, so the follower sits at the start of the path.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'pathfollow2d-negative-progress',
      });
    }
  }

  // Unconditional: the guard is on the missing parent, not on the value.
  if (rawProps.progress_ratio !== undefined) {
    diagnostics.push({
      severity: 'error',
      message: `PathFollow2D 'progress_ratio' is set. A scene file cannot carry it: the setter needs a Path2D parent that is already in the tree, and properties are applied before the node is parented, so Godot drops it. Use 'progress' instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'pathfollow2d-progress-ratio-ignored',
    });
  }

  return diagnostics;
}

const pathFollow2DValidationRule: LintRule = {
  meta: {
    name: 'valid-pathfollow2d',
    description: 'Validates PathFollow2D parent relationship and progress values',
    category: 'validation',
    applicableNodeTypes: ['PathFollow2D'],
    emits: [
      { ruleName: 'pathfollow2d-no-parent', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'pathfollow2d-invalid-parent', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'pathfollow2d-negative-progress',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'curve.cpp:1079',
          unused: 'the sampler clamps the offset, so travel before the start moves nothing',
        },
      },
      {
        ruleName: 'pathfollow2d-progress-ratio-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'path_2d.cpp:472' },
      },
    ],
  },
  check: checkPathFollow2D,
};

ruleRegistry.register(pathFollow2DValidationRule);

export { pathFollow2DValidationRule };
