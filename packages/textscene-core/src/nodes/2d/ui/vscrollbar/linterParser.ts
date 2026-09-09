/**
 * VScrollBar strict validators for linting.
 *
 * Checked and found empty. doc/classes/VScrollBar.xml lists two <members>,
 * size_flags_horizontal and size_flags_vertical, both overrides="Control".
 * VScrollBar's constructor (scroll_bar.h:154-155) calls set_h_size_flags(0),
 * fixing the axis by changing the constructor's initial value, not by adding
 * a property: VScrollBar::_bind_methods (scroll_bar.cpp:714-717) calls
 * BIND_THEME_ITEM for padding_left/padding_right only, never ADD_PROPERTY. So
 * both members are skipped per the "overrides= is a default override" rule;
 * Control already validates size_flags_horizontal and size_flags_vertical
 * with no bound (control.cpp:1840-1860 bare-assigns), so the override values
 * 0 and 1 are accepted regardless. VScrollBar's whole surface is ScrollBar's
 * plus Range's plus Control's, delivered by the NODE_BASE_TYPES base-walk.
 */

import '../scrollbar/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerAll('VScrollBar', {});
