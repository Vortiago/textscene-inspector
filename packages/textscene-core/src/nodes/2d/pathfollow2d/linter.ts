/**
 * PathFollow2D semantic rules. Godot sets properties before parenting
 * (packed_scene.cpp:492 sets, :541 parents) and binds `PathFollow2D::path` only
 * on enter-tree (path_2d.cpp:347), so in a `.tscn` `progress` and
 * `progress_ratio` load unlike each other.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { hiddenOrUnknowableInTree, parentTypeVerdict, placementPhrase } from '../../../linter/parentType.js';
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';

const arms = {
  noParent: groundedArm('pathfollow2d-no-parent', { kind: 'configuration-warning' }),
  invalidParent: groundedArm('pathfollow2d-invalid-parent', { kind: 'configuration-warning' }),
  negativeProgress: groundedArm('pathfollow2d-negative-progress', {
    kind: 'engine-inert',
    at: 'curve.cpp:1079',
    unused: 'the sampler clamps the offset, so travel before the start moves nothing',
  }),
  progressRatioIgnored: {
    severity: 'error',
    ruleName: 'pathfollow2d-progress-ratio-ignored',
    grounding: { kind: 'engine', at: 'path_2d.cpp:472' },
  },
} as const satisfies RuleArms<string>;

function checkPathFollow2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;

  const rawProps = node.properties as Record<string, string>;

  // path_2d.cpp:384-388, a get_configuration_warnings() entry behind
  // `is_visible_in_tree()`: advisory (ADR-0032), and the root warns too, as its
  // parent cast is null. `parentTypeVerdict` exempts an untyped instanced parent.
  // The progress checks below are this repo's own and carry no such gate.
  if (!hiddenOrUnknowableInTree(scene, node)) {
    const placement = parentTypeVerdict(scene, node, 'Path2D');
    if (placement.kind === 'root') {
      reportArm(
        diagnostics,
        arms.noParent,
        node,
        `PathFollow2D '${node.name}' is the scene root. It only works as a direct child of a Path2D node, and follows nothing here.`
      );
    } else if (placement.kind === 'mismatch') {
      reportArm(
        diagnostics,
        arms.invalidParent,
        node,
        `PathFollow2D '${node.name}' is ${placementPhrase(placement)}. It only works as a direct child of a Path2D node, and follows nothing here.`
      );
    }
  }

  // `set_progress` finds no path, skips its wrap and clamp, and stores the value,
  // a negative one included. The sampler clamps the offset into the curve, so
  // the follower parks at the start rather than extrapolating off the end.
  if (rawProps.progress !== undefined) {
    const progress = parseGodotFloat(rawProps.progress);
    // `set_progress` opens with ERR_FAIL_COND(!std::isfinite(p_progress))
    // (path_2d.cpp:425), so a non-finite one never lands and this rule has
    // nothing to say about the travel it would have asked for.
    if (progress !== null && Number.isFinite(progress) && progress < 0) {
      reportArm(
        diagnostics,
        arms.negativeProgress,
        node,
        `PathFollow2D 'progress' is negative (${progress}). Godot keeps the value, but clamps it when sampling the curve, so the follower sits at the start of the path.`
      );
    }
  }

  // Unconditional: `set_progress_ratio` opens with ERR_FAIL_NULL_MSG(path)
  // (path_2d.cpp:472), so every ratio drops and `progress` wins in any file order.
  if (rawProps.progress_ratio !== undefined) {
    reportArm(
      diagnostics,
      arms.progressRatioIgnored,
      node,
      `PathFollow2D 'progress_ratio' is set. A scene file cannot carry it: the setter needs a Path2D parent that is already in the tree, and properties are applied before the node is parented, so Godot drops it. Use 'progress' instead.`
    );
  }

  return diagnostics;
}

const pathFollow2DValidationRule: LintRule = {
  meta: {
    name: 'valid-pathfollow2d',
    description: 'Validates PathFollow2D parent relationship and progress values',
    category: 'validation',
    applicableNodeTypes: ['PathFollow2D'],
    emits: armEmits(arms),
  },
  check: checkPathFollow2D,
};

ruleRegistry.register(pathFollow2DValidationRule);

export { pathFollow2DValidationRule };
