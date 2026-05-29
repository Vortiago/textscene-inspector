/**
 * SpotLight3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const LIGHT_BAKE_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };

validatorRegistry.registerAll('SpotLight3D', {
  light_energy: v.positiveFloat('light_energy'),
  light_color: v.color('light_color'),
  light_indirect_energy: v.nonNegativeFloat('light_indirect_energy'),
  light_volumetric_fog_energy: v.nonNegativeFloat('light_volumetric_fog_energy'),
  light_negative: v.boolean('light_negative'),
  light_specular: v.float('light_specular', { min: 0, max: 1 }),
  light_bake_mode: v.enumInt('light_bake_mode', 0, 2, LIGHT_BAKE_MODE),
  light_cull_mask: v.int('light_cull_mask', {
    min: 1,
    max: 1048575,
    message:
      "Property 'light_cull_mask' must be between 1 and 1048575. Valid range: bits 1-20",
  }),
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_bias: v.float('shadow_bias'),
  shadow_normal_bias: v.float('shadow_normal_bias'),
  shadow_blur: v.nonNegativeFloat('shadow_blur'),
  shadow_transmittance_bias: v.float('shadow_transmittance_bias', { min: -10, max: 10 }),
  shadow_opacity: v.float('shadow_opacity', { min: 0, max: 1 }),
  shadow_reverse_cull_face: v.boolean('shadow_reverse_cull_face'),
  spot_range: v.positiveFloat('spot_range'),
  spot_attenuation: v.nonNegativeFloat('spot_attenuation'),
  // Custom message keeps the "degrees" qualifier the per-node test asserts.
  spot_angle: v.float('spot_angle', {
    min: 0,
    max: 90,
    message: "Property 'spot_angle' must be between 0 and 90 degrees",
  }),
  spot_angle_attenuation: v.nonNegativeFloat('spot_angle_attenuation'),
});
