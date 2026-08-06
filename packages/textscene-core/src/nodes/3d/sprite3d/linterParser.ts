/**
 * Sprite3D strict validators for linting.
 *
 * Declare only Sprite3D's OWN members — the ones doc/classes/Sprite3D.xml
 * lists without an `overrides=` attribute, bound in `Sprite3D::_bind_methods`
 * (sprite_3d.cpp:990-1024). `billboard`, `alpha_cut`, `axis`, `pixel_size`,
 * `offset`, `modulate` and `render_priority` are SpriteBase3D's own members
 * (bound in the SEPARATE `SpriteBase3D::_bind_methods`, sprite_3d.cpp:625-710)
 * and now live in `../sprites/shared/linterParser.ts`, reached through the
 * base-walk — re-declaring them here would shadow the tier's rule instead of
 * sharing it with AnimatedSprite3D.
 */

// The tier holding every SpriteBase3D member, which in turn pulls
// GeometryInstance3D/VisualInstance3D/Node3D, so this module answers for
// every key Sprite3D is chained to.
import '../sprites/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Sprite3D', {
  texture: v.resourceReference('texture'),
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
  // set_frame_coords (sprite_3d.cpp:894-895) ERR_FAIL_INDEXes both components
  // against hframes/vframes, the same guard Sprite2D carries. Only the floor is
  // checkable here: the ceiling is a sibling property.
  frame_coords: v.vector2i('frame_coords', { min: 0, enforced: 'sprite_3d.cpp:894' }),
  // set_region_enabled:848-856 is a bare bool assignment; ADD_PROPERTY
  // (sprite_3d.cpp:1019) hints PROPERTY_HINT_GROUP_ENABLE, a pure UI-grouping
  // hint with no value bound. A real gap: previously registered nowhere.
  region_enabled: v.boolean('region_enabled'),
  region_rect: v.rect2('region_rect'),
});
