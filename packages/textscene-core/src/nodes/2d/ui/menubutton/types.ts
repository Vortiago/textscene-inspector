/**
 * MenuButton draws exactly what its `Button` base draws — `menu_button.cpp`
 * declares no `_notification(NOTIFICATION_DRAW)` at all — so it needs no own
 * properties beyond Button's. `switch_on_hover`, `item_count` and every
 * `popup/item_<idx>/<leaf>` only affect the internal `PopupMenu`, a `Window`
 * this previewer never draws.
 */
export type { ButtonProperties as MenuButtonProperties } from '../button/types';
