/**
 * Semantic linter rule for Tree.
 *
 * Format validation is in linterParser.ts, and it sees each of Tree's sixteen
 * members alone. One condition needs two of them at once: `tile_scroll_hint`
 * only ever reaches the renderer through the scroll-hint draw block, which
 * `Tree::_notification(NOTIFICATION_DRAW)` opens with
 * `if (scroll_hint_mode != SCROLL_HINT_MODE_DISABLED)` (tree.cpp:5193) and
 * closes at tree.cpp:5206. The flag's only two reads are the `p_tile` argument
 * of the two `draw_texture_rect` calls at tree.cpp:5200 and tree.cpp:5203, both
 * inside that block, so with the mode disabled the property changes nothing
 * that is drawn. Godot's own class reference couples them the same way
 * (doc/classes/Tree.xml:399, "See [member scroll_hint_mode]").
 *
 * It is warning-only and cannot false-positive on Godot's own output: the
 * serialiser omits a property at its default, so `tile_scroll_hint` appears
 * only as `true` (default `false`, tree.h:755) and an absent `scroll_hint_mode`
 * really is SCROLL_HINT_MODE_DISABLED (default 0, tree.h:754).
 *
 * Deliberately NOT a rule: `scroll_hint_mode` set while
 * `scroll_vertical_enabled = false`. Disabling the vertical scrollbar only
 * stops `get_minimum_size` from zeroing the content height (tree.cpp:5267-5270);
 * whether the bar appears is decided by `display_vscroll`, which compares
 * content against the actual rect (tree.cpp:4579), so a Tree squeezed below its
 * minimum still scrolls and still draws hints. Nothing is inert there.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

/** tree.h:469-474 Tree::ScrollHintMode: SCROLL_HINT_MODE_DISABLED = 0. */
const SCROLL_HINT_MODE_DISABLED = 0;

function checkTree(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  if (rawProps.tile_scroll_hint?.trim() !== 'true') return diagnostics;

  const rawMode = rawProps.scroll_hint_mode;
  // Absent is the serialised form of the default, so it counts as disabled. A
  // value nobody can read is the validator's business, not this rule's, and
  // `parseInt` is what reads it there: `Number('')` would be 0 and turn an
  // empty value into a spurious second diagnostic for one defect.
  if (rawMode !== undefined) {
    const mode = parseInt(rawMode, 10);
    if (Number.isNaN(mode) || mode !== SCROLL_HINT_MODE_DISABLED) return diagnostics;
  }

  diagnostics.push({
    severity: 'warning',
    message:
      'Tree sets tile_scroll_hint = true while scroll_hint_mode is SCROLL_HINT_MODE_DISABLED ' +
      `(${rawMode === undefined ? 'omitted, which is the default 0' : 'set to 0'}), so the flag changes nothing. ` +
      'Tree only reads tile_scroll_hint inside the `scroll_hint_mode != SCROLL_HINT_MODE_DISABLED` ' +
      'draw block (tree.cpp:5193-5206). Set scroll_hint_mode to Both, Top or Bottom, or drop tile_scroll_hint.',
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'tree-tile-scroll-hint-without-hints',
  });

  return diagnostics;
}

const treeScrollHintRule: LintRule = {
  meta: {
    name: 'valid-tree-scroll-hint',
    description:
      'Flags a Tree whose tile_scroll_hint is enabled while scroll_hint_mode leaves the hint undrawn',
    category: 'validation',
    applicableNodeTypes: ['Tree'],
    emits: [{ ruleName: 'tree-tile-scroll-hint-without-hints', severity: 'warning' }],
  },
  check: checkTree,
};

ruleRegistry.register(treeScrollHintRule);

export { treeScrollHintRule };
