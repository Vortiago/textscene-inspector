/**
 * TextureProgressBar strict validators: only the members doc/classes/TextureProgressBar.xml lists
 * without `overrides=` (not `mouse_filter`, `size_flags_vertical` or `step`). `_validate_property`
 * (texture_progress_bar.cpp:638-649) hides `stretch_margin_*` and `radial_*` only through
 * `PROPERTY_USAGE_NO_EDITOR`, which is `STORAGE` (core/object/object.h:132), so all stay serialised.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// texture_progress_bar.h:48-59: enum FillMode, 9 values, bound at texture_progress_bar.cpp:716-724.
// The labels come from the ADD_PROPERTY hint string at texture_progress_bar.cpp:691.
const FILL_MODE = {
  0: 'FILL_LEFT_TO_RIGHT',
  1: 'FILL_RIGHT_TO_LEFT',
  2: 'FILL_TOP_TO_BOTTOM',
  3: 'FILL_BOTTOM_TO_TOP',
  4: 'FILL_CLOCKWISE',
  5: 'FILL_COUNTER_CLOCKWISE',
  6: 'FILL_BILINEAR_LEFT_AND_RIGHT',
  7: 'FILL_BILINEAR_TOP_AND_BOTTOM',
  8: 'FILL_CLOCKWISE_AND_COUNTER_CLOCKWISE',
};

validatorRegistry.registerAll('TextureProgressBar', {
  // texture_progress_bar.cpp:576: set_fill_mode's `ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)`
  // refuses the write, so out of range is an error.
  fill_mode: v.enumInt('fill_mode', 0, 8, FILL_MODE, { enforced: 'texture_progress_bar.cpp:576' }),

  // texture_progress_bar.cpp:66-75: set_nine_patch_stretch assigns straight
  // through. ADD_PROPERTY at :698 carries no hint. Format-only.
  nine_patch_stretch: v.boolean('nine_patch_stretch'),

  // texture_progress_bar.cpp:625-632: set_radial_center_offset assigns straight
  // through. ADD_PROPERTY at :695 is PROPERTY_HINT_NONE, and "suffix:px" is a
  // display suffix, not a bound. Format-only.
  radial_center_offset: v.vector2('radial_center_offset'),

  // texture_progress_bar.cpp:610-619: set_fill_degrees's `CLAMP(p_angle, 0, 360)` alters the
  // value, which is enforcement (ADR-0032). The value is degrees: texture_progress_bar.cpp:483
  // divides rad_max_degrees by 360 with no conversion, so this is `v.float`, not `v.radians`.
  radial_fill_degrees: v.float('radial_fill_degrees', {
    min: 0,
    max: 360,
    enforced: 'texture_progress_bar.cpp:611',
  }),

  // texture_progress_bar.cpp:591-604: set_radial_initial_angle wraps a value outside [0, 360]
  // with `Math::fposmodp`, an alteration, so enforced. Degrees (rad_init_angle / 360 at
  // texture_progress_bar.cpp:494). The `!Math::is_finite` guard (texture_progress_bar.cpp:592) is
  // separate, since every range comparison against `nan` is false.
  radial_initial_angle: v.float('radial_initial_angle', {
    min: 0,
    max: 360,
    enforced: 'texture_progress_bar.cpp:594',
    finite: 'texture_progress_bar.cpp:592',
  }),

  // texture_progress_bar.cpp:49-59: set_stretch_margin assigns p_size straight through, and
  // ERR_FAIL_INDEX guards only the side index. Each ADD_PROPERTYI at :700-703 hints
  // "0,16384,1,suffix:px" with both ends closed, so both only warn.
  stretch_margin_bottom: v.int('stretch_margin_bottom', {
    min: 0,
    max: 16384,
    hinted: 'texture_progress_bar.cpp:703',
  }),
  stretch_margin_left: v.int('stretch_margin_left', {
    min: 0,
    max: 16384,
    hinted: 'texture_progress_bar.cpp:700',
  }),
  stretch_margin_right: v.int('stretch_margin_right', {
    min: 0,
    max: 16384,
    hinted: 'texture_progress_bar.cpp:702',
  }),
  stretch_margin_top: v.int('stretch_margin_top', {
    min: 0,
    max: 16384,
    hinted: 'texture_progress_bar.cpp:701',
  }),

  // texture_progress_bar.cpp:41-47, 99-105: set_over_texture/set_progress_texture, and
  // set_under_texture (:33-39), delegate to `_set_texture` (texture_progress_bar.cpp:159), which
  // has no type check. PROPERTY_HINT_RESOURCE_TYPE at :706-708 is editor-picker only. Format-only.
  texture_over: v.resourceReference('texture_over'),
  texture_progress: v.resourceReference('texture_progress'),
  texture_under: v.resourceReference('texture_under'),

  // texture_progress_bar.cpp:107-114: set_progress_offset (`texture_progress_offset`)
  // assigns straight through. ADD_PROPERTY at :709 is PROPERTY_HINT_NONE. Format-only.
  texture_progress_offset: v.vector2('texture_progress_offset'),

  // texture_progress_bar.cpp:120-157: set_tint_under/set_tint_progress/set_tint_over assign
  // straight through, and their ADD_PROPERTY calls (:712-714) carry no hint. Format-only.
  tint_over: v.color('tint_over'),
  tint_progress: v.color('tint_progress'),
  tint_under: v.color('tint_under'),
});
