/**
 * Sprite2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Sprite2D', {
  texture: v.resourceReference('texture'),
  centered: v.boolean('centered'),
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  region_enabled: v.boolean('region_enabled'),
  region_rect: v.rect2('region_rect'),
  // sprite_2d.cpp:551, BOOL, no hint. set_region_filter_clip_enabled
  // (sprite_2d.cpp:282-289) has an early equality-return guard, then a bare
  // assignment: format-only.
  region_filter_clip_enabled: v.boolean('region_filter_clip_enabled'),
  // sprite_2d.cpp:543 hints "1,16384,1", closed both ends. set_hframes
  // (sprite_2d.cpp:344) ERR_FAIL_COND_MSGs below 1, and the ceiling is hint-only.
  // The Sprite3D twin (sprite_3d.cpp:924/:1014) reads the identical hint.
  hframes: v.int('hframes', {
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_2d.cpp:344' },
    hinted: { max: 'sprite_2d.cpp:543' },
  }),
  // sprite_2d.cpp:544, same shape as hframes: set_vframes (sprite_2d.cpp:323)
  // ERR_FAIL_COND_MSGs below 1, the 16384 ceiling is hint-only.
  vframes: v.int('vframes', {
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_2d.cpp:323' },
    hinted: { max: 'sprite_2d.cpp:544' },
  }),
  // sprite_2d.cpp:545 carries no hint. set_frame (sprite_2d.cpp:296)
  // ERR_FAIL_INDEXes against `vframes * hframes` as set at that point in file
  // order, a cross-property bound `linter.ts` owns. Only the floor is checked here.
  frame: v.int('frame', { min: 0, enforced: 'sprite_2d.cpp:296' }),
  // set_frame_coords (sprite_2d.cpp:312-313) ERR_FAIL_INDEXes both components
  // against hframes/vframes, which fails below 0 as well as at/above the frame
  // count. Only the floor is checkable here: the ceiling is a sibling property.
  frame_coords: v.vector2i('frame_coords', { min: 0, enforced: 'sprite_2d.cpp:312' }),
});
