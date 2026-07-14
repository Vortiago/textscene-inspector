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
  hframes: v.positiveInt('hframes'),
  vframes: v.positiveInt('vframes'),
  frame: v.strictNonNegativeInt('frame'),
  // `vector2i(_, true)` rejects negative components. The default-message
  // legacy wording "must have non-negative values" is what tests assert,
  // matching the underlying `createVector2iValidator` output.
  frame_coords: v.vector2i('frame_coords', true),
});
