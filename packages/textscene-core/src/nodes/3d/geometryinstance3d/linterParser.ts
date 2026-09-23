/**
 * GeometryInstance3D strict validators. Declare only its own members, the ones
 * doc/classes/GeometryInstance3D.xml lists without `overrides=`. The deprecated
 * `gi_lightmap_scale` is `PROPERTY_USAGE_NONE`, never serialised, so it gets no
 * validator. The NODE_BASE_TYPES base-walk delivers every inherited key.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { shape, v } from '../../../linter/validators/index.js';

const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
const GI_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };
const VISIBILITY_RANGE_FADE_MODE = { 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' };

validatorRegistry.registerAll('GeometryInstance3D', {
  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "cast_shadow",
  // PROPERTY_HINT_ENUM, "Off,On,Double-Sided,Shadows Only"), ...). set_cast_shadows_setting
  // (:366-370) is a bare assignment.
  cast_shadow: v.enumInt('cast_shadow', 0, 3, CAST_SHADOW, {
    hinted: 'visual_instance_3d.cpp:601',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::AABB, "custom_aabb",
  // PROPERTY_HINT_NONE, "suffix:m"), ...): no range hint, only the AABB(...) shape.
  custom_aabb: v.aabb('custom_aabb'),

  // scene/3d/visual_instance_3d.cpp:602, ADD_PROPERTY(..., "extra_cull_margin",
  // PROPERTY_HINT_RANGE, "0,16384,0.01,suffix:m"); set_extra_cull_margin:376-380
  // ERR_FAIL_COND(p_margin < 0) enforces the floor. The hint's ceiling is closed
  // (no or_greater) but never checked by the setter, so it is a warning.
  extra_cull_margin: v.float('extra_cull_margin', {
    min: 0,
    max: 16384,
    enforced: { min: 'visual_instance_3d.cpp:377' },
    hinted: { max: 'visual_instance_3d.cpp:602' },
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "gi_lightmap_texel_scale",
  // PROPERTY_HINT_RANGE, "0.01,10,0.0001,or_greater"). `or_greater`: the 10 is a soft
  // editor bound only, so no max is enforced here. set_lightmap_texel_scale:429-431 is
  // a bare assignment.
  gi_lightmap_texel_scale: v.float('gi_lightmap_texel_scale', {
    min: 0.01,
    hinted: 'visual_instance_3d.cpp:609',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "gi_mode", PROPERTY_HINT_ENUM,
  // "Disabled,Static,Dynamic"). set_gi_mode:472-489 switches on 3 known cases then
  // assigns unconditionally afterward, so an out-of-range value is not dropped.
  gi_mode: v.enumInt('gi_mode', 0, 2, GI_MODE, { hinted: 'visual_instance_3d.cpp:608' }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "ignore_occlusion_culling"), ...)
  ignore_occlusion_culling: v.boolean('ignore_occlusion_culling'),

  // Two tiers on the floor. set_lod_bias:387 is `ERR_FAIL_COND(p_bias < 0.0)`,
  // so 0 is the setter's floor; the hint (:604, "0.001,128,0.001") floors at
  // 0.001, so [0, 0.001) loads and only warns. The 128 ceiling is closed (no
  // or_greater) but never checked by the setter, so it warns too.
  lod_bias: v.float('lod_bias', {
    enforcedMin: { at: 0 },
    min: 0.001,
    max: 128,
    enforced: { min: 'visual_instance_3d.cpp:387' },
    hinted: 'visual_instance_3d.cpp:604',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "material_overlay", PROPERTY_HINT_RESOURCE_TYPE, "BaseMaterial3D,ShaderMaterial",
  // PROPERTY_USAGE_DEFAULT), ...)
  material_overlay: v.resourceReference('material_overlay'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "material_override", PROPERTY_HINT_RESOURCE_TYPE, "BaseMaterial3D,ShaderMaterial",
  // PROPERTY_USAGE_DEFAULT), ...)
  material_override: v.resourceReference('material_override'),

  // scene/3d/visual_instance_3d.cpp:600, ADD_PROPERTY(..., "transparency", PROPERTY_HINT_RANGE,
  // "0.0,1.0,0.01"). set_transparency:235-238 `transparency = CLAMP(p_transparency, 0.0f,
  // 1.0f)` enforces both ends.
  transparency: v.float('transparency', { min: 0, max: 1, enforced: 'visual_instance_3d.cpp:236' }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_begin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m"). `or_greater`: no cap.
  // set_visibility_range_begin:245-249 is a bare assignment.
  visibility_range_begin: v.nonNegativeFloat('visibility_range_begin', {
    hinted: 'visual_instance_3d.cpp:615',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_begin_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m"). `or_greater`: no cap.
  // set_visibility_range_begin_margin:265-269 is a bare assignment.
  visibility_range_begin_margin: v.nonNegativeFloat('visibility_range_begin_margin', {
    hinted: 'visual_instance_3d.cpp:616',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m"). `or_greater`: no cap.
  // set_visibility_range_end:255-259 is a bare assignment.
  visibility_range_end: v.nonNegativeFloat('visibility_range_end', {
    hinted: 'visual_instance_3d.cpp:617',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m"). `or_greater`: no cap.
  // set_visibility_range_end_margin:275-279 is a bare assignment.
  visibility_range_end_margin: v.nonNegativeFloat('visibility_range_end_margin', {
    hinted: 'visual_instance_3d.cpp:618',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_fade_mode",
  // PROPERTY_HINT_ENUM, "Disabled,Self,Dependencies"). set_visibility_range_fade_mode:285-289
  // is a bare assignment.
  visibility_range_fade_mode: v.enumInt(
    'visibility_range_fade_mode',
    0,
    2,
    VISIBILITY_RANGE_FADE_MODE,
    { hinted: 'visual_instance_3d.cpp:619' }
  ),

  // VisualInstance3D declares both sorting keys `PROPERTY_USAGE_NONE`, and
  // `GeometryInstance3D::_validate_property` restores `PROPERTY_USAGE_DEFAULT`, so
  // this class owns them. scene/3d/visual_instance_3d.cpp gives "sorting_offset"
  // PROPERTY_HINT_NONE, and a negative value pulls sorting closer to the camera.
  sorting_offset: v.float('sorting_offset'),

  // scene/3d/visual_instance_3d.cpp: VisualInstance3D's own ADD_PROPERTY gives
  // "sorting_use_aabb_center" PROPERTY_HINT_NONE: a plain BOOL.
  sorting_use_aabb_center: v.boolean('sorting_use_aabb_center'),

  // visual_instance_3d.cpp:301-364, the InstanceUniforms class behind CanvasItem's
  // instance_shader_parameters (canvasitem/shared/linterParser.ts). The attached
  // shader's uniforms give the type at runtime, so this is the same permissive wildcard.
  'instance_shader_parameters/*': shape(
    () => null,
    "any Variant — the type comes from the attached shader's uniform declarations, not the .tscn"
  ),
});
