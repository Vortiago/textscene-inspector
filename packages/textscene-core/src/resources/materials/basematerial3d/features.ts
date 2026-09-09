/**
 * BaseMaterial3D's optional shading features (`material.cpp:3650-3715`) — Rim,
 * Clearcoat, Anisotropy, AO, Height, Subsurface Scattering, Transmittance,
 * Back Lighting, Refraction and Detail.
 *
 * Hinted throughout except the two `*_texture_channel` enums: the
 * `ERR_FAIL_INDEX` in `set_feature` (:2523) guards the C++ feature index, not
 * anything a scene writes.
 */

import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { TEXTURE_CHANNELS } from './pbr.js';

export const featureKeys: Record<string, PropertyValidator> = {
  rim_enabled: v.boolean('rim_enabled'),
  // material.cpp:3652-3653 (both "0,1,0.01"); set_rim (:2229) and set_rim_tint
  // (:2238) bare assign.
  rim: v.float('rim', { min: 0, max: 1, hinted: 'material.cpp:3652' }),
  rim_tint: v.float('rim_tint', { min: 0, max: 1, hinted: 'material.cpp:3653' }),
  rim_texture: v.resourceReference('rim_texture'),

  clearcoat_enabled: v.boolean('clearcoat_enabled'),
  // material.cpp:3658-3659 (both "0,1,0.01"); set_clearcoat (:2256) and
  // set_clearcoat_roughness (:2265) bare assign.
  clearcoat: v.float('clearcoat', { min: 0, max: 1, hinted: 'material.cpp:3658' }),
  clearcoat_roughness: v.float('clearcoat_roughness', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3659',
  }),
  clearcoat_texture: v.resourceReference('clearcoat_texture'),

  anisotropy_enabled: v.boolean('anisotropy_enabled'),
  // material.cpp:3664 ("-1,1,0.01"); set_anisotropy (:2274) bare assigns. The
  // sign is the direction of the flow, so the negative half is as valid as the
  // positive one.
  anisotropy: v.float('anisotropy', { min: -1, max: 1, hinted: 'material.cpp:3664' }),
  anisotropy_flowmap: v.resourceReference('anisotropy_flowmap'),

  ao_enabled: v.boolean('ao_enabled'),
  // material.cpp:3669 ("0,1,0.01"); set_ao_light_affect (:2247) bare assigns.
  ao_light_affect: v.float('ao_light_affect', { min: 0, max: 1, hinted: 'material.cpp:3669' }),
  ao_texture: v.resourceReference('ao_texture'),
  ao_on_uv2: v.boolean('ao_on_uv2'),
  ao_texture_channel: v.enumInt('ao_texture_channel', 0, 4, TEXTURE_CHANNELS, {
    enforced: 'material.cpp:2984',
  }),

  heightmap_enabled: v.boolean('heightmap_enabled'),
  // material.cpp:3676 ("-16,16,0.001"); set_heightmap_scale (:2283) bare assigns.
  heightmap_scale: v.float('heightmap_scale', { min: -16, max: 16, hinted: 'material.cpp:3676' }),
  heightmap_deep_parallax: v.boolean('heightmap_deep_parallax'),
  // material.cpp:3678-3679 (both "1,64,1"); set_heightmap_deep_parallax_min_layers
  // (:2869) and _max_layers (:2878) bare assign, so a zero layer count loads.
  heightmap_min_layers: v.int('heightmap_min_layers', {
    min: 1,
    max: 64,
    hinted: 'material.cpp:3678',
  }),
  heightmap_max_layers: v.int('heightmap_max_layers', {
    min: 1,
    max: 64,
    hinted: 'material.cpp:3679',
  }),
  heightmap_flip_tangent: v.boolean('heightmap_flip_tangent'),
  heightmap_flip_binormal: v.boolean('heightmap_flip_binormal'),
  heightmap_texture: v.resourceReference('heightmap_texture'),
  heightmap_flip_texture: v.boolean('heightmap_flip_texture'),

  subsurf_scatter_enabled: v.boolean('subsurf_scatter_enabled'),
  // material.cpp:3687 ("0,1,0.01"); set_subsurface_scattering_strength (:2292)
  // bare assigns.
  subsurf_scatter_strength: v.float('subsurf_scatter_strength', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3687',
  }),
  subsurf_scatter_skin_mode: v.boolean('subsurf_scatter_skin_mode'),
  subsurf_scatter_texture: v.resourceReference('subsurf_scatter_texture'),

  subsurf_scatter_transmittance_enabled: v.boolean('subsurf_scatter_transmittance_enabled'),
  subsurf_scatter_transmittance_color: v.color('subsurf_scatter_transmittance_color'),
  subsurf_scatter_transmittance_texture: v.resourceReference(
    'subsurf_scatter_transmittance_texture'
  ),
  // material.cpp:3695 ("0.001,8,0.001,or_greater"); set_transmittance_depth
  // (:2310) bare assigns, and `or_greater` opens the ceiling.
  subsurf_scatter_transmittance_depth: v.float('subsurf_scatter_transmittance_depth', {
    min: 0.001,
    hinted: 'material.cpp:3695',
  }),
  // material.cpp:3696 ("0.00,1.0,0.01"); set_transmittance_boost (:2319) bare assigns.
  subsurf_scatter_transmittance_boost: v.float('subsurf_scatter_transmittance_boost', {
    min: 0,
    max: 1,
    hinted: 'material.cpp:3696',
  }),

  backlight_enabled: v.boolean('backlight_enabled'),
  backlight: v.color('backlight'),
  backlight_texture: v.resourceReference('backlight_texture'),

  refraction_enabled: v.boolean('refraction_enabled'),
  // material.cpp:3705 ("-1,1,0.01"); set_refraction (:2337) bare assigns.
  refraction_scale: v.float('refraction_scale', { min: -1, max: 1, hinted: 'material.cpp:3705' }),
  refraction_texture: v.resourceReference('refraction_texture'),
  refraction_texture_channel: v.enumInt('refraction_texture_channel', 0, 4, TEXTURE_CHANNELS, {
    enforced: 'material.cpp:2994',
  }),

  detail_enabled: v.boolean('detail_enabled'),
  detail_mask: v.resourceReference('detail_mask'),
  detail_blend_mode: v.enumInt(
    'detail_blend_mode',
    0,
    3,
    { 0: 'MIX', 1: 'ADD', 2: 'SUB', 3: 'MUL' },
    { hinted: 'material.cpp:3712' }
  ),
  detail_uv_layer: v.enumInt(
    'detail_uv_layer',
    0,
    1,
    { 0: 'UV1', 1: 'UV2' },
    { hinted: 'material.cpp:3713' }
  ),
  detail_albedo: v.resourceReference('detail_albedo'),
  detail_normal: v.resourceReference('detail_normal'),
};
