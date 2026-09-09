/**
 * HScrollBar strict validators for linting.
 *
 * Checked and found empty. doc/classes/HScrollBar.xml declares no <members> at
 * all, only <theme_items> (padding_top, padding_bottom), which are ThemeDB
 * bindings (BIND_THEME_ITEM, scroll_bar.cpp:719-721), not ADD_PROPERTY calls,
 * so they never serialize to a .tscn. HScrollBar::_bind_methods binds nothing
 * else. Its whole surface is ScrollBar's plus Range's plus Control's,
 * delivered by the NODE_BASE_TYPES base-walk.
 */

import '../scrollbar/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('HScrollBar', {});
