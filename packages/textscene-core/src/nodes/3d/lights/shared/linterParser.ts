/**
 * Validators shared by every Light3D-derived node (SpotLight3D / OmniLight3D /
 * DirectionalLight3D / AreaLight3D): the `light_*` and `shadow_*` properties
 * from the Light3D base class. Registered under the abstract key `'Light3D'`
 * so the base-walk in ValidatorRegistry delivers them to every concrete light
 * subclass automatically. Each light's `index.linter.ts` imports this module
 * for its side-effect registration.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

const LIGHT_BAKE_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };

validatorRegistry.registerAll('Light3D', {
  // light_3d.cpp:389, PROPERTY_HINT_RANGE "0,16,0.001,or_greater". A hint is not
  // enforcement — Light3D::set_param:36 guards the param INDEX, not the value —
  // so a negative energy loads and runs. The advisory is the light's
  // `<prefix>-negative-energy` warning, not an error here.
  light_energy: v.float('light_energy'),
  light_color: v.color('light_color'),
  light_indirect_energy: v.nonNegativeFloat('light_indirect_energy', {
    hinted: 'light_3d.cpp:390',
  }),
  light_volumetric_fog_energy: v.nonNegativeFloat('light_volumetric_fog_energy', {
    hinted: 'light_3d.cpp:391',
  }),
  light_negative: v.boolean('light_negative'),
  // light_3d.cpp:397, PROPERTY_HINT_RANGE "0,16,0.001,or_greater": the previous
  // 0-1 bound was invented, not read from the hint, and rejected a legal
  // stylised value like 2.0. `or_greater` softens the 16, so only the 0 floor
  // is a bound at all, and Light3D::set_param:36 (the same index-only guard as
  // light_energy) means even that floor is a warning, not an error.
  light_specular: v.nonNegativeFloat('light_specular', { hinted: 'light_3d.cpp:397' }),
  light_bake_mode: v.enumInt('light_bake_mode', 0, 2, LIGHT_BAKE_MODE, {
    hinted: 'light_3d.cpp:398',
  }),
  light_cull_mask: layerBitmask('light_cull_mask', { hinted: 'light_3d.cpp:399' }),
  shadow_enabled: v.boolean('shadow_enabled'),
  shadow_bias: v.float('shadow_bias'),
  shadow_normal_bias: v.float('shadow_normal_bias'),
  shadow_blur: v.nonNegativeFloat('shadow_blur', { hinted: 'light_3d.cpp:408' }),
  // light_3d.cpp:406, PROPERTY_HINT_RANGE "-16,16,0.001": both ends closed, no
  // or_greater/or_less. The previous ±10 bound was narrower than the hint and
  // rejected a legal ±16 value; Light3D::set_param:36 still only guards the
  // param index, so this stays a warning rather than an error.
  shadow_transmittance_bias: v.float('shadow_transmittance_bias', {
    min: -16,
    max: 16,
    hinted: 'light_3d.cpp:406',
  }),
  shadow_opacity: v.float('shadow_opacity', { min: 0, max: 1, hinted: 'light_3d.cpp:407' }),
  shadow_reverse_cull_face: v.boolean('shadow_reverse_cull_face'),
});
