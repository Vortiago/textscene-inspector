/**
 * NinePatchRect strict validators for linting.
 *
 * Declare only NinePatchRect's OWN members - the ones doc/classes/NinePatchRect.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Skipped as inherited-override, not an own member: `mouse_filter` carries
 * `overrides="Control"` (NinePatchRect.xml:38), so it belongs to Control's
 * slice, not this one, regardless of whether Control registers it.
 *
 * `nine_patch_rect.h`/`.cpp` declare no `_validate_property`, `_get_property_list`,
 * `_set` or `_get`: no dynamic/hidden-but-serialised keys beyond the 9
 * `ADD_PROPERTY`/`ADD_PROPERTYI` calls in `_bind_methods`, and no setter refuses a
 * write outright, so `registerUnavailable` does not apply here.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// nine_patch_rect.h:39-43 - enum AxisStretchMode, 3 values; BIND_ENUM_CONSTANT at
// nine_patch_rect.cpp:86-88. Labels from the ADD_PROPERTY hint string shared by
// both axes at nine_patch_rect.cpp:83-84.
const AXIS_STRETCH_MODE = {
  0: 'AXIS_STRETCH_MODE_STRETCH',
  1: 'AXIS_STRETCH_MODE_TILE',
  2: 'AXIS_STRETCH_MODE_TILE_FIT',
};

validatorRegistry.registerAll('NinePatchRect', {
  // nine_patch_rect.cpp:164-171 - set_h_axis_stretch_mode assigns straight
  // through (only an early-return on a redundant set), with no ERR_FAIL_INDEX
  // on the mode value. ADD_PROPERTY at :83 carries PROPERTY_HINT_ENUM with 3
  // labels, so out-of-range is only HINTED, not enforced: a warning.
  axis_stretch_horizontal: v.enumInt(
    'axis_stretch_horizontal',
    0,
    2,
    AXIS_STRETCH_MODE,
    { hinted: 'nine_patch_rect.cpp:83' }
  ),
  // nine_patch_rect.cpp:177-184 - set_v_axis_stretch_mode, same shape as the
  // horizontal setter. ADD_PROPERTY at :84. Warning.
  axis_stretch_vertical: v.enumInt(
    'axis_stretch_vertical',
    0,
    2,
    AXIS_STRETCH_MODE,
    { hinted: 'nine_patch_rect.cpp:84' }
  ),

  // nine_patch_rect.cpp:151-158 - set_draw_center assigns straight through
  // (only an early-return on a redundant set); ADD_PROPERTY at :74 carries no
  // hint. Format-only.
  draw_center: v.boolean('draw_center'),

  // nine_patch_rect.cpp:120-130 - set_patch_margin: `ERR_FAIL_INDEX((int)p_side,
  // 4)` guards which of the four SIDE properties is being set, not the margin
  // VALUE itself, which is assigned straight through. Each ADD_PROPERTYI at
  // :78-81 hints "0,16384,1,suffix:px" with no or_greater/or_less, so both ends
  // are closed and merely hinted: a warning outside [0, 16384].
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

  // nine_patch_rect.cpp:137-145 - set_region_rect assigns straight through
  // (only an early-return on a redundant set); ADD_PROPERTY at :75 is
  // PROPERTY_HINT_NONE (the "suffix:px" is a display suffix, not a bound).
  // Format-only.
  region_rect: v.rect2('region_rect'),

  // nine_patch_rect.cpp:96-114 - set_texture assigns straight through (only an
  // early-return on a redundant set, plus changed-signal (dis)connection);
  // ADD_PROPERTY at :73 is PROPERTY_HINT_RESOURCE_TYPE "Texture2D", which
  // restricts the editor's resource picker, not the engine. Format-only.
  texture: v.resourceReference('texture'),
});
