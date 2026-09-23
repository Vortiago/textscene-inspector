/**
 * HScrollBar strict validators: none. doc/classes/HScrollBar.xml has only
 * theme items (BIND_THEME_ITEM, scroll_bar.cpp:719-721), which never reach a
 * .tscn, and `_bind_methods` binds nothing else. The NODE_BASE_TYPES walk
 * delivers ScrollBar, Range and Control.
 */

import '../scrollbar/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('HScrollBar', {});
