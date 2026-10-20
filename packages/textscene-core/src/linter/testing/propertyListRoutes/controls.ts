/**
 * `Control` and `Window` theme overrides, six independently written
 * `theme_override_*` families each, and the `PropertyListHelper`-backed GUI
 * families beside them.
 */

import type { RouteRow } from './types.js';

export const controlRoutes: readonly RouteRow[] = [
  {
    type: 'Control',
    at: 'control.cpp:421-425',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:429-432',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:436-439',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:443-446',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:450-453',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:457-460',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },
  {
    // Window's base is Viewport, not Control: a separate override producing the
    // same six families. window.cpp and control.cpp differ in storage members
    // and null-check macros (see themeOverrides.ts's header).
    type: 'Window',
    at: 'window.cpp:167-171',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:178-183',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:189-195',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:200-207',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:212-219',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:224-231',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },

  {
    type: 'GraphNode',
    at: 'graph_node.cpp:130-149',
    sample: 'slot/0/left_enabled',
    verdict: { validated: true },
  },

  {
    type: 'FileDialog',
    at: 'file_dialog.cpp:2199-2204',
    sample: 'option_0/name',
    verdict: { validated: true },
  },
  {
    type: 'ItemList',
    at: 'item_list.cpp:2461-2466',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    // Its own prefix "popup/item_" (menu_button.cpp:213-222), forwarded into the
    // internal PopupMenu child (menu_button.cpp:174-192). That child is never
    // owned, so packed_scene.cpp never saves it, and this key is the only place
    // the data reaches a .tscn.
    type: 'MenuButton',
    at: 'menu_button.cpp:213-222',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    // Same forwarding shape as MenuButton, without checkable and checked:
    // OptionButton makes every item radio-checkable itself.
    type: 'OptionButton',
    at: 'option_button.cpp:626-633',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'PopupMenu',
    at: 'popup_menu.cpp:3319-3327',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'TabBar',
    at: 'tab_bar.cpp:2188-2193',
    sample: 'tab_0/title',
    verdict: { validated: true },
  },
  {
    // A PropertyListHelper apart from TabBar's (tab_container.h:113), registered
    // at tab_container.cpp:1270-1276, with its own leaves: title, icon, disabled
    // and hidden, no tooltip.
    type: 'TabContainer',
    at: 'tab_container.cpp:1270-1276',
    sample: 'tab_0/title',
    verdict: { validated: true },
  },
];
