/**
 * Semantic linter rules for MenuBar.
 *
 * Format validation is in linterParser.ts. The one condition worth flagging is
 * structural, so no format check can see it: MenuBar draws nothing but its menu
 * items. `NOTIFICATION_DRAW` (menu_bar.cpp:352-359) is a bare loop over
 * `menu_cache` calling `_draw_menu_item(i)`, with no bar-level background of its
 * own, and `menu_cache` gains an entry only in `add_child_notify`
 * (menu_bar.cpp:603-616) when the new child casts to PopupMenu. A MenuBar with
 * no PopupMenu child therefore draws zero items and reports a zero
 * `get_minimum_size` (menu_bar.cpp:865-884): it is invisible, not merely empty.
 *
 * Deliberately NOT a rule: a `start_index` set while `prefer_global_menu` is
 * false. It reads like a dead property (the value is consulted only inside
 * `bind_global_menu`, menu_bar.cpp:229), but `start_index` is equally inert on
 * any platform without FEATURE_GLOBAL_MENU (menu_bar.cpp:213-215) whatever
 * `prefer_global_menu` says, so the pairing is not what makes it inert and the
 * warning would be wrong about its own reason.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';

function checkMenuBarChildren(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children ?? [];

  if (children.some((child) => child.type === 'PopupMenu')) return [];

  // Instance-opaque linting (CONTEXT.md): an `instance=` child is typeless
  // here, and the sub-scene it points at may well be rooted at a PopupMenu.
  // Staying silent beats false-positiving on a normal Godot idiom.
  if (children.some(isTypeUnknowable)) return [];

  return [
    {
      severity: 'warning',
      message:
        'MenuBar has no PopupMenu child, so it draws no menu items and takes zero minimum size. Add a PopupMenu beneath it: its title, or its node name, becomes the menu label.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'menubar-no-popupmenu',
    },
  ];
}

const menuBarNoPopupMenuRule: LintRule = {
  meta: {
    name: 'valid-menubar-children',
    description: 'Flags a MenuBar with no PopupMenu child, which draws nothing at all',
    category: 'validation',
    applicableNodeTypes: ['MenuBar'],
    emits: [{ ruleName: 'menubar-no-popupmenu', severity: 'warning' }],
  },
  check: checkMenuBarChildren,
};

ruleRegistry.register(menuBarNoPopupMenuRule);

export { menuBarNoPopupMenuRule };
