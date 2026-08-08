/**
 * Semantic linter rule for Label — `Label::get_configuration_warnings()`
 * (label.cpp:620-635):
 *
 *     if (is_inside_tree() && get_tree()->get_edited_scene_root() != this) {
 *         Container *parent_container = Object::cast_to<Container>(get_parent_control());
 *         if (parent_container && autowrap_mode != TextServer::AUTOWRAP_OFF &&
 *                 get_custom_minimum_size() == Size2()) {
 *             warnings.push_back(RTR("Labels with autowrapping enabled must have a
 *                 custom minimum size configured to work correctly inside a container."));
 *         }
 *     }
 *
 * `get_parent_control()` is NOT an ancestor walk — it is a cached
 * `Object::cast_to<Control>(get_parent())`, set once in
 * `NOTIFICATION_PARENTED` (control.cpp:3828-3829) — so this is a direct-parent
 * check, exactly `parentTypeVerdict`'s contract. The `get_edited_scene_root()`
 * exemption for a Label at the scene root needs no separate handling either: a
 * root node has no parent, so `parentTypeVerdict` already resolves it to
 * `root`, which never satisfies the Container check.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parentTypeVerdict } from '../../../../linter/parentType.js';
import { VECTOR2_REGEX } from '../../../../linter/validators/index.js';

// label.cpp:44/1435, TextServer::AutowrapMode: OFF=0, ARBITRARY=1, WORD=2, WORD_SMART=3.
const AUTOWRAP_OFF = 0;

/** True when `raw` is absent, or parses to exactly (0, 0) — Godot's `Size2()`. */
function isZeroOrAbsentSize(raw: string | undefined): boolean {
  if (raw === undefined) return true;
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return false;
  return parseFloat(match[1]!) === 0 && parseFloat(match[2]!) === 0;
}

function checkLabelAutowrap(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const autowrapRaw = props.autowrap_mode;
  if (autowrapRaw === undefined) return [];
  const autowrapMode = parseInt(autowrapRaw, 10);
  if (!Number.isFinite(autowrapMode) || autowrapMode === AUTOWRAP_OFF) return [];

  if (!isZeroOrAbsentSize(props.custom_minimum_size)) return [];

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
