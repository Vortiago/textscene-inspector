/**
 * Semantic rule for Label, `Label::get_configuration_warnings()` (label.cpp:620-635):
 * an autowrapping Label whose parent is a Container needs a non-zero
 * `custom_minimum_size`. The scene root is exempt, and `parentTypeVerdict`
 * resolves it to `root`, which is no Container.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parentTypeVerdict } from '../../../../linter/parentType.js';
import { VECTOR2_REGEX } from '../../../../linter/validators/index.js';
import { ruleInt, tupleComponent } from '../../../../linter/validators/commonValidators.js';
import { slotComponents } from '../../../../godot/int.js';

// label.cpp:44/1435, TextServer::AutowrapMode: OFF=0, ARBITRARY=1, WORD=2, WORD_SMART=3.
const AUTOWRAP_OFF = 0;

/** True when `raw` is absent, or parses to exactly (0, 0): Godot's `Size2()`. */
function isZeroOrAbsentSize(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return false;
  // `slotComponents`, not bare `tupleComponent`: `Vector2i(0.5, 0.5)` narrows to
  // int32, so Godot stores a zero size. A component the engine alters reads NaN,
  // which fails `=== 0` and counts as set: the quiet direction.
  const [x, y] = slotComponents(raw, 'Vector2', [match[1], match[2]], tupleComponent);
  return x === 0 && y === 0;
}

function checkLabelAutowrap(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const autowrapRaw = props.autowrap_mode;
  if (autowrapRaw === undefined) return [];
  const autowrapMode = ruleInt(autowrapRaw);
  // Finite: a non-finite reads as NaN, and `NaN !== AUTOWRAP_OFF` is true, so
  // a value off the number line would read as autowrap enabled.
  if (autowrapMode === null || autowrapMode === AUTOWRAP_OFF) {
    return [];
  }

  if (!isZeroOrAbsentSize(props.custom_minimum_size)) return [];

  // `get_parent_control()` is the direct parent, cached in `NOTIFICATION_PARENTED`
  // (control.cpp:3828-3829), not an ancestor walk: `parentTypeVerdict`'s contract.
  const verdict = parentTypeVerdict(scene, node, 'Container');
  if (verdict.kind !== 'satisfied') return [];

  return [
    {
      severity: 'warning',
      message: `Label '${node.name}' has autowrap enabled under a Container parent ('${verdict.parent.name}') but 'custom_minimum_size' is still (0, 0). Autowrapping labels need a custom minimum size to lay out correctly inside a container.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'label-autowrap-needs-custom-minimum-size',
    },
  ];
}

const labelAutowrapRule: LintRule = {
  meta: {
    name: 'valid-label-autowrap-sizing',
    description:
      'Flags a Label with autowrap enabled under a Container parent that still has the default (0, 0) custom_minimum_size',
    category: 'validation',
    applicableNodeTypes: ['Label'],
    emits: [{ ruleName: 'label-autowrap-needs-custom-minimum-size', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkLabelAutowrap,
};

ruleRegistry.register(labelAutowrapRule);

export { labelAutowrapRule };
