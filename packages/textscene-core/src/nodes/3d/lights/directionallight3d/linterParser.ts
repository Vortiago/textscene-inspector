/**
 * DirectionalLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const DIRECTIONAL_SHADOW_MODE = {
  0: 'ORTHOGONAL',
  1: 'PARALLEL_2_SPLITS',
  2: 'PARALLEL_4_SPLITS',
};

const LIGHT_BAKE_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };

const SKY_MODE = { 0: 'LIGHT_AND_SKY', 1: 'LIGHT_ONLY', 2: 'SKY_ONLY' };

validatorRegistry.registerAll('DirectionalLight3D', {
  light_energy: v.positiveFloat('light_energy'),
  light_color: v.color('light_color'),
  light_indirect_energy: v.nonNegativeFloat('light_indirect_energy'),
  light_volumetric_fog_energy: v.nonNegativeFloat('light_volumetric_fog_energy'),
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_bias: v.float('shadow_bias'),
  shadow_normal_bias: v.float('shadow_normal_bias'),
  shadow_blur: v.nonNegativeFloat('shadow_blur'),
  shadow_transmittance_bias: v.float('shadow_transmittance_bias', { min: -10, max: 10 }),
  shadow_opacity: v.float('shadow_opacity', { min: 0, max: 1 }),
  shadow_reverse_cull_face: v.boolean('shadow_reverse_cull_face'),
  directional_shadow_mode: v.enumInt(
    'directional_shadow_mode',
    0,
    2,
    DIRECTIONAL_SHADOW_MODE
  ),
  directional_shadow_split_1: v.float('directional_shadow_split_1', { min: 0, max: 1 }),
  directional_shadow_split_2: v.float('directional_shadow_split_2', { min: 0, max: 1 }),
  directional_shadow_split_3: v.float('directional_shadow_split_3', { min: 0, max: 1 }),
  directional_shadow_fade_start: v.float('directional_shadow_fade_start', {
    min: 0,
    max: 1,
  }),
  directional_shadow_max_distance: v.nonNegativeFloat('directional_shadow_max_distance'),
  directional_shadow_pancake_size: v.nonNegativeFloat('directional_shadow_pancake_size'),
  directional_shadow_blend_splits: v.boolean('directional_shadow_blend_splits'),
  light_negative: v.boolean('light_negative'),
  light_specular: v.float('light_specular', { min: 0, max: 1 }),
  light_bake_mode: v.enumInt('light_bake_mode', 0, 2, LIGHT_BAKE_MODE),
  light_cull_mask: v.int('light_cull_mask', {
    min: 1,
    max: 1048575,
    message:
      "Property 'light_cull_mask' must be between 1 and 1048575. Valid range: bits 1-20",
  }),
  sky_mode: v.enumInt('sky_mode', 0, 2, SKY_MODE),
});
