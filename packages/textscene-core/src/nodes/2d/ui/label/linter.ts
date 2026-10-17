/**
 * Semantic rule for Label, `Label::get_configuration_warnings()` (label.cpp:620-635):
 * an autowrapping Label whose parent is a Container needs a non-zero
 * `custom_minimum_size`. The scene root is exempt, and `parentTypeVerdict`
 * resolves it to `root`, which is no Container.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parentTypeVerdict } from '../../../../linter/parentType.js';
import { matchVector2 } from '../../../../linter/validators/index.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { AutowrapMode } from '../../../../godot/text/textServerEnums.js';

const arms = {
  autowrapNeedsMinimumSize: groundedArm('label-autowrap-needs-custom-minimum-size', {
    kind: 'configuration-warning',
  }),
} as const satisfies RuleArms<string>;

/**
 * True when `raw` is absent, or holds exactly (0, 0): Godot's `Size2()`. `Vector2i(0.5, 0.5)`
 * narrows to a zero size. A malformed literal or an altered component counts as set: the quiet direction.
 */
function isZeroOrAbsentSize(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const size = matchVector2(raw);
  return size !== null && size.x === 0 && size.y === 0;
}

function checkLabelAutowrap(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const props = node.rawProperties;

  const autowrapRaw = props.autowrap_mode;
  if (autowrapRaw === undefined) return [];
  const autowrapMode = ruleInt(autowrapRaw);
  // Finite: a non-finite reads as NaN, and `NaN !== AUTOWRAP_OFF` is true, so
  // a value off the number line would read as autowrap enabled.
  if (autowrapMode === null || autowrapMode === AutowrapMode.AUTOWRAP_OFF) {
    return [];
  }

  if (!isZeroOrAbsentSize(props.custom_minimum_size)) return [];

  // `get_parent_control()` is the direct parent, cached in `NOTIFICATION_PARENTED`
  // (control.cpp:3828-3829), not an ancestor walk: `parentTypeVerdict`'s contract.
  const verdict = parentTypeVerdict(scene, node, 'Container');
  if (verdict.kind !== 'satisfied') return [];

  return [
    armDiagnostic(
      arms.autowrapNeedsMinimumSize,
      node,
      `Label '${node.name}' has autowrap enabled under a Container parent ('${verdict.parent.name}') but 'custom_minimum_size' is still (0, 0). Autowrapping labels need a custom minimum size to lay out correctly inside a container.`
    ),
  ];
}

const labelAutowrapRule: LintRule = {
  meta: {
    name: 'valid-label-autowrap-sizing',
    description:
      'Flags a Label with autowrap enabled under a Container parent that still has the default (0, 0) custom_minimum_size',
    category: 'validation',
    applicableNodeTypes: ['Label'],
    emits: armEmits(arms),
  },
  check: checkLabelAutowrap,
};

ruleRegistry.register(labelAutowrapRule);
