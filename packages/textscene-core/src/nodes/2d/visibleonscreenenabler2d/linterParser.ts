/**
 * VisibleOnScreenEnabler2D strict validators for linting.
 *
 * Declare only this class's OWN members. `rect` and `show_rect` belong to
 * VisibleOnScreenNotifier2D and arrive through the NODE_BASE_TYPES base-walk;
 * re-declaring either would shadow the ancestor and duplicate its rule.
 *
 * The whole own surface is the two `ADD_PROPERTY` calls at
 * visible_on_screen_notifier_2d.cpp:241-242. The class binds no
 * `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no `_set`/`_get`/property-list
 * override in either spelling, and has no `.compat.inc`.
 */

import '../visibleonscreennotifier2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/**
 * `VisibleOnScreenEnabler2D::EnableMode`
 * (visible_on_screen_notifier_2d.h:85-89), in the order of the hint string
 * "Inherit,Always,When Paused".
 */
const ENABLE_MODE: Record<number, string> = {
  0: 'ENABLE_MODE_INHERIT',
  1: 'ENABLE_MODE_ALWAYS',
  2: 'ENABLE_MODE_WHEN_PAUSED',
};

validatorRegistry.registerAll('VisibleOnScreenEnabler2D', {
  // visible_on_screen_notifier_2d.cpp:241, PROPERTY_HINT_ENUM
  // "Inherit,Always,When Paused", values 0-2. set_enable_mode (:157-162) is a
  // bare `enable_mode = p_mode` with no ERR_FAIL_INDEX, so an out-of-enum value
  // loads and is only outside what the inspector dropdown offers: a warning.
  enable_mode: v.enumInt('enable_mode', 0, 2, ENABLE_MODE, {
    hinted: 'visible_on_screen_notifier_2d.cpp:241',
  }),
  // visible_on_screen_notifier_2d.cpp:242, Variant::NODE_PATH, no hint.
  // set_enable_node_path (:167-184) stores the path and only then resolves it;
  // an empty path is the documented "affect nothing" state, and an unresolvable
  // one errors at RUNTIME rather than being refused on load, so the format is
  // the only checkable constraint here.
  enable_node_path: v.nodePath('enable_node_path'),
});
