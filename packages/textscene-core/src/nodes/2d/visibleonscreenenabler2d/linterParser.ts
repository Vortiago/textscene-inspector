/**
 * VisibleOnScreenEnabler2D strict validators: its own surface, the two `ADD_PROPERTY` calls at
 * visible_on_screen_notifier_2d.cpp:241-242. It binds no `PropertyListHelper`, `ADD_ARRAY_COUNT`,
 * `_set`/`_get`/property-list override or `.compat.inc`. `rect` and `show_rect` arrive from
 * VisibleOnScreenNotifier2D through the base-walk: re-declaring them would shadow the ancestor.
 */

import '../visibleonscreennotifier2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { ENABLE_MODE } from '../../../linter/validators/sharedEnumLabels.js';

validatorRegistry.registerAll('VisibleOnScreenEnabler2D', {
  // visible_on_screen_notifier_2d.cpp:241, PROPERTY_HINT_ENUM
  // "Inherit,Always,When Paused", values 0-2. set_enable_mode (:157-162) is a
  // bare `enable_mode = p_mode` with no ERR_FAIL_INDEX, so an out-of-enum value
  // loads and is only outside what the inspector dropdown offers: a warning.
  enable_mode: v.enumInt('enable_mode', 0, 2, ENABLE_MODE, {
    hinted: 'visible_on_screen_notifier_2d.cpp:241',
  }),
  // visible_on_screen_notifier_2d.cpp:242, Variant::NODE_PATH, no hint. set_enable_node_path
  // (:167-184) stores the path and only then resolves it. An empty path means "affect nothing",
  // and an unresolvable one errors at runtime, not on load, so only the format is checkable.
  enable_node_path: v.nodePath('enable_node_path'),
});
