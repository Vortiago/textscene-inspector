/**
 * BackBufferCopy strict validators for linting.
 *
 * Declare only BackBufferCopy's OWN members — the ones doc/classes/BackBufferCopy.xml
 * lists without an `overrides=` attribute. Everything from Node2D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('BackBufferCopy', {
  // back_buffer_copy.cpp:73 `set_copy_mode` assigns `copy_mode = p_mode` straight
  // through — no ERR_FAIL_COND, and `CopyMode` (back_buffer_copy.h) carries no MAX
  // sentinel — so out-of-range is only the PROPERTY_HINT_ENUM's inspector bound
  // (back_buffer_copy.cpp:98): hinted, a warning.
  copy_mode: v.enumInt(
    'copy_mode',
    0,
    2,
    { 0: 'Disabled', 1: 'Rect', 2: 'Viewport' },
    { hinted: 'back_buffer_copy.cpp:98' }
  ),
  // back_buffer_copy.cpp:99 hints PROPERTY_HINT_NONE and set_rect (:63) assigns
  // without a clamp — format only, no bound.
  rect: v.rect2('rect'),
});
