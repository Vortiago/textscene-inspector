/**
 * PopupPanel strict validators for linting.
 *
 * PopupPanel declares no serialisable property of its own. Checked in all three
 * places a class can add state:
 *
 * - `_bind_methods` (popup.cpp:427-428) binds exactly one item,
 *   `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_STYLEBOX, PopupPanel, panel_style,
 *   "panel")`, a ThemeDB theme-cache registration, not `ADD_PROPERTY`. It adds
 *   no Object property by itself.
 * - `PopupPanel.xml` lists two `<member>`s (`transparent`, `transparent_bg`),
 *   both `overrides="Window"`/`overrides="Viewport"`, so they are default-value
 *   overrides, not own properties, plus one `<theme_item>` ("panel", StyleBox)
 *   documenting the binding above.
 * - PopupPanel overrides none of `_set`/`_get`/`_get_property_list`
 *   (popup.h:78-108 declares no such members), so it inherits Window's. That
 *   inherited `_get_property_list` (window.cpp:155, its stylebox block at
 *   window.cpp:222-233) walks `default_theme->get_stylebox_list(get_class_name())`
 *   (window.cpp:224), and because `default_theme.cpp:726` registers
 *   `theme->set_stylebox("panel", "PopupPanel", ...)` under the literal class
 *   name "PopupPanel", the dynamic key `theme_override_styles/panel` exists only
 *   for this type, since Window itself binds no stylebox of that name. That key
 *   is still not a PopupPanel-specific validator: it is exactly the
 *   `theme_override_styles/*` shape Window already registers generically
 *   (`../../../linter/validators/themeOverrides.ts`, spread into Window's own
 *   `registerAll` in `../window/linterParser.ts`), so the inherited wildcard
 *   resolves it without any entry here (see `linterParser.test.ts`, which
 *   asserts this resolution directly rather than assuming it).
 *
 * Everything a scene author can set on a PopupPanel, title, size, visible,
 * transient, theme, theme_override_*, and so on, reaches it through the Window
 * base-walk registered in `../window/linterParser.ts`.
 */

import '../window/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('PopupPanel', {});
