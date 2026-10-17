/** Godot 4.6.3's Tree facts a scene's properties carry. */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';

/** `Tree::SelectMode` (`scene/gui/tree.h:457-461`). */
const SelectMode = {
  SINGLE: 0,
  ROW: 1,
  MULTI: 2,
} as const;

/** Each select mode by its integer, spelled as its constant (`tree.cpp:6841-6843`). */
export const TREE_SELECT_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(SelectMode),
  (name) => `SELECT_${name}`
);

/**
 * `Tree::DropModeFlags` (`tree.h:463-467`). `DROP_MODE_DISABLED` is 0, the empty set, so it is not
 * a bit.
 */
const DropModeFlag = {
  ON_ITEM: 1,
  INBETWEEN: 2,
} as const;

/** Each drop mode bit by its value, spelled as its constant (`tree.cpp:6846-6847`). */
export const TREE_DROP_MODE_FLAG_NAMES = relabelEnumNames(
  enumNamesByValue(DropModeFlag),
  (name) => `DROP_MODE_${name}`
);

/** `Tree::ScrollHintMode` (`tree.h:469-474`). */
const ScrollHintMode = {
  DISABLED: 0,
  BOTH: 1,
  TOP: 2,
  BOTTOM: 3,
} as const;

/** Each scroll hint mode by its integer, spelled as its constant (`tree.cpp:6849-6852`). */
export const TREE_SCROLL_HINT_MODE_NAMES = relabelEnumNames(
  enumNamesByValue(ScrollHintMode),
  (name) => `SCROLL_HINT_MODE_${name}`
);
