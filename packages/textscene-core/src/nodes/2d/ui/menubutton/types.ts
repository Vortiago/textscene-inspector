/**
 * MenuButton draws what its `Button` base draws, since `menu_button.cpp` has no draw notification, so it has Button's properties. `switch_on_hover`,
 * `item_count` and `popup/item_<idx>/<leaf>` affect only the internal `PopupMenu`, a `Window` this
 * previewer never draws.
 */
export type { ButtonProperties as MenuButtonProperties } from '../button/types';
