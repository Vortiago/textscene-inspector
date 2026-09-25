/**
 * TabBar cross-field errors: an index checked against the sibling `tab_count`,
 * which a per-property validator cannot see (ADR-0032). The engine refuses both
 * writes, so both are errors, although the scene still loads.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { indicesPastCount, listWrittenIndices } from '../../../../linter/reportedIndices.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleCount, ruleInt } from '../../../../linter/validators/commonValidators.js';

/**
 * The family's prefix. The `tab_` scalars (`tab_alignment`, `tab_count`) carry no `/`, so they
 * name no index. TabBar's `PropertyListHelper` (tab_bar.cpp) gates the index on
 * `String::is_valid_int()` (property_list_helper.cpp:53).
 */
const TAB_PREFIX = 'tab_';

function checkTabBar(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const props = node.properties as Record<string, string>;

  // Absent means 0: `tabs` is default-constructed empty
  // (doc/classes/TabBar.xml:282 records the same default).
  const count = ruleCount(props.tab_count);
  // A malformed tab_count is already reported by its own validator, and a
  // non-finite one is altered at parse to a number the file does not state;
  // neither is a count this rule can name in a message.
  if (count === null) return diagnostics;

  // Either order drops the write. `tab_count` first flips `initialized` (tab_bar.cpp:778-779),
  // so `set_current_tab` fails `ERR_FAIL_INDEX` (tab_bar.cpp:804). `current_tab` first, the
  // writer order (tab_bar.cpp:2123 before tab_bar.cpp:2137), queues it (tab_bar.cpp:800-802) for
  // `set_tab_count` to replay (tab_bar.cpp:780-782). Without `tab_count`, nothing replays it (tab_bar.cpp:404).
  const currentRaw = props.current_tab;
  if (currentRaw !== undefined) {
    const current = ruleInt(currentRaw);
    // Below -1 is linterParser.ts's error. -1 is the default and the deselect sentinel,
    // guarded by `_can_deselect()` (tab_bar.cpp:798), which is true while the vector is empty.
    if (current !== null && current >= 0 && current >= count) {
      diagnostics.push({
        severity: 'error',
        message:
          `TabBar '${node.name}' selects tab ${current} but declares only ${count} tab(s) (tab_count). ` +
          'set_current_tab parks the index in queued_current and returns while the bar is ' +
          'uninitialised (tab_bar.cpp:801-802); only set_tab_count replays it (:778-782), and ' +
          'with tab_count absent or 0 that returns at its own `p_count == tabs.size()` guard ' +
          '(:741) without ever replaying. Either way the selection is dropped and the bar ' +
          'opens on its default tab.',
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'tabbar-current-tab-out-of-range',
      });
    }
  }

  // `TabBar::_set` is `property_helper.property_set_value` (tab_bar.h:208), which drops an
  // index at or past the length getter (property_list_helper.cpp:58), here `get_tab_count`
  // (tab_bar.cpp:2189). Only TabContainer enables out-of-bounds assign (tab_container.cpp:1294).
  // Godot's saver never writes this: `tabs.resize(p_count)` (tab_bar.cpp:755) keeps both in step.
  const offending = indicesPastCount(props, TAB_PREFIX, 'is_valid_int', count);

  if (offending.size > 0) {
    const indices = listWrittenIndices(offending);
    diagnostics.push({
      severity: 'error',
      message:
        `TabBar '${node.name}' sets properties on tab index(es) ${indices} but declares only ${count} tab(s) (tab_count). ` +
        'PropertyListHelper::_get_property returns null for an index at or past the array length ' +
        '(property_list_helper.cpp:58) and TabBar never enables out-of-bounds assignment, so these ' +
        'tab_<idx>/… values are silently dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tabbar-tab-index-out-of-range',
    });
  }

  return diagnostics;
}

const tabBarValidationRule: LintRule = {
  meta: {
    name: 'valid-tabbar-properties',
    description: "Validates TabBar's current_tab and tab_<idx>/… indices against tab_count",
    category: 'validation',
    applicableNodeTypes: ['TabBar'],
    emits: [
      {
        ruleName: 'tabbar-current-tab-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'tab_bar.cpp:802' },
      },
      {
        ruleName: 'tabbar-tab-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkTabBar,
};

ruleRegistry.register(tabBarValidationRule);

export { tabBarValidationRule };
