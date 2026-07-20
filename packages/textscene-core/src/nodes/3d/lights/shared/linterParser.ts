/**
 * Validators shared by every Light3D-derived node (SpotLight3D / OmniLight3D /
 * DirectionalLight3D / AreaLight3D): the `light_*` and `shadow_*` properties
 * from the Light3D base class. Registered under the abstract key `'Light3D'`
 * so the base-walk in ValidatorRegistry delivers them to every concrete light
 * subclass automatically. Each light's `index.linter.ts` imports this module
 * for its side-effect registration.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

const LIGHT_BAKE_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };

validatorRegistry.registerAll('Light3D', {
  light_energy: v.nonNegativeFloat('light_energy'),
  light_color: v.color('light_color'),
  light_indirect_energy: v.nonNegativeFloat('light_indirect_energy'),
  light_volumetric_fog_energy: v.nonNegativeFloat('light_volumetric_fog_energy'),
  light_negative: v.boolean('light_negative'),
  light_specular: v.float('light_specular', { min: 0, max: 1 }),
  light_bake_mode: v.enumInt('light_bake_mode', 0, 2, LIGHT_BAKE_MODE),
  light_cull_mask: layerBitmask('light_cull_mask'),
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_bias: v.float('shadow_bias'),
  shadow_normal_bias: v.float('shadow_normal_bias'),
  shadow_blur: v.nonNegativeFloat('shadow_blur'),
  shadow_transmittance_bias: v.float('shadow_transmittance_bias', { min: -10, max: 10 }),
  shadow_opacity: v.float('shadow_opacity', { min: 0, max: 1 }),
  shadow_reverse_cull_face: v.boolean('shadow_reverse_cull_face'),
});
