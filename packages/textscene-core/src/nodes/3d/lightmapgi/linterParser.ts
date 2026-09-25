/**
 * LightmapGI strict validators: the `ADD_PROPERTY` calls of `_bind_methods`
 * (scene/3d/lightmap_gi.cpp:1918-1943), none with `overrides=` in doc/classes/LightmapGI.xml. No
 * PropertyListHelper, ADD_ARRAY_COUNT or `.compat.inc`, and in lightmap_gi.cpp and lightmap_gi.h
 * only `LightmapGIData` has a `_set`/`_get`. NODE_BASE_TYPES delivers inherited keys.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';
import { CMP_EPSILON } from '../../../godot/index.js';

const BAKE_QUALITY = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'ULTRA' };
const ENVIRONMENT_MODE = { 0: 'DISABLED', 1: 'SCENE', 2: 'CUSTOM_SKY', 3: 'CUSTOM_COLOR' };
const GENERATE_PROBES = {
  0: 'DISABLED',
  1: 'SUBDIV_4',
  2: 'SUBDIV_8',
  3: 'SUBDIV_16',
  4: 'SUBDIV_32',
};
// lightmap_gi.h:46-51 declares a fourth value, SHADOWMASK_MODE_ONLY = 3, but the
// hint string (cpp:1925) offers only "None,Replace,Overlay", so 3 warns.
const SHADOWMASK_MODE = { 0: 'NONE', 1: 'REPLACE', 2: 'OVERLAY' };

// `_validate_property` (lightmap_gi.cpp:1825-1847) hides six keys from the
// inspector while their enabling sibling is off, with `PROPERTY_USAGE_NO_EDITOR`,
// which `object.h:132` defines as `PROPERTY_USAGE_STORAGE`. A hidden key still
// serialises and loads, so this display-only interaction gets no rule.
validatorRegistry.registerAll('LightmapGI', {
  // lightmap_gi.cpp:1919, PROPERTY_HINT_ENUM "Low,Medium,High,Ultra". set_bake_quality
  // (:1614-1616) is a bare assignment, so the hint is advisory only.
  quality: v.enumInt('quality', 0, 3, BAKE_QUALITY, { hinted: 'lightmap_gi.cpp:1919' }),

  // lightmap_gi.cpp:1920, plain BOOL, no hint.
  supersampling: v.boolean('supersampling'),

  // lightmap_gi.cpp:1921, PROPERTY_HINT_RANGE "1,8,1", ceiling closed.
  // set_supersampling_factor (:1777-1781) has `ERR_FAIL_COND(p_factor < 1)`, so
  // the floor is enforced and the ceiling is only a hint.
  supersampling_factor: v.float('supersampling_factor', {
    min: 1,
    max: 8,
    enforced: { min: 'lightmap_gi.cpp:1778' },
    hinted: { max: 'lightmap_gi.cpp:1921' },
  }),

  // lightmap_gi.cpp:1922, PROPERTY_HINT_RANGE "0,6,1,or_greater". set_bounces
  // (:1721-1724) is `ERR_FAIL_COND(p_bounces < 0 || p_bounces > 16)`, so 16 loads
  // and is `enforcedMax`, not `max`, and the hint end stays open. `v.int`: `Variant::_to_int`
  // (variant.h:369-370) truncates, so `bounces = 5.9` loads as 5.
  bounces: v.int('bounces', {
    min: 0,
    enforcedMax: { at: 16 },
    enforced: 'lightmap_gi.cpp:1722',
  }),

  // lightmap_gi.cpp:1923, PROPERTY_HINT_RANGE "0,2,0.01" (no or_greater).
  // set_bounce_indirect_energy (:1730-1733) is `ERR_FAIL_COND(p_indirect_energy <
  // 0.0)`: the floor is enforced, the closed ceiling is only a hint.
  bounce_indirect_energy: v.float('bounce_indirect_energy', {
    min: 0,
    max: 2,
    enforced: { min: 'lightmap_gi.cpp:1731' },
    hinted: { max: 'lightmap_gi.cpp:1923' },
  }),

  // lightmap_gi.cpp:1924, plain BOOL, no hint.
  directional: v.boolean('directional'),

  // lightmap_gi.cpp:1925, PROPERTY_HINT_ENUM "None,Replace,Overlay". set_shadowmask_mode
  // (:1659-1666) is a bare assignment, so the hint is advisory only.
  shadowmask_mode: v.enumInt('shadowmask_mode', 0, 2, SHADOWMASK_MODE, {
    hinted: 'lightmap_gi.cpp:1925',
  }),

  // lightmap_gi.cpp:1926, plain BOOL, no hint.
  use_texture_for_bounces: v.boolean('use_texture_for_bounces'),

  // lightmap_gi.cpp:1927, plain BOOL, no hint.
  interior: v.boolean('interior'),

  // lightmap_gi.cpp:1928, plain BOOL, no hint.
  use_denoiser: v.boolean('use_denoiser'),

  // lightmap_gi.cpp:1929, PROPERTY_HINT_RANGE "0.001,0.2,0.001,or_greater".
  // set_denoiser_strength (:1635-1637) is a bare assignment, so the floor is a
  // warning and `or_greater` leaves the ceiling open.
  denoiser_strength: v.float('denoiser_strength', {
    min: 0.001,
    hinted: 'lightmap_gi.cpp:1929',
  }),

  // lightmap_gi.cpp:1930, PROPERTY_HINT_RANGE "1,20" (no or_greater).
  // set_denoiser_range (:1643-1645) is a bare assignment, so both ends are only
  // a hint. `v.int`: the same truncating INT cast as `bounces` above.
  denoiser_range: v.int('denoiser_range', { min: 1, max: 20, hinted: 'lightmap_gi.cpp:1930' }),

  // lightmap_gi.cpp:1931, PROPERTY_HINT_RANGE "0.00001,0.1,0.00001,or_greater".
  // set_bias (:1739-1742) is `ERR_FAIL_COND(p_bias < 0.00001)`: the floor is
  // enforced (a literal, not CMP_EPSILON, though they share a value in this
  // build). `or_greater` leaves the ceiling open.
  bias: v.float('bias', { min: 0.00001, enforced: 'lightmap_gi.cpp:1740' }),

  // Two tiers on the floor. set_texel_scale:1749 is `ERR_FAIL_COND(p_multiplier <
  // (0.01 - CMP_EPSILON))`, and the hint (:1932, "0.01,100.0,0.01") floors at
  // 0.01, so the epsilon-wide band between loads and warns. The ceiling has no
  // `or_greater` and no setter check, so it warns.
  texel_scale: v.float('texel_scale', {
    enforcedMin: { at: 0.01 - CMP_EPSILON },
    min: 0.01,
    max: 100,
    enforced: { min: 'lightmap_gi.cpp:1749' },
    hinted: 'lightmap_gi.cpp:1932',
  }),

  // lightmap_gi.cpp:1933, PROPERTY_HINT_RANGE "2048,16384,1". set_max_texture_size
  // (:1757-1761) refuses below 2048 and above 16384 with two `ERR_FAIL_COND_MSG`s
  // (:1758, :1759). `v.int`: the same truncating INT cast as `bounces` above.
  max_texture_size: v.int('max_texture_size', {
    min: 2048,
    max: 16384,
    enforced: { min: 'lightmap_gi.cpp:1758', max: 'lightmap_gi.cpp:1759' },
  }),

  // lightmap_gi.cpp:1935, PROPERTY_HINT_ENUM "Disabled,Scene,Custom Sky,Custom
  // Color". set_environment_mode (:1688-1691) is a bare assignment, so the hint
  // is advisory only.
  environment_mode: v.enumInt('environment_mode', 0, 3, ENVIRONMENT_MODE, {
    hinted: 'lightmap_gi.cpp:1935',
  }),

  // lightmap_gi.cpp:1936, PROPERTY_HINT_RESOURCE_TYPE "Sky". set_environment_custom_sky
  // (:1697-1699) is a bare assignment: format only, no value bound.
  environment_custom_sky: v.resourceReference('environment_custom_sky'),

  // lightmap_gi.cpp:1937, PROPERTY_HINT_COLOR_NO_ALPHA: an editor-widget hint that
  // hides the alpha slider. set_environment_custom_color (:1705-1707) is a bare
  // assignment. Format only.
  environment_custom_color: v.color('environment_custom_color'),

  // lightmap_gi.cpp:1938, PROPERTY_HINT_RANGE "0,64,0.01" (no or_greater).
  // set_environment_custom_energy (:1713-1715) is a bare assignment, so both ends
  // are only a hint.
  environment_custom_energy: v.float('environment_custom_energy', {
    min: 0,
    max: 64,
    hinted: 'lightmap_gi.cpp:1938',
  }),

  // lightmap_gi.cpp:1939, PROPERTY_HINT_RESOURCE_TYPE
  // "CameraAttributesPractical,CameraAttributesPhysical". set_camera_attributes
  // (:1795-1797) is a bare assignment: format only, as in WorldEnvironment's
  // `camera_attributes`.
  camera_attributes: v.resourceReference('camera_attributes'),

  // lightmap_gi.cpp:1941, PROPERTY_HINT_ENUM "Disabled,4,8,16,32".
  // set_generate_probes (:1787-1789) is a bare assignment, so the hint is
  // advisory only.
  generate_probes_subdiv: v.enumInt('generate_probes_subdiv', 0, 4, GENERATE_PROBES, {
    hinted: 'lightmap_gi.cpp:1941',
  }),

  // lightmap_gi.cpp:1943, PROPERTY_HINT_RESOURCE_TYPE "LightmapGIData".
  // set_light_data (:1590-1608) never rejects the resource it is given: format
  // only.
  light_data: v.resourceReference('light_data'),
});
