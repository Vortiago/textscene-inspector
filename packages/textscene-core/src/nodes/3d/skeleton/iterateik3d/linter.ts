/**
 * Semantic linter rule for IterateIK3D, from Godot's own configuration
 * warning, `IterateIK3D::get_configuration_warnings()` (iterate_ik_3d.cpp:158-167):
 *
 *     for (uint32_t i = 0; i < iterate_settings.size(); i++) {
 *         if (iterate_settings[i]->target_node.is_empty()) {
 *             warnings.push_back(RTR("Detecting settings with no target set! "
 *                                    "IterateIK3D must have a target to work."));
 *             break;
 *         }
 *     }
 *
 * Registered under the abstract key `IterateIK3D`, which Godot cannot
 * instantiate (no `.tscn` ever names it — see `iterateik3d/linterParser.ts`'s
 * docblock), so `applicableNodeTypeMatcher` + `descendsFrom` reaches its 3
 * concrete subclasses: CCDIK3D, FABRIK3D, JacobianIK3D. None of them override
 * `get_configuration_warnings`, so all 3 inherit this check unchanged.
 *
 * Not cosmetic: `_process_ik` resolves `target_node` and abandons the setting
 * when nothing comes back (iterate_ik_3d.cpp:509-511, `if (!target || ...)
 * continue; // Abort.`), so a target-less setting iterates never — the modifier
 * looks configured while doing nothing for that chain.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { listIndices, unsatisfiedIndices } from '../../../../linter/reportedIndices.js';
import { indexedElements } from '../../../../godot/index.js';

const RULE_NAME = 'iterateik3d-setting-missing-target-node';

function checkIterateIK3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  // Absent means zero: the setting array starts empty (ik_modifier_3d.h:69),
  // which is the XML's default="0" for setting_count.
  const countRaw = rawProps.setting_count;
  const count = ruleInt(countRaw, 0);
  // A malformed setting_count is the validator's own diagnostic, and a
  // non-finite one is altered at parse.
  if (count === null) return [];

  // Grouped by the setting `_set` RESOLVES each key to, not by the text the file
  // spells: `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // and no validity gate (iterate_ik_3d.cpp:37), so `settings/x0/target_node`
  // sets setting 0's target. Reading `settings/${index}/target_node` forward
  // found nothing there and reported a target the engine had applied as missing.
  const settings = indexedElements(rawProps, 'settings/', 'to_int');

  // The walk is bounded as well as the message: `setting_count` is an INT slot
  // with no ceiling, so `0..count` really can be two billion iterations. See
  // `reportedIndices.ts`.
  const targeted = new Set<number>();
  for (const [index, leaves] of settings) {
    if (index >= count) continue;
    const raw = leaves.target_node;
    if (raw !== undefined && extractNodePath(raw) !== null) targeted.add(index);
  }
  const { listed: missing, total } = unsatisfiedIndices(count, targeted);
  if (total === 0) return [];

  return [
    {
      severity: 'warning',
      message:
        `${node.type} '${node.name}' setting(s) ${listIndices(missing, total)} have no target_node. ` +
        "IterateIK3D resolves 'settings/<i>/target_node' during IK solving and skips a setting " +
        'with none (iterate_ik_3d.cpp:511), so this chain of bones is never posed.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const iterateIK3DTargetRule: LintRule = {
  meta: {
    name: 'valid-iterateik3d-target-node',
    description:
      'Warns when an IterateIK3D-family setting names no target_node, the configuration Godot itself flags and then skips',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'IterateIK3D'),
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkIterateIK3D,
};

ruleRegistry.register(iterateIK3DTargetRule);

export { iterateIK3DTargetRule };
