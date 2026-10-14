/**
 * NoiseTexture3D property validation (`modules/noise/noise_texture_3d.cpp:76-84`). The size hints
 * are open above 2048, and the setters refuse an axis below 1 (`:236`, `:245`, `:254`).
 * `set_seamless_blend_skirt` refuses a skirt outside 0.05 to 1 (`:288`).
 */

// Registers Resource, so the inherited keys resolve when this module loads alone.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NoiseTexture3D', {
  width: v.int('width', { min: 1, enforced: 'noise_texture_3d.cpp:236' }),
  height: v.int('height', { min: 1, enforced: 'noise_texture_3d.cpp:245' }),
  depth: v.int('depth', { min: 1, enforced: 'noise_texture_3d.cpp:254' }),
  invert: v.boolean('invert'),
  seamless: v.boolean('seamless'),
  seamless_blend_skirt: v.float('seamless_blend_skirt', {
    min: 0.05,
    max: 1,
    enforced: 'noise_texture_3d.cpp:288',
  }),
  normalize: v.boolean('normalize'),
  noise: v.resourceReference('noise'),
  color_ramp: v.resourceReference('color_ramp'),
});
