/**
 * Sprite3D strict validators: only the members doc/classes/Sprite3D.xml lists without `overrides=`,
 * bound in `Sprite3D::_bind_methods` (sprite_3d.cpp:990-1024). `billboard`, `alpha_cut`, `axis`,
 * `pixel_size`, `offset`, `modulate` and `render_priority` belong to `SpriteBase3D::_bind_methods`
 * (sprite_3d.cpp:625-710) and the shared tier.
 */

// The tier holding every SpriteBase3D member, shared with AnimatedSprite3D, which pulls
// GeometryInstance3D (owner of `transparency`), VisualInstance3D and Node3D. Re-declaring one of
// its keys here would shadow the tier's rule.
import '../sprites/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Sprite3D', {
  texture: v.resourceReference('texture'),
  // sprite_3d.cpp:1014/:1015 hint "1,16384,1", closed at both ends. set_hframes/set_vframes
  // (:924/:905) refuse a value below 1 through ERR_FAIL_COND_MSG, and nothing enforces the 16384
  // ceiling, so it warns. Same numbers as Sprite2D (sprite_2d.cpp:543-544).
  hframes: v.int('hframes', {
    // `int`, not `strictInt`: a float literal in this Variant::INT slot is truncated on assignment
    // (variant_parser.cpp:446-448), so `hframes = 5.5` is a file Godot opens, not a format error.
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_3d.cpp:924' },
    hinted: { max: 'sprite_3d.cpp:1014' },
  }),
  vframes: v.int('vframes', {
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_3d.cpp:905' },
    hinted: { max: 'sprite_3d.cpp:1015' },
  }),
  // Sprite3D::set_frame:877-879, ERR_FAIL_INDEX(p_frame, int64_t(vframes) * hframes): the floor (0)
  // is enforced, since a negative index fails the same unsigned check. The ceiling depends on
  // hframes and vframes at that point in file order, so no static bound can check it.
  frame: v.int('frame', { min: 0, enforced: 'sprite_3d.cpp:878' }),
  // set_frame_coords (sprite_3d.cpp:894-895) ERR_FAIL_INDEXes both components
  // against hframes/vframes, the same guard Sprite2D carries. Only the floor is
  // checkable here: the ceiling is a sibling property.
  frame_coords: v.vector2i('frame_coords', { min: 0, enforced: 'sprite_3d.cpp:894' }),
  // set_region_enabled:848-856 is a bare bool assignment; ADD_PROPERTY
  // (sprite_3d.cpp:1019) hints PROPERTY_HINT_GROUP_ENABLE, a pure UI-grouping
  // hint with no value bound.
  region_enabled: v.boolean('region_enabled'),
  region_rect: v.rect2('region_rect'),
});
