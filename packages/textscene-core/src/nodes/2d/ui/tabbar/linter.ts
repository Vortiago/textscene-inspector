/**
 * TabBar cross-field advisories, both of them an index measured against the
 * sibling `tab_count`, which is exactly what a per-property validator cannot
 * see (ADR-0032). Format and range validation lives in linterParser.ts.
 *
 * 1. `current_tab` past the last tab. Whichever order the two properties
 *    appear in, the write is refused:
 *      - `tab_count` first: `set_tab_count` flips `initialized`
 *        (tab_bar.cpp:778-779), so the later `set_current_tab` skips its
 *        queue branch and hits `ERR_FAIL_INDEX(p_current, get_tab_count())`
 *        (tab_bar.cpp:804).
 *      - `current_tab` first (Godot's own writer order, since ADD_PROPERTY
 *        declares it at tab_bar.cpp:2123 ahead of the ADD_ARRAY_COUNT at
 *        tab_bar.cpp:2137): the tab vector is still empty, so
 *        `!initialized && p_current >= get_tab_count()` stashes the value in
 *        `queued_current` and returns (tab_bar.cpp:800-802). `set_tab_count`
 *        then replays it (tab_bar.cpp:780-782) into the SAME ERR_FAIL_INDEX.
 *      - `tab_count` absent entirely: `set_tab_count` is never called, so the
 *        queued value is never replayed at all. `initialized` flips on
 *        NOTIFICATION_ENTER_TREE instead (tab_bar.cpp:404) without consuming
 *        it, and the selection simply evaporates.
 *    `current_tab = -1` is exempt: it is the property default and the
 *    deselect sentinel, guarded by `_can_deselect()` (tab_bar.cpp:798), whose
 *    answer depends on every tab's `disabled`/`hidden` state at the moment of
 *    the call and is trivially true while the vector is still empty at load.
 *
 * 2. A `tab_<idx>/<leaf>` key whose index the array never holds. `TabBar::_set`
 *    is `property_helper.property_set_value(...)` (tab_bar.h:208), and
 *    `PropertyListHelper::_get_property` returns nullptr for
 *    `index >= _call_array_length_getter()` unless `allow_oob_assign` is set
 *    (property_list_helper.cpp:58). TabBar never calls
 *    `enable_out_of_bounds_assign()` (only TabContainer does,
 *    tab_container.cpp:1294), so the length getter is `get_tab_count`
 *    (tab_bar.cpp:2189) and the write is dropped with nothing printed. Godot's
 *    own saver cannot produce this: `tab_count` is ClassDB-bound and therefore
 *    written ahead of the `_get_property_list`-appended leaves, and
 *    `tabs.resize(p_count)` (tab_bar.cpp:755) keeps the two in step.
 *
 * Both are warnings rather than errors. Each rests on a sibling property whose
 * value the rule reads from an unordered bag, and the engine's response is a
 * dropped write rather than a refused file: the scene still loads, just
 * without the tab state the author wrote.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

/**
 * A `tab_<idx>/` key. The index run is required, which is what keeps the
 * scalars sharing the bare `tab_` prefix (`tab_alignment`, `tab_count`,
 * `tab_close_display_policy`) out: none of them carries a `/`.
 */
const TAB_KEY_RE = /^tab_(-?\d+)\//;

function checkTabBar(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const props = node.properties as Record<string, string>;

  // Absent means 0: `tabs` is default-constructed empty
  // (doc/classes/TabBar.xml:282 records the same default).
  const count = props.tab_count === undefined ? 0 : parseInt(props.tab_count, 10);
  // A malformed tab_count is already reported by its own validator; this rule
  // only reasons about a value that parsed.
  if (Number.isNaN(count)) return diagnostics;

  const currentRaw = props.current_tab;
  if (currentRaw !== undefined) {
    const current = parseInt(currentRaw, 10);
    // Below -1 is linterParser.ts's error (tab_bar.cpp:804), and -1 itself is
    // the legal deselect sentinel, so only a non-negative index is compared.
    if (!Number.isNaN(current) && current >= 0 && current >= count) {
      diagnostics.push({
        severity: 'error',
        message:
          `TabBar '${node.name}' selects tab ${current} but declares only ${count} tab(s) (tab_count). ` +
          'set_current_tab reaches ERR_FAIL_INDEX(p_current, get_tab_count()) (tab_bar.cpp:804) ' +
          'whichever of the two properties Godot applies first, so the selection is dropped and ' +
          'the bar opens on its default tab.',
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'tabbar-current-tab-out-of-range',
      });
    }
  }

  const offending = new Set<number>();
  for (const key of Object.keys(props)) {
    const match = TAB_KEY_RE.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    // A negative index is linterParser.ts's error
    // (property_list_helper.cpp:58); this rule owns only the high end.
    if (index >= 0 && index >= count) offending.add(index);
  }

  if (offending.size > 0) {
    const indices = [...offending].sort((a, b) => a - b).join(', ');
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
        grounding: { kind: 'engine', at: 'tab_bar.cpp:804' },
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
