/**
 * Sprite2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

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
  // sprite_2d.cpp:543 hints "1,16384,1" — no or_greater/or_less, hard both ends.
  // set_hframes (sprite_2d.cpp:323) ERR_FAIL_COND_MSGs below 1; the ceiling is
  // hint-only, never setter-enforced. `strictInt` (not `int`) because only it
  // wires a per-end severity through to the underlying validator.
  hframes: v.strictInt('hframes', {
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_2d.cpp:323' },
    hinted: { max: 'sprite_2d.cpp:543' },
  }),
  // sprite_2d.cpp:544, same shape as hframes: set_vframes (sprite_2d.cpp:344)
  // ERR_FAIL_COND_MSGs below 1, the 16384 ceiling is hint-only.
  vframes: v.strictInt('vframes', {
    min: 1,
    max: 16384,
    enforced: { min: 'sprite_2d.cpp:344' },
    hinted: { max: 'sprite_2d.cpp:544' },
  }),
  // sprite_2d.cpp:545 carries no hint at all; set_frame (sprite_2d.cpp:296)
  // ERR_FAIL_INDEXes against `vframes * hframes`, a cross-property bound this
  // per-property validator can't see, so only the >=0 floor is checked here.
  frame: v.strictNonNegativeInt('frame', { enforced: 'sprite_2d.cpp:296' }),
  // `vector2i(_, true)` rejects negative components. The default-message
  // legacy wording "must have non-negative values" is what tests assert,
  // matching the underlying `createVector2iValidator` output. Not groundable
  // via the `v` DSL (vector2i takes no Grounding), but set_frame_coords
  // (sprite_2d.cpp:312-313) does ERR_FAIL_INDEX both components against
  // hframes/vframes, so the >=0 floor checked here is real engine enforcement.
  frame_coords: v.vector2i('frame_coords', true),
});
