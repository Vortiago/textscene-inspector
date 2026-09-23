/**
 * PopupPanel strict validators: it declares no serialisable property of its own.
 * Everything a scene sets on it (title, size, visible, transient, theme,
 * theme_override_*, and so on) arrives through the Window base walk in
 * `../window/linterParser.ts`.
 */

import '../window/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';

// `_bind_methods` (popup.cpp:427-428) binds only the "panel" theme item, a ThemeDB
// registration, not `ADD_PROPERTY`. PopupPanel.xml's `transparent` and
// `transparent_bg` override Window and Viewport. popup.h:78-108 overrides no `_set`,
// `_get` or `_get_property_list`.

// Window's `_get_property_list` (window.cpp:155, styleboxes at window.cpp:222-233)
// walks the class's styleboxes (window.cpp:224), and default_theme.cpp:726 registers
// "panel" for "PopupPanel". Window's `theme_override_styles/*` wildcard
// (themeOverrides.ts) resolves that key, as `linterParser.test.ts` asserts.
validatorRegistry.registerAll('PopupPanel', {});
