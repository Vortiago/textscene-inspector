/**
 * NinePatchRect's strict validators: the 9 `ADD_PROPERTY`/`ADD_PROPERTYI` calls of `_bind_methods`, which
 * doc/classes/NinePatchRect.xml lists without `overrides=`. `mouse_filter` (NinePatchRect.xml:38) is Control's,
 * from the NODE_BASE_TYPES base-walk. `nine_patch_rect.h`/`.cpp` have no `_validate_property`,
 * `_get_property_list`, `_set` or `_get`, and no setter refuses a write, so `registerUnavailable` does not apply.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// nine_patch_rect.h:39-43: enum AxisStretchMode, 3 values, BIND_ENUM_CONSTANT at nine_patch_rect.cpp:86-88.
// Labels from the hint string both axes share at nine_patch_rect.cpp:83-84.
const AXIS_STRETCH_MODE = {
  0: 'AXIS_STRETCH_MODE_STRETCH',
  1: 'AXIS_STRETCH_MODE_TILE',
  2: 'AXIS_STRETCH_MODE_TILE_FIT',
};

validatorRegistry.registerAll('NinePatchRect', {
  // nine_patch_rect.cpp:164-171: set_h_axis_stretch_mode assigns, with only an early return on a
  // redundant set and no ERR_FAIL_INDEX. The ADD_PROPERTY at :83 carries PROPERTY_HINT_ENUM with 3 labels,
  // so out-of-range is hinted, not enforced: a warning.
  axis_stretch_horizontal: v.enumInt(
    'axis_stretch_horizontal',
    0,
    2,
    AXIS_STRETCH_MODE,
    { hinted: 'nine_patch_rect.cpp:83' }
  ),
  // nine_patch_rect.cpp:177-184: set_v_axis_stretch_mode, shaped as the horizontal setter. ADD_PROPERTY
  // at :84. Warning.
  axis_stretch_vertical: v.enumInt(
    'axis_stretch_vertical',
    0,
    2,
    AXIS_STRETCH_MODE,
    { hinted: 'nine_patch_rect.cpp:84' }
  ),

  // nine_patch_rect.cpp:151-158: set_draw_center assigns, with only an early return on a redundant set.
  // The ADD_PROPERTY at :74 has no hint. Format-only.
  draw_center: v.boolean('draw_center'),

  // nine_patch_rect.cpp:120-130: set_patch_margin's `ERR_FAIL_INDEX((int)p_side, 4)` guards the side,
  // not the value, which it assigns. Each ADD_PROPERTYI at :78-81 hints "0,16384,1,suffix:px" with no
  // or_greater/or_less, so a value outside [0, 16384] warns.
  patch_margin_bottom: v.int('patch_margin_bottom', {
    min: 0,
    max: 16384,
    hinted: 'nine_patch_rect.cpp:81',
  }),
  patch_margin_left: v.int('patch_margin_left', {
    min: 0,
    max: 16384,
    hinted: 'nine_patch_rect.cpp:78',
  }),
  patch_margin_right: v.int('patch_margin_right', {
    min: 0,
    max: 16384,
    hinted: 'nine_patch_rect.cpp:80',
  }),
  patch_margin_top: v.int('patch_margin_top', {
    min: 0,
    max: 16384,
    hinted: 'nine_patch_rect.cpp:79',
  }),

  // nine_patch_rect.cpp:137-145: set_region_rect assigns, with only an early return on a redundant set.
  // The ADD_PROPERTY at :75 is PROPERTY_HINT_NONE: "suffix:px" is a display suffix. Format-only.
  region_rect: v.rect2('region_rect'),

  // nine_patch_rect.cpp:96-114: set_texture assigns, with only an early return on a redundant set and the
  // changed-signal wiring. The ADD_PROPERTY at :73 is PROPERTY_HINT_RESOURCE_TYPE "Texture2D", which limits
  // the editor's picker, not the engine. Format-only.
  texture: v.resourceReference('texture'),
});
