/**
 * AnimatedSprite2D strict validators for linting.
 *
 * `animation` and `autoplay` are both declared `Variant::STRING_NAME`
 * (animated_sprite_2d.cpp:672-673), and the GETTER decides which spelling Godot
 * writes: `StringName get_animation()` (animated_sprite_2d.h:101) emits
 * `&"name"`, `String get_autoplay()` (:104) emits `"name"`. `v.stringName`
 * takes either, which is what the AnimatedSprite3D twin registers for the
 * identical pair (sprite_3d.cpp:1540-1541).
 *
 * `animation`'s `PROPERTY_HINT_ENUM` list is filled from the live SpriteFrames
 * by `_validate_property`, so there is no closed set of names a static linter
 * can check against — only the literal's shape.
 *
 * `frames` is the pre-4.0 spelling of `sprite_frames`: `_set`
 * (animated_sprite_2d.cpp:616-618, `#ifndef DISABLE_DEPRECATED`) hands
 * `p_value` straight to `set_sprite_frames`, so the slot takes exactly the same
 * literals. Registered under the DEPRECATED name so the diagnostic quotes the
 * key the scene carries.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';


validatorRegistry.registerAll('AnimatedSprite2D', {
  sprite_frames: v.resourceReference('sprite_frames'),
  animation: v.stringName('animation'),
  // animated_sprite_2d.cpp:674 carries no hint at all; set_frame_and_progress
  // (animated_sprite_2d.cpp:368-369) clamps a negative frame to 0, which
  // `enforced` treats the same as an ERR_FAIL (a silently-corrected write).
  frame: v.strictNonNegativeInt('frame', { enforced: 'animated_sprite_2d.cpp:368' }),
  speed_scale: v.float('speed_scale'),
  centered: v.boolean('centered'),
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  frame_progress: v.float('frame_progress'),
  autoplay: v.stringName('autoplay'),

  // -- Pre-4.0 spelling (animated_sprite_2d.cpp:616-618) ----------------------
  // A pure rename onto set_sprite_frames, so the same reference formats.
  frames: v.resourceReference('frames'),
});

// `is_playing` is bound as a METHOD (animated_sprite_2d.cpp:634) and nothing in
// the ADD_PROPERTY block (:671-681) declares it, so the key never appears in a
// property list and `_setv` drops the write. Registered rather than deleted:
// with no entry at all `playing = true` is silently accepted.
validatorRegistry.registerUnavailable('AnimatedSprite2D', {
  playing: {
    reason: `it is a method, not a property — playback is started with play(), and only 'autoplay' is serialised`,
    cite: 'animated_sprite_2d.cpp:634',
  },
});
