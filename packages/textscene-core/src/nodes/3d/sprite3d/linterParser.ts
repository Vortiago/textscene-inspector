/**
 * Sprite3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// The immediate validator-bearing base, which pulls VisualInstance3D and Node3D
// in turn, so this module answers for every key Sprite3D is chained to.
import '../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// sprite_3d.cpp:685 hints only 3 labels ("Disabled,Enabled,Y-Billboard"), and
// set_billboard_mode:597-598 `ERR_FAIL_INDEX(p_mode, 3); // Cannot use
// BILLBOARD_PARTICLES.` explicitly excludes the 4th StandardMaterial3D
// BillboardMode value — the previous 0-3 bound accepted a value Godot's own
// setter refuses.
const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
// sprite_3d.cpp:691 hints 4 labels ("Disabled,Discard,Opaque Pre-Pass,Alpha
// Hash") and ALPHA_CUT_MAX is 4 (sprite_3d.h:52-57), so ALPHA_CUT_HASH=3 is a
// real, editor-reachable value the previous 0-2 bound rejected.
const ALPHA_CUT = { 0: 'DISABLED', 1: 'DISCARD', 2: 'OPAQUE_PREPASS', 3: 'HASH' };
const AXIS = { 0: 'X_AXIS', 1: 'Y_AXIS', 2: 'Z_AXIS' };

validatorRegistry.registerAll('Sprite3D', {
  texture: v.resourceReference('texture'),
  // set_billboard_mode:597-598, ERR_FAIL_INDEX(p_mode, 3): the setter refuses.
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD, { enforced: 'sprite_3d.cpp:598' }),
  // set_alpha_cut_mode:530-531, ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX): the
  // setter refuses.
  alpha_cut: v.enumInt('alpha_cut', 0, 3, ALPHA_CUT, { enforced: 'sprite_3d.cpp:531' }),
  // set_axis:410-411, ERR_FAIL_INDEX(p_axis, 3): the setter refuses.
  axis: v.enumInt('axis', 0, 2, AXIS, { enforced: 'sprite_3d.cpp:411' }),
  // sprite_3d.cpp:682 hints "0.0001,128,0.0000001" (closed, no or_greater);
  // set_pixel_size:397-403 is a bare assignment (only guarded against a
  // redundant set), so out-of-hint is a warning, not an error.
  pixel_size: v.positiveFloat('pixel_size', undefined, { hinted: 'sprite_3d.cpp:682' }),
  // `transparency` is GeometryInstance3D's and arrives via the base-walk.
  // set_hframes/set_vframes (sprite_3d.cpp:923-926/904-907)
  // ERR_FAIL_COND_MSG below 1: the setter refuses.
  hframes: v.positiveInt('hframes', undefined, { enforced: 'sprite_3d.cpp:924' }),
  vframes: v.positiveInt('vframes', undefined, { enforced: 'sprite_3d.cpp:905' }),
  // Sprite3D::set_frame:877-879, ERR_FAIL_INDEX(p_frame, int64_t(vframes) *
  // hframes): the floor (0) is enforced (a negative index fails the same
  // unsigned bounds check), but the ceiling depends on hframes/vframes as set
  // at that point in file order, so it is not a static bound this validator
  // can check.
  frame: v.int('frame', { min: 0, enforced: 'sprite_3d.cpp:878' }),
  offset: v.vector2('offset'),
  // set_frame_coords (sprite_3d.cpp:894-895) ERR_FAIL_INDEXes both components
  // against hframes/vframes, the same guard Sprite2D carries. Only the floor is
  // checkable here: the ceiling is a sibling property.
  frame_coords: v.vector2i('frame_coords', { min: 0, enforced: 'sprite_3d.cpp:894' }),
  region_rect: v.rect2('region_rect'),
  modulate: v.color('modulate'),
  // sprite_3d.cpp:697 hints RS::MATERIAL_RENDER_PRIORITY_MIN..MAX (-128..127)
  // and set_render_priority:382-383 ERR_FAIL_COND enforces that range, but
  // this validator carries no bound at all today — a gap the audit found,
  // out of scope for this pass since it needs a new bound, not a grounding.
  render_priority: v.int('render_priority'),
});
