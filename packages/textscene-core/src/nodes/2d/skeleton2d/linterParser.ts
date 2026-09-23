/**
 * Skeleton2D strict validators. doc/classes/Skeleton2D.xml lists no members and
 * `_bind_methods` (skeleton_2d.cpp:817-831) binds no `ADD_PROPERTY`, yet one key
 * serialises through the `_set`/`_get`/`_get_property_list` override
 * (skeleton_2d.cpp:514/522/530).
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Skeleton2D', {
  // skeleton_2d.cpp:530-536 pushes one OBJECT PropertyInfo with
  // PROPERTY_USAGE_DEFAULT, which carries STORAGE. Format only: set_modification_stack
  // (skeleton_2d.cpp:748-763) has no ERR_FAIL, clamp or null guard, and the
  // type hint narrows only the inspector's picker.
  modification_stack: v.resourceReference('modification_stack'),
});
