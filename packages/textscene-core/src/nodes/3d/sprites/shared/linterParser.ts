/**
 * Validators shared by every SpriteBase3D subclass, registered under the abstract key 'SpriteBase3D',
 * which no .tscn instantiates. Sprite3D and AnimatedSprite3D reach it through the NODE_BASE_TYPES
 * base-walk. The members are the ones doc/classes/SpriteBase3D.xml lists, cross-checked against
 * `SpriteBase3D::_bind_methods` (sprite_3d.cpp:625-710), not against the subclasses' own.
 */

import '../../geometryinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import {
  BASE_MATERIAL_ALPHA_ANTIALIASING,
  LABEL_SPRITE_ALPHA_CUT,
  BASE_MATERIAL_TEXTURE_FILTER,
} from '../../../../linter/validators/sharedEnumLabels.js';
import {
  MATERIAL_RENDER_PRIORITY_MIN,
  MATERIAL_RENDER_PRIORITY_MAX,
} from '../../../../godot/index.js';

// sprite_3d.cpp:685 hints only 3 labels ("Disabled,Enabled,Y-Billboard"), and
// set_billboard_mode:597-598 `ERR_FAIL_INDEX(p_mode, 3); // Cannot use BILLBOARD_PARTICLES.` excludes
// the 4th StandardMaterial3D BillboardMode value, so a 0-3 bound would accept a value it refuses.
const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
const AXIS = { 0: 'X_AXIS', 1: 'Y_AXIS', 2: 'Z_AXIS' };

validatorRegistry.registerAll('SpriteBase3D', {
  // set_centered:316-323 is a bare bool assignment, guarded only against a
  // redundant set, so Godot enforces no format beyond "boolean".
  centered: v.boolean('centered'),
  // sprite_3d.cpp:678 hints NONE (suffix:px only); set_offset:329-336 is a
  // bare assignment, so any Vector2 loads and runs.
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  // set_modulate:368-376 is a bare assignment; the ">1.0 overbright unsupported"
  // note is renderer prose, not a setter guard or a hint, so any Color loads.
  modulate: v.color('modulate'),
  // sprite_3d.cpp:682 hints "0.0001,128,0.0000001" (closed, no or_greater); set_pixel_size:397-403 is
  // a bare assignment, guarded only against a redundant set, so both ends warn. The validator
  // carries the numbers, not only the cite, so `pixel_size = 500.0` warns as on the Label3D twin.
  pixel_size: v.float('pixel_size', { min: 0.0001, max: 128, hinted: 'sprite_3d.cpp:682' }),
  // set_axis:410-411, ERR_FAIL_INDEX(p_axis, 3): the setter refuses.
  axis: v.enumInt('axis', 0, 2, AXIS, { enforced: 'sprite_3d.cpp:411' }),
  // set_billboard_mode:597-598, ERR_FAIL_INDEX(p_mode, 3): the setter refuses.
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD, { enforced: 'sprite_3d.cpp:598' }),
  // ADD_PROPERTYI(..., "transparent", ..., set_draw_flag, get_draw_flag,
  // FLAG_TRANSPARENT). set_draw_flag:514-523 ERR_FAIL_INDEXes the FLAG
  // (a compile-time constant baked into the property registration), never the
  // bool value, so the property itself carries no bound.
  transparent: v.boolean('transparent'),
  shaded: v.boolean('shaded'),
  double_sided: v.boolean('double_sided'),
  no_depth_test: v.boolean('no_depth_test'),
  fixed_size: v.boolean('fixed_size'),
  // set_alpha_cut_mode:530-531, ERR_FAIL_INDEX(p_mode, ALPHA_CUT_MAX): the
  // setter refuses.
  alpha_cut: v.enumInt('alpha_cut', 0, 3, LABEL_SPRITE_ALPHA_CUT, { enforced: 'sprite_3d.cpp:531' }),
  // sprite_3d.cpp:692 hints "0,1,0.001" (closed); set_alpha_scissor_threshold:
  // 558-565 is a bare assignment, so out-of-hint is a warning.
  alpha_scissor_threshold: v.float('alpha_scissor_threshold', {
    min: 0,
    max: 1,
    hinted: 'sprite_3d.cpp:692',
  }),
  // sprite_3d.cpp:693 hints "0,2,0.01" (closed); set_alpha_hash_scale:545-552
  // is a bare assignment, so out-of-hint is a warning.
  alpha_hash_scale: v.float('alpha_hash_scale', { min: 0, max: 2, hinted: 'sprite_3d.cpp:693' }),
  // sprite_3d.cpp:694 hints 3 labels (0-2); set_alpha_antialiasing:571-578 is a
  // bare assignment (no ERR_FAIL), so out-of-hint is a warning.
  alpha_antialiasing_mode: v.enumInt('alpha_antialiasing_mode', 0, 2, BASE_MATERIAL_ALPHA_ANTIALIASING, {
    hinted: 'sprite_3d.cpp:694',
  }),
  // sprite_3d.cpp:695 hints "0,1,0.01" (closed); set_alpha_antialiasing_edge:
  // 584-591 is a bare assignment, so out-of-hint is a warning.
  alpha_antialiasing_edge: v.float('alpha_antialiasing_edge', {
    min: 0,
    max: 1,
    hinted: 'sprite_3d.cpp:695',
  }),
  // sprite_3d.cpp:696 hints 6 labels (0-5); set_texture_filter:612-619 is a
  // bare assignment (no ERR_FAIL), so out-of-hint is a warning.
  texture_filter: v.enumInt('texture_filter', 0, 5, BASE_MATERIAL_TEXTURE_FILTER, {
    hinted: 'sprite_3d.cpp:696',
  }),
  // sprite_3d.cpp:697 hints RS::MATERIAL_RENDER_PRIORITY_MIN..MAX (rendering_server.h:258-259,
  // -128..127), closed, and set_render_priority:382-383 `ERR_FAIL_COND(p_priority < MIN || p_priority
  // > MAX)` enforces the same bound, so out of range is an ADR-0032 error. `outline_render_priority`
  // is Label3D's own (label_3d.cpp:147): SpriteBase3D binds no such member.
  render_priority: v.int('render_priority', {
    min: MATERIAL_RENDER_PRIORITY_MIN,
    max: MATERIAL_RENDER_PRIORITY_MAX,
    enforced: 'sprite_3d.cpp:383',
  }),
});
