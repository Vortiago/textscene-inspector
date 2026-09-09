/**
 * VisibleOnScreenEnabler3D strict validators for linting.
 *
 * Declare only this class's OWN members. `aabb` belongs to
 * VisibleOnScreenNotifier3D and arrives through the NODE_BASE_TYPES base-walk;
 * re-declaring it would shadow the ancestor and duplicate its rule.
 *
 * The whole own surface is the two `ADD_PROPERTY` calls at
 * visible_on_screen_notifier_3d.cpp:198-199. The class binds no
 * `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no `_set`/`_get`/property-list
 * override in either spelling, and has no `.compat.inc`.
 */

import '../visibleonscreennotifier3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { ENABLE_MODE } from '../../../linter/validators/sharedEnumLabels.js';

validatorRegistry.registerAll('VisibleOnScreenEnabler3D', {
  // visible_on_screen_notifier_3d.cpp:198, PROPERTY_HINT_ENUM
  // "Inherit,Always,When Paused", values 0-2. set_enable_mode (:114-119) is a
  // bare `enable_mode = p_mode` with no ERR_FAIL_INDEX, so an out-of-enum value
  // loads and is only outside what the inspector dropdown offers: a warning.
  enable_mode: v.enumInt('enable_mode', 0, 2, ENABLE_MODE, {
    hinted: 'visible_on_screen_notifier_3d.cpp:198',
  }),
  // visible_on_screen_notifier_3d.cpp:199, Variant::NODE_PATH, no hint. The
  // setter stores the path and only then resolves it; an empty path is the
  // documented "affect nothing" state and an unresolvable one errors at RUNTIME
  // rather than being refused on load, so format is the only checkable
  // constraint here.
  enable_node_path: v.nodePath('enable_node_path'),
});
