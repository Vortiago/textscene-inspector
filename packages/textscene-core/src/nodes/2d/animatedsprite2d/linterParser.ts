/**
 * AnimatedSprite2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `animation` and `autoplay` take any string value (semantic validation
 * happens in the linter pass). The original validator was a no-op
 * type-check on a string-typed `value` arg, so we keep the same
 * behaviour with a passthrough validator.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';


validatorRegistry.registerAll('AnimatedSprite2D', {
  sprite_frames: v.resourceReference('sprite_frames'),
  animation: v.any(),
  frame: v.strictNonNegativeInt('frame'),
  speed_scale: v.float('speed_scale'),
  centered: v.boolean('centered'),
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  frame_progress: v.float('frame_progress'),
  autoplay: v.any(),
  playing: v.boolean('playing'),
});
