/**
 * AnimatedSprite2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `animation` and `autoplay` take any string value (semantic validation
 * happens in the linter pass). The original validator was a no-op
 * type-check on a string-typed `value` arg, so we keep the same
 * behaviour with a passthrough validator.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';


validatorRegistry.registerAll('AnimatedSprite2D', {
  sprite_frames: v.resourceReference('sprite_frames'),
  animation: v.any(),
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
  autoplay: v.any(),
  playing: v.boolean('playing'),
});
