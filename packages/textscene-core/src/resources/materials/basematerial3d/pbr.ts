/**
 * BaseMaterial3D's Albedo, ORM, Metallic, Roughness, Emission, Normal Map and
 * Bent Normal Map groups (`material.cpp:3611-3648`).
 *
 * A texture slot takes an ExtResource or an inline SubResource; both are
 * `v.resourceReference`, and only a malformed reference errors.
 *
 * The `*_texture_channel` enums are the one error tier here: their setters open
 * with `ERR_FAIL_INDEX(p_channel, 5)`.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/** The five channels every `*_texture_channel` enum offers (material.h TextureChannel). */
export const TEXTURE_CHANNELS = { 0: 'RED', 1: 'GREEN', 2: 'BLUE', 3: 'ALPHA', 4: 'GRAYSCALE' };

export const pbrKeys: Record<string, PropertyValidator> = {
  // material.cpp:3612-3618
  albedo_color: v.color('albedo_color'),
  albedo_texture: v.resourceReference('albedo_texture'),
  albedo_texture_force_srgb: v.boolean('albedo_texture_force_srgb'),
  albedo_texture_msdf: v.boolean('albedo_texture_msdf'),
  orm_texture: v.resourceReference('orm_texture'),

  // material.cpp:3621 ("0,1,0.01"), set_metallic (:2178) bare assigns.
  metallic: v.float('metallic', { min: 0, max: 1, hinted: 'material.cpp:3621' }),
  // material.cpp:3622 ("0,1,0.01"), set_specular (:2160) bare assigns.
  metallic_specular: v.float('metallic_specular', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3622',
  }),
  metallic_texture: v.resourceReference('metallic_texture'),
  metallic_texture_channel: v.enumInt('metallic_texture_channel', 0, 4, TEXTURE_CHANNELS, {
    enforced: 'material.cpp:2964',
  }),

  // material.cpp:3627 ("0,1,0.01"), set_roughness (:2169) bare assigns.
  roughness: v.float('roughness', { min: 0, max: 1, hinted: 'material.cpp:3627' }),
  roughness_texture: v.resourceReference('roughness_texture'),
  roughness_texture_channel: v.enumInt('roughness_texture_channel', 0, 4, TEXTURE_CHANNELS, {
    enforced: 'material.cpp:2974',
  }),

  emission_enabled: v.boolean('emission_enabled'),
  // Emission's colour and energy reach the renderer, so a malformed one should
  // be reported rather than silently dropped back to Godot's default.
  emission: v.color('emission'),
  // material.cpp:3634 ("0,16,0.01,or_greater"); set_emission_energy_multiplier
  // (material.cpp:2196-2203) is a bare assignment: `or_greater` opens the
  // ceiling, so there is no upper bound to check.
  emission_energy_multiplier: v.nonNegativeFloat('emission_energy_multiplier', {
    hinted: 'material.cpp:3634',
  }),
  // material.cpp:3635 ("0,100000.0,0.01,or_greater,suffix:nt"); set_emission_intensity
  // (material.cpp:2210-2214) gates on a PROJECT SETTING (physical light units), not
  // on the value, so the value itself is unguarded: `or_greater` also opens the ceiling.
  emission_intensity: v.nonNegativeFloat('emission_intensity', { hinted: 'material.cpp:3635' }),
  // material.cpp:3637, set_emission_operator (:3141-3146) is a bare assignment
  // (only an equal-check early return); no engine-side range check.
  emission_operator: v.enumInt(
    'emission_operator',
    0,
    1,
    { 0: 'ADD', 1: 'MULTIPLY' },
    { hinted: 'material.cpp:3637' }
  ),
  // Validated but not rendered (see the sheet's limitations): a malformed value
  // is still worth reporting, since the scene is wrong in Godot either way.
  emission_on_uv2: v.boolean('emission_on_uv2'),
  emission_texture: v.resourceReference('emission_texture'),

  normal_enabled: v.boolean('normal_enabled'),
  // material.cpp:3643 ("-16,16,0.01"), set_normal_scale (:2220) bare assigns, so
  // the negative floor is a real bound and not a sign error.
  normal_scale: v.float('normal_scale', { min: -16, max: 16, hinted: 'material.cpp:3643' }),
  normal_texture: v.resourceReference('normal_texture'),

  // material.cpp:3647-3648
  bent_normal_enabled: v.boolean('bent_normal_enabled'),
  bent_normal_texture: v.resourceReference('bent_normal_texture'),
};
