/**
 * TextureProgressBar strict validators for linting.
 *
 * Declare only TextureProgressBar's OWN members — the ones doc/classes/TextureProgressBar.xml
 * lists without an `overrides=` attribute. Everything from Range up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Skipped as inherited-override, not own members: `mouse_filter` and
 * `size_flags_vertical` both carry `overrides="Control"` in the XML, and
 * `step` carries `overrides="Range"` — all three already have validators on
 * their owning ancestor.
 *
 * `_validate_property` (texture_progress_bar.cpp:638-649) hides the
 * `stretch_margin_*` keys when `nine_patch_stretch` is false and the
 * `radial_*` keys when `fill_mode` is not one of the three radial modes, but
 * only by setting `PROPERTY_USAGE_NO_EDITOR`, which equals
 * `PROPERTY_USAGE_STORAGE` alone (core/object/object.h:132) — the property
 * stays serialised, it is only hidden from the editor's Inspector panel. A
 * `.tscn` can legally carry any of them regardless of the other properties'
 * values, so every one below gets a validator unconditionally.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// texture_progress_bar.h:48-59 — enum FillMode, 9 values; BIND_ENUM_CONSTANT at
// texture_progress_bar.cpp:716-724. Labels from the ADD_PROPERTY hint string at
// texture_progress_bar.cpp:691.
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
  // texture_progress_bar.cpp:576 — set_fill_mode: `ERR_FAIL_INDEX(p_fill,
  // FILL_MODE_MAX)` refuses the write outright, so out-of-range is an error.
  fill_mode: v.enumInt('fill_mode', 0, 8, FILL_MODE, { enforced: 'texture_progress_bar.cpp:576' }),

  // texture_progress_bar.cpp:66-75 — set_nine_patch_stretch assigns straight
  // through (only an early-return on a redundant set); ADD_PROPERTY at :698
  // carries no hint. Format-only.
  nine_patch_stretch: v.boolean('nine_patch_stretch'),

  // texture_progress_bar.cpp:625-632 — set_radial_center_offset assigns
  // straight through; ADD_PROPERTY at :695 is PROPERTY_HINT_NONE (the
  // "suffix:px" is a display suffix, not a bound). Format-only.
  radial_center_offset: v.vector2('radial_center_offset'),

  // texture_progress_bar.cpp:610-619 — set_fill_degrees:
  // `CLAMP(p_angle, 0, 360)` alters an out-of-range value rather than
  // rejecting it, which is still enforcement (ADR-0032). The stored value is
  // plain degrees — rad_max_degrees is divided straight by 360 at
  // texture_progress_bar.cpp:483, with no deg-to-rad conversion anywhere —
  // so this is `v.float` in degree units, not `v.radians`.
  radial_fill_degrees: v.float('radial_fill_degrees', {
    min: 0,
    max: 360,
    enforced: 'texture_progress_bar.cpp:611',
  }),

  // texture_progress_bar.cpp:591-604 — set_radial_initial_angle wraps a value
  // outside [0, 360] with `Math::fposmodp` rather than rejecting it: still an
  // alteration, so still enforcement. Same degrees-not-radians storage as
  // radial_fill_degrees (rad_init_angle / 360 at texture_progress_bar.cpp:494).
  // The same setter opens with ERR_FAIL_COND_MSG(!Math::is_finite) at
  // texture_progress_bar.cpp:592, a separate guard from the wrap below. The
  // range alone would not cover it: `inf` happens to exceed 360, but every
  // comparison against `nan` is false, so it would pass unreported.
  radial_initial_angle: v.float('radial_initial_angle', {
    min: 0,
    max: 360,
    enforced: 'texture_progress_bar.cpp:594',
    finite: 'texture_progress_bar.cpp:592',
  }),

  // texture_progress_bar.cpp:49-59 — set_stretch_margin assigns p_size
  // straight through; only the SIDE index is ERR_FAIL_INDEX-guarded (a bound
  // on which of the four properties is being set, not on the value any one of
  // them carries). Each ADD_PROPERTYI at :700-703 hints "0,16384,1,suffix:px"
  // with no or_greater/or_less, so both ends are closed and merely hinted.
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

  // texture_progress_bar.cpp:41-47, 99-105 — set_over_texture/set_progress_texture
  // (set_under_texture, :33-39, likewise) all delegate to the same
  // `_set_texture` (texture_progress_bar.cpp:159), which assigns straight
  // through with no type check of its own; PROPERTY_HINT_RESOURCE_TYPE at
  // :706-708 only restricts the editor's resource picker. Format-only.
  texture_over: v.resourceReference('texture_over'),
  texture_progress: v.resourceReference('texture_progress'),
  texture_under: v.resourceReference('texture_under'),

  // texture_progress_bar.cpp:107-114 — set_progress_offset (bound to the
  // `texture_progress_offset` property) assigns straight through; ADD_PROPERTY
  // at :709 is PROPERTY_HINT_NONE. Format-only.
  texture_progress_offset: v.vector2('texture_progress_offset'),

  // texture_progress_bar.cpp:120-157 — set_tint_under/set_tint_progress/
  // set_tint_over each assign straight through (only an early-return on a
  // redundant set); none of their ADD_PROPERTY calls (:712-714) carries a
  // hint. Format-only.
  tint_over: v.color('tint_over'),
  tint_progress: v.color('tint_progress'),
  tint_under: v.color('tint_under'),
});
