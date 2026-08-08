/**
 * `Control`/`Window` theme overrides — six independently written
 * `theme_override_*` families each — and the `PropertyListHelper`-backed GUI
 * families beside them.
 */

import type { RouteRow } from './types.js';

export const controlRoutes: readonly RouteRow[] = [
  // --- Control/Window: six independently-written theme_override_* families each ---
  {
    type: 'Control',
    at: 'control.cpp:421-425',
    route: 'property-list',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:429-432',
    route: 'property-list',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:436-439',
    route: 'property-list',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:443-446',
    route: 'property-list',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:450-453',
    route: 'property-list',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Control',
    at: 'control.cpp:457-460',
    route: 'property-list',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },
  {
    // Window is not a Control descendant (its base is Viewport): this is a
    // SEPARATE, independently written override producing the same six
    // families (window.cpp vs control.cpp — different storage members,
    // different null-check macros; see themeOverrides.ts's header).
    type: 'Window',
    at: 'window.cpp:167-171',
    route: 'property-list',
    sample: 'theme_override_colors/font_color',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:178-183',
    route: 'property-list',
    sample: 'theme_override_constants/separation',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:189-195',
    route: 'property-list',
    sample: 'theme_override_fonts/font',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:200-207',
    route: 'property-list',
    sample: 'theme_override_font_sizes/font_size',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:212-219',
    route: 'property-list',
    sample: 'theme_override_icons/icon',
    verdict: { validated: true },
  },
  {
    type: 'Window',
    at: 'window.cpp:224-231',
    route: 'property-list',
    sample: 'theme_override_styles/panel',
    verdict: { validated: true },
  },

  {
    type: 'GraphNode',
    at: 'graph_node.cpp:130-149',
    route: 'property-list',
    sample: 'slot/0/left_enabled',
    verdict: { validated: true },
  },

  // --- PropertyListHelper-backed GUI families ---
  {
    type: 'FileDialog',
    at: 'file_dialog.cpp:2199-2204',
    route: 'PropertyListHelper',
    sample: 'option_0/name',
    verdict: { validated: true },
  },
  {
    type: 'ItemList',
    at: 'item_list.cpp:2461-2466',
    route: 'PropertyListHelper',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    // Registered under its OWN prefix "popup/item_" (menu_button.cpp:213-222),
    // distinct from PopupMenu's bare "item_". _set/_get forward into the
    // internal PopupMenu child's own set()/get() (menu_button.cpp:174-192), but
    // that child is added with add_child(..., INTERNAL_MODE_FRONT) and never
    // owned, so packed_scene.cpp's save_node test never saves it independently
    // — "popup/item_0/text" on MenuButton is the only place this data reaches
    // a .tscn, a real distinct family rather than duplicate/dead storage.
    type: 'MenuButton',
    at: 'menu_button.cpp:213-222',
    route: 'PropertyListHelper',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    // Same forwarding shape as MenuButton, smaller leaf set (no
    // checkable/checked — OptionButton forces every item radio-checkable
    // itself).
    type: 'OptionButton',
    at: 'option_button.cpp:626-633',
    route: 'PropertyListHelper',
    sample: 'popup/item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'PopupMenu',
    at: 'popup_menu.cpp:3319-3327',
    route: 'PropertyListHelper',
    sample: 'item_0/text',
    verdict: { validated: true },
  },
  {
    type: 'TabBar',
    at: 'tab_bar.cpp:2188-2193',
    route: 'PropertyListHelper',
    sample: 'tab_0/title',
    verdict: { validated: true },
  },
  {
    // A SEPARATE PropertyListHelper instance from TabBar's own (own
    // "static inline PropertyListHelper base_property_helper", tab_container.h:113),
    // registered tab_container.cpp:1270-1276, with its own leaf set (title,
    // icon, disabled, hidden — no tooltip). TabContainer is the only class in
    // this batch with no registered wildcard for its own family at all.
    type: 'TabContainer',
    at: 'tab_container.cpp:1270-1276',
    route: 'PropertyListHelper',
    sample: 'tab_0/title',
    verdict: { validated: true },
  },
];
