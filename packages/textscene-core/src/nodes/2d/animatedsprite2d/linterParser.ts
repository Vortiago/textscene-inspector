/**
 * AnimatedSprite2D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * `animation` and `autoplay` take any string value (semantic validation
 * happens in the linter pass). The original validator was a no-op
 * type-check on a string-typed `value` arg, so we keep the same
 * behaviour with a passthrough validator.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';


/**
 * Accepts anything: the property is recognised as valid on this node but has
 * no format Godot enforces, so there is nothing to check.
 */
const anyValue: PropertyValidator = () => null;
anyValue.accepts = 'any value (no format constraint)';
validatorRegistry.registerAll('AnimatedSprite2D', {
  sprite_frames: v.resourceReference('sprite_frames'),
  animation: anyValue,
  frame: v.strictNonNegativeInt('frame'),
  speed_scale: v.float('speed_scale'),
  centered: v.boolean('centered'),
  offset: v.vector2('offset'),
  flip_h: v.boolean('flip_h'),
  flip_v: v.boolean('flip_v'),
  frame_progress: v.float('frame_progress'),
  autoplay: anyValue,
  playing: v.boolean('playing'),
});
