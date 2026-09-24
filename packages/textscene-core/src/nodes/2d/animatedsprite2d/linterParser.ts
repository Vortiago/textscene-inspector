/** AnimatedSprite2D strict validators for linting. */

// The base chain: registration happens on import, so a test that loads only this
// slice resolves an inherited key only through this line.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';


validatorRegistry.registerAll('AnimatedSprite2D', {
  // `frames`, the pre-4.0 spelling, reaches the same slot: `_set` hands it to
  // `set_sprite_frames` (animated_sprite_2d.cpp:616-618, `#ifndef DISABLE_DEPRECATED`).
  sprite_frames: v.resourceReference('sprite_frames'),
  // Both are `Variant::STRING_NAME` (animated_sprite_2d.cpp:672-673), but the getter
  // decides the spelling: `get_animation()` (animated_sprite_2d.h:101) writes `&"name"`,
  // `get_autoplay()` (:104) writes `"name"`, as in the 3D twin (sprite_3d.cpp:1540-1541).
  // The enum hint comes from the live SpriteFrames, so only the literal's shape is checked.
  animation: v.stringName('animation'),
  // animated_sprite_2d.cpp:674 carries no hint. With no SpriteFrames,
  // set_frame_and_progress writes nothing (animated_sprite_2d.cpp:360-362), and
  // with one its negative arm assigns 0 (:368-369). That empty slot drops every
  // frame, which needs the sibling key, so `linter.ts` owns that half.
  frame: v.strictNonNegativeInt('frame', { enforced: 'animated_sprite_2d.cpp:360-369' }),
  speed_scale: v.float('speed_scale'),
  centered: v.boolean('centered'),
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  frame_progress: v.float('frame_progress'),
  autoplay: v.stringName('autoplay'),
});

// No ADD_PROPERTY declares it (animated_sprite_2d.cpp:671-681), and the
// DISABLE_DEPRECATED `_set` has one arm, `frames` (:615-622), so the write is
// dropped. `is_playing` is only a method binding (:634). With no entry at all,
// `playing = true` would be silently accepted.
validatorRegistry.registerUnavailable('AnimatedSprite2D', {
  playing: {
    reason: `it is a method, not a property — playback is started with play(), and only 'autoplay' is serialised`,
    cite: 'animated_sprite_2d.cpp:615-622',
  },
});
