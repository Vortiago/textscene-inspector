/** A PopupMenu's own keys: the Window keys and the items its `item_<n>/<leaf>` family sets. */

import type { WindowProperties } from '../window/types';

/** `Item` (`popup_menu.h:60-90`) less the fields no `.tscn` key sets: shortcut, submenu, indent, tooltip. */
export interface PopupMenuItem {
  text: string;
  /** The Texture2D ref, absent for none. */
  icon?: string;
  /** `Item::checkable_type`: 0 none, 1 check box, 2 radio button. */
  checkable: number;
  checked: boolean;
  disabled: boolean;
  separator: boolean;
}

export interface PopupMenuProperties extends WindowProperties {
  items: readonly PopupMenuItem[];
}
