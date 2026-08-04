/**
 * Strict parser validation for StandardMaterial3D SubResource properties,
 * entirely through the shared `v` combinators.
 *
 * Format and basic constraints only. Full semantic validation (e.g.
 * `normal_enabled = true` requires a `normal_texture`) needs the linter to walk
 * SubResources rather than just nodes, which it does not yet do.
 *
 * Every entry names its own property, so each emits an `INVALID_<PROPERTY>_*`
 * code rather than one generic code shared across unrelated properties.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// Register validators for StandardMaterial3D properties
validatorRegistry.registerAll('StandardMaterial3D', {
  normal_enabled: v.boolean('normal_enabled'),
  emission_enabled: v.boolean('emission_enabled'),
  clearcoat_enabled: v.boolean('clearcoat_enabled'),
  rim_enabled: v.boolean('rim_enabled'),
  heightmap_enabled: v.boolean('heightmap_enabled'),
  anisotropy_enabled: v.boolean('anisotropy_enabled'),
  refraction_enabled: v.boolean('refraction_enabled'),

  // A texture slot takes an `ExtResource` (imported image / `.tres`) OR a
  // `SubResource` (an inline/procedural Texture2D — GradientTexture2D,
  // NoiseTexture2D, CanvasTexture). `v.resourceReference` accepts both; only a
  // malformed reference errors.
  normal_texture: v.resourceReference('normal_texture'),
  albedo_texture: v.resourceReference('albedo_texture'),
  metallic_texture: v.resourceReference('metallic_texture'),
  roughness_texture: v.resourceReference('roughness_texture'),
  ao_texture: v.resourceReference('ao_texture'),
  emission_texture: v.resourceReference('emission_texture'),
  heightmap_texture: v.resourceReference('heightmap_texture'),

  // A zero component is legal grammar but a degenerate scale; catching it needs
  // a lint rule, since a property validator can only return errors.
  uv1_scale: v.vector3('uv1_scale'),

  albedo_color: v.color('albedo_color'),
  // Emission's colour and energy reach the renderer, so a malformed one should
  // be reported rather than silently dropped back to Godot's default.
  emission: v.color('emission'),
  // material.cpp:3634 ("0,16,0.01,or_greater"); set_emission_energy_multiplier
  // (material.cpp:2196-2203) is a bare assignment: `or_greater` opens the
  // ceiling, so there is no upper bound to check.
  emission_energy_multiplier: v.nonNegativeFloat('emission_energy_multiplier', {
    hinted: 'material.cpp:3634',
  }),
  // material.cpp:3637, set_emission_operator (:3141-3146) is a bare assignment
  // (only an equal-check early return); no engine-side range check.
  emission_operator: v.enumInt(
    'emission_operator',
    0,
    1,
    { 0: 'ADD', 1: 'MULTIPLY' },
    { hinted: 'material.cpp:3637' }
  ),
  // material.cpp:3732, set_texture_filter (:2567-2570) is a bare assignment.
  texture_filter: v.enumInt(
    'texture_filter',
    0,
    5,
    {
      0: 'NEAREST',
      1: 'LINEAR',
      2: 'NEAREST_WITH_MIPMAPS',
      3: 'LINEAR_WITH_MIPMAPS',
      4: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
      5: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
    },
    { hinted: 'material.cpp:3732' }
  ),
  // Validated but not rendered (see the sheet's limitations): a malformed value
  // is still worth reporting, since the scene is wrong in Godot either way.
  emission_on_uv2: v.boolean('emission_on_uv2'),
  // material.cpp:3635 ("0,100000.0,0.01,or_greater,suffix:nt"); set_emission_intensity
  // (material.cpp:2210-2214) gates on a PROJECT SETTING (physical light units), not
  // on the value, so the value itself is unguarded: `or_greater` also opens the ceiling.
  emission_intensity: v.nonNegativeFloat('emission_intensity', { hinted: 'material.cpp:3635' }),
});
