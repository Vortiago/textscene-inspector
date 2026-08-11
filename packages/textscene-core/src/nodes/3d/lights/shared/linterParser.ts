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
  // light_3d.cpp:393, PROPERTY_HINT_RESOURCE_TYPE
  // "Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,
  // -MeshTexture,-Texture2DRD,-ViewportTexture". The excluded subclasses are a
  // DEBUG_ENABLED WARN_PRINT in set_projector (light_3d.cpp:212), not a refusal,
  // so this is a format check like every other Texture2D reference property.
  // No PROPERTY_USAGE_STORE_IF_NULL (object.h:113) on this ADD_PROPERTY, unlike
  // GraphNode's slot icons, so a cleared projector is OMITTED, never written as
  // `null` — resourceReference, not resourceReference.
  light_projector: v.resourceReference('light_projector'),
  // light_3d.cpp:394, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m".
  light_size: v.nonNegativeFloat('light_size', { hinted: 'light_3d.cpp:394' }),
  // light_3d.cpp:395, PROPERTY_HINT_RANGE "0,90,0.01,degrees" — both ends
  // closed. The bare "degrees" token is a display-only suffix, distinct from
  // "radians_as_degrees", so the stored value is degrees already and the
  // hint bound applies unconverted (no v.radians here).
  light_angular_distance: v.float('light_angular_distance', {
    min: 0,
    max: 90,
    hinted: 'light_3d.cpp:395',
  }),
  // light_3d.cpp:385, PROPERTY_HINT_RANGE "0,100000.0,0.01,or_greater,suffix:lm".
  // Same set_param:36 index-only guard as light_energy, so a negative reading
  // is a warning.
  light_intensity_lumens: v.nonNegativeFloat('light_intensity_lumens', {
    hinted: 'light_3d.cpp:385',
  }),
  // light_3d.cpp:386, PROPERTY_HINT_RANGE "0,150000.0,0.01,or_greater,suffix:lx".
  light_intensity_lux: v.nonNegativeFloat('light_intensity_lux', {
    hinted: 'light_3d.cpp:386',
  }),
  // light_3d.cpp:387, PROPERTY_HINT_RANGE "1000,15000.0,1.0,suffix:k": both
  // ends closed, no or_greater/or_less. set_temperature (light_3d.cpp:257) is
  // a bare assignment (no clamp, no ERR_FAIL), so out-of-hint is a warning.
  light_temperature: v.float('light_temperature', {
    min: 1000,
    max: 15000,
    hinted: 'light_3d.cpp:387',
  }),
  shadow_enabled: v.boolean('shadow_enabled'),
  // light_3d.cpp:403, PROPERTY_HINT_RANGE "0,10,0.001": both ends closed, no
  // or_greater/or_less. set_param:36 guards the param index, not the value,
  // so out-of-hint is a warning.
  shadow_bias: v.float('shadow_bias', { min: 0, max: 10, hinted: 'light_3d.cpp:403' }),
  // light_3d.cpp:404, same "0,10,0.001" shape as shadow_bias.
  shadow_normal_bias: v.float('shadow_normal_bias', {
    min: 0,
    max: 10,
    hinted: 'light_3d.cpp:404',
  }),
  // light_3d.cpp:408, same "0,10,0.001" shape as shadow_bias.
  shadow_blur: v.float('shadow_blur', { min: 0, max: 10, hinted: 'light_3d.cpp:408' }),
  // light_3d.cpp:409, PROPERTY_HINT_LAYERS_3D_RENDER. set_shadow_caster_mask
  // (light_3d.cpp:148) is a bare assignment, so out-of-widget is a warning.
  shadow_caster_mask: layerBitmask('shadow_caster_mask', { hinted: 'light_3d.cpp:409' }),
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
  // light_3d.cpp:412, PROPERTY_HINT_GROUP_ENABLE — a checkable-group marker
  // for the inspector, not a value constraint (object.h:93).
  distance_fade_enabled: v.boolean('distance_fade_enabled'),
  // light_3d.cpp:413, PROPERTY_HINT_RANGE "0.0,4096.0,0.01,or_greater,suffix:m".
  // set_distance_fade_begin (light_3d.cpp:85) is a bare assignment.
  distance_fade_begin: v.nonNegativeFloat('distance_fade_begin', {
    hinted: 'light_3d.cpp:413',
  }),
  // light_3d.cpp:414, same hint shape as distance_fade_begin.
  // set_distance_fade_shadow (light_3d.cpp:94) is a bare assignment.
  distance_fade_shadow: v.nonNegativeFloat('distance_fade_shadow', {
    hinted: 'light_3d.cpp:414',
  }),
  // light_3d.cpp:415, same hint shape as distance_fade_begin.
  // set_distance_fade_length (light_3d.cpp:103) is a bare assignment.
  distance_fade_length: v.nonNegativeFloat('distance_fade_length', {
    hinted: 'light_3d.cpp:415',
  }),
  // light_3d.cpp:418, PROPERTY_HINT_NONE (no hint at all). set_editor_only
  // (light_3d.cpp:315) is a bare assignment, so this is a format-only bool.
  editor_only: v.boolean('editor_only'),
});
