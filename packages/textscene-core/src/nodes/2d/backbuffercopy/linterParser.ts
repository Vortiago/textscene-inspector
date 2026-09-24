/**
 * BackBufferCopy strict validators for linting: only its own members, the ones
 * doc/classes/BackBufferCopy.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers Node2D's, and a re-declared inherited key would shadow it.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('BackBufferCopy', {
  // back_buffer_copy.cpp:73 `set_copy_mode` assigns `copy_mode = p_mode` with no
  // ERR_FAIL_COND, and `CopyMode` (back_buffer_copy.h) has no MAX sentinel. Out of
  // range is only the PROPERTY_HINT_ENUM bound (back_buffer_copy.cpp:98): a warning.
  copy_mode: v.enumInt(
    'copy_mode',
    0,
    2,
    { 0: 'Disabled', 1: 'Rect', 2: 'Viewport' },
    { hinted: 'back_buffer_copy.cpp:98' }
  ),
  // back_buffer_copy.cpp:99 hints PROPERTY_HINT_NONE and set_rect (:63) assigns
  // without a clamp: format only, no bound.
  rect: v.rect2('rect'),
});
