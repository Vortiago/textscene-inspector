/**
 * SubViewport strict validators — pure format checks except the two grounded
 * enums below. Enum labels are named from `doc/classes/SubViewport.xml`, but
 * the bound itself (and its warning-not-error tier) is grounded in
 * `scene/main/viewport.cpp`, where both properties live (SubViewport is
 * declared inside `viewport.h`/`viewport.cpp`, not a separate translation
 * unit).
 *
 * Only SubViewport's OWN members live here. The Viewport-level set is
 * registered once in `../shared/linterParser.ts` and reaches this type through
 * the base-walk, so Window inherits the same checks.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const UPDATE_MODE = {
  0: 'DISABLED',
  1: 'ONCE',
  2: 'WHEN_VISIBLE',
  3: 'WHEN_PARENT_VISIBLE',
  4: 'ALWAYS',
};

const CLEAR_MODE = { 0: 'ALWAYS', 1: 'NEVER', 2: 'ONCE' };

validatorRegistry.registerAll('SubViewport', {
  // set_size reaches Viewport::_set_size, whose `Size2i new_size = p_size.maxi(2)`
  // (viewport.cpp:1120) raises either component to 2. The floor is 2, not 0: a
  // SubViewport sized 1 is altered exactly as a negative one is.
  size: v.vector2i('size', { min: 2, enforced: 'viewport.cpp:1120' }),
  size_2d_override: v.vector2i('size_2d_override'),
  size_2d_override_stretch: v.boolean('size_2d_override_stretch'),
  // viewport.cpp:5584 — PROPERTY_HINT_ENUM, 5 labels. set_update_mode
  // (viewport.cpp:5475-5479) assigns unconditionally, no ERR_FAIL.
  render_target_update_mode: v.enumInt('render_target_update_mode', 0, 4, UPDATE_MODE, {
    hinted: 'viewport.cpp:5584',
  }),
  // viewport.cpp:5583 — PROPERTY_HINT_ENUM, 3 labels. set_clear_mode
  // (viewport.cpp:5486-5490) assigns unconditionally, no ERR_FAIL.
  render_target_clear_mode: v.enumInt('render_target_clear_mode', 0, 2, CLEAR_MODE, {
    hinted: 'viewport.cpp:5583',
  }),
});
