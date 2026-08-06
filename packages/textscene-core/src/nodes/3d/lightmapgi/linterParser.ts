/**
 * LightmapGI strict validators for linting.
 *
 * Declare only LightmapGI's OWN members — the ones doc/classes/LightmapGI.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All 22 of LightmapGI's own members come from the 22 `ADD_PROPERTY` calls in
 * `LightmapGI::_bind_methods` (scene/3d/lightmap_gi.cpp:1918-1943) — the same
 * count and the same names as doc/classes/LightmapGI.xml's `<members>` block, none
 * of which carries `overrides=`. No `PropertyListHelper`/`register_property`, no
 * `ADD_ARRAY_COUNT`, and no hand-rolled `_set`/`_get`/`get_property_list` override
 * exists anywhere in lightmap_gi.cpp or lightmap_gi.h for the `LightmapGI` class
 * itself (only its sibling resource class `LightmapGIData`, in the same file,
 * carries one — that class is not this node and out of this slice's scope). No
 * `.compat.inc` include exists for this file either.
 *
 * `LightmapGI::_validate_property` (lightmap_gi.cpp:1825-1847) hides
 * `supersampling_factor`, `environment_custom_sky`, `environment_custom_color`,
 * `environment_custom_energy`, `denoiser_strength` and `denoiser_range` from the
 * INSPECTOR when their enabling sibling is off, but it early-returns unless
 * `Engine::is_editor_hint()`, and every usage it assigns is exactly
 * `PROPERTY_USAGE_NO_EDITOR`, which `object.h:132` defines as
 * `PROPERTY_USAGE_STORAGE` — the same bit alone. So even while hidden, the
 * property still serialises: a `.tscn` can legally carry `environment_custom_sky`
 * while `environment_mode` is `ENVIRONMENT_MODE_SCENE`, and Godot loads it without
 * complaint. That is a display-only interaction, not a value constraint, so it
 * gets no rule here and no `linter.ts`.
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
// lightmap_gi.h:46-51 declares a FOURTH value, SHADOWMASK_MODE_ONLY = 3, but
// LightmapGI's own hint string (cpp:1925) offers only "None,Replace,Overlay" —
// three labels, 0-2. The enum type can represent 3, this property's hint
// cannot, so 3 is a warning here rather than accepted.
const SHADOWMASK_MODE = { 0: 'NONE', 1: 'REPLACE', 2: 'OVERLAY' };

validatorRegistry.registerAll('LightmapGI', {
  // lightmap_gi.cpp:1919, PROPERTY_HINT_ENUM "Low,Medium,High,Ultra". set_bake_quality
  // (:1614-1616) is a bare assignment — the hint is advisory only.
  quality: v.enumInt('quality', 0, 3, BAKE_QUALITY, { hinted: 'lightmap_gi.cpp:1919' }),

  // lightmap_gi.cpp:1920, plain BOOL, no hint.
  supersampling: v.boolean('supersampling'),

  // lightmap_gi.cpp:1921, PROPERTY_HINT_RANGE "1,8,1" (no or_greater — the ceiling
  // is closed). set_supersampling_factor (:1777-1781) has
  // `ERR_FAIL_COND(p_factor < 1)`, so the floor is enforced and the ceiling is
  // only ever a hint.
  supersampling_factor: v.float('supersampling_factor', {
    min: 1,
    max: 8,
    enforced: { min: 'lightmap_gi.cpp:1778' },
    hinted: { max: 'lightmap_gi.cpp:1921' },
  }),

  // lightmap_gi.cpp:1922, PROPERTY_HINT_RANGE "0,6,1,or_greater" — but
  // set_bounces (:1721-1724) is `ERR_FAIL_COND(p_bounces < 0 || p_bounces > 16)`,
  // a HARD ceiling of 16 despite the hint's `or_greater` opening its own display
  // max of 6. The setter wins: both ends are enforced at 0 and 16, not 0 and
  // "unbounded". `v.int` (not `v.strictInt`) is deliberate: the bound `int
  // p_bounces` parameter is filled by `Variant::_to_int` (variant.h:369-370),
  // whose FLOAT branch is `return T(_data._float)` — a plain truncating cast,
  // no refusal — so `bounces = 5.9` loads as `5` with no diagnostic from Godot
  // either.
  bounces: v.int('bounces', { min: 0, max: 16, enforced: 'lightmap_gi.cpp:1722' }),

  // lightmap_gi.cpp:1923, PROPERTY_HINT_RANGE "0,2,0.01" (no or_greater).
  // set_bounce_indirect_energy (:1730-1733) is `ERR_FAIL_COND(p_indirect_energy <
  // 0.0)`: the floor is enforced, the closed ceiling is only ever a hint.
  bounce_indirect_energy: v.float('bounce_indirect_energy', {
    min: 0,
    max: 2,
    enforced: { min: 'lightmap_gi.cpp:1731' },
    hinted: { max: 'lightmap_gi.cpp:1923' },
  }),

  // lightmap_gi.cpp:1924, plain BOOL, no hint.
  directional: v.boolean('directional'),

  // lightmap_gi.cpp:1925, PROPERTY_HINT_ENUM "None,Replace,Overlay". set_shadowmask_mode
  // (:1659-1666) is a bare assignment — the hint is advisory only.
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
  // set_denoiser_strength (:1635-1637) is a bare assignment — no enforcement at
  // all, so the floor is a warning and `or_greater` leaves the ceiling open.
  denoiser_strength: v.float('denoiser_strength', {
    min: 0.001,
    hinted: 'lightmap_gi.cpp:1929',
  }),

  // lightmap_gi.cpp:1930, PROPERTY_HINT_RANGE "1,20" (no or_greater).
  // set_denoiser_range (:1643-1645) is a bare assignment — both ends are only
  // ever a hint. `v.int`: same truncating INT cast as `bounces` above, so a
  // fractional pixel count is not a format error either.
  denoiser_range: v.int('denoiser_range', { min: 1, max: 20, hinted: 'lightmap_gi.cpp:1930' }),

  // lightmap_gi.cpp:1931, PROPERTY_HINT_RANGE "0.00001,0.1,0.00001,or_greater".
  // set_bias (:1739-1742) is `ERR_FAIL_COND(p_bias < 0.00001)`: the floor is
  // enforced (a literal, not the CMP_EPSILON constant, though the two happen to
  // share a value in this build); `or_greater` leaves the ceiling open.
  bias: v.float('bias', { min: 0.00001, enforced: 'lightmap_gi.cpp:1740' }),

  // lightmap_gi.cpp:1932, PROPERTY_HINT_RANGE "0.01,100.0,0.01" (no or_greater).
  // set_texel_scale (:1748-1751) is `ERR_FAIL_COND(p_multiplier < (0.01 -
  // CMP_EPSILON))`: the floor is enforced, but AT 0.01 minus the engine's own
  // epsilon, not a bare 0.01 — a value fractionally under 0.01 that Godot still
  // accepts must not be flagged here. The ceiling has no `or_greater`, so it is
  // only ever a hint.
  texel_scale: v.float('texel_scale', {
    min: 0.01 - CMP_EPSILON,
    max: 100,
    enforced: { min: 'lightmap_gi.cpp:1749' },
    hinted: { max: 'lightmap_gi.cpp:1932' },
  }),

  // lightmap_gi.cpp:1933, PROPERTY_HINT_RANGE "2048,16384,1". set_max_texture_size
  // (:1757-1761) refuses both below 2048 and above 16384 with two separate
  // `ERR_FAIL_COND_MSG`s (:1758, :1759) — both ends enforced. `v.int`: same
  // truncating INT cast as `bounces` above, so a fractional pixel size is not a
  // format error either, only the enforced 2048-16384 range.
  max_texture_size: v.int('max_texture_size', {
    min: 2048,
    max: 16384,
    enforced: { min: 'lightmap_gi.cpp:1758', max: 'lightmap_gi.cpp:1759' },
  }),

  // lightmap_gi.cpp:1935, PROPERTY_HINT_ENUM "Disabled,Scene,Custom Sky,Custom
  // Color". set_environment_mode (:1688-1691) is a bare assignment — the hint is
  // advisory only.
  environment_mode: v.enumInt('environment_mode', 0, 3, ENVIRONMENT_MODE, {
    hinted: 'lightmap_gi.cpp:1935',
  }),

  // lightmap_gi.cpp:1936, PROPERTY_HINT_RESOURCE_TYPE "Sky". set_environment_custom_sky
  // (:1697-1699) is a bare assignment: format only, no value bound.
  environment_custom_sky: v.resourceReference('environment_custom_sky'),

  // lightmap_gi.cpp:1937, PROPERTY_HINT_COLOR_NO_ALPHA — an editor-widget hint
  // (hides the alpha slider), not a value constraint; set_environment_custom_color
  // (:1705-1707) is a bare assignment. Format only.
  environment_custom_color: v.color('environment_custom_color'),

  // lightmap_gi.cpp:1938, PROPERTY_HINT_RANGE "0,64,0.01" (no or_greater).
  // set_environment_custom_energy (:1713-1715) is a bare assignment — both ends
  // are only ever a hint.
  environment_custom_energy: v.float('environment_custom_energy', {
    min: 0,
    max: 64,
    hinted: 'lightmap_gi.cpp:1938',
  }),

  // lightmap_gi.cpp:1939, PROPERTY_HINT_RESOURCE_TYPE
  // "CameraAttributesPractical,CameraAttributesPhysical". set_camera_attributes
  // (:1795-1797) is a bare assignment: format only, no value bound. Matches
  // WorldEnvironment's own `camera_attributes` validator (same property, same
  // resource-type hint, same unchecked setter).
  camera_attributes: v.resourceReference('camera_attributes'),

  // lightmap_gi.cpp:1941, PROPERTY_HINT_ENUM "Disabled,4,8,16,32".
  // set_generate_probes (:1787-1789) is a bare assignment — the hint is advisory
  // only.
  generate_probes_subdiv: v.enumInt('generate_probes_subdiv', 0, 4, GENERATE_PROBES, {
    hinted: 'lightmap_gi.cpp:1941',
  }),

  // lightmap_gi.cpp:1943, PROPERTY_HINT_RESOURCE_TYPE "LightmapGIData".
  // set_light_data (:1590-1608) never rejects the resource it is given (it only
  // manages the visual server RID and, when the node is in the tree, calls
  // `_clear_lightmaps`/`_assign_lightmaps` as a side effect): format only.
  light_data: v.resourceReference('light_data'),
});
