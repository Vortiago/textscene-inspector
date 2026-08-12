/**
 * GeometryInstance3D strict validators for linting.
 *
 * Declare only GeometryInstance3D's OWN members — the ones doc/classes/GeometryInstance3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `gi_lightmap_scale` is also a documented member (deprecated), but its own
 * `ADD_PROPERTY` passes `PROPERTY_USAGE_NONE` explicitly — it never reaches a
 * `.tscn`, so it gets no validator here.
 *
 * `sorting_offset` and `sorting_use_aabb_center` are VisualInstance3D's fields
 * (declared `PROPERTY_USAGE_NONE` there — see visualinstance3d/linterParser.ts),
 * but `GeometryInstance3D::_validate_property` restores `PROPERTY_USAGE_DEFAULT`
 * for both: "if (p_property.name == "sorting_offset" || p_property.name ==
 * "sorting_use_aabb_center") { p_property.usage = PROPERTY_USAGE_DEFAULT; }".
 * That makes them serialisable for this whole hierarchy (MeshInstance3D,
 * Sprite3D, Label3D, GPUParticles3D, the CSG shapes, …), so they are OWNED
 * here rather than by VisualInstance3D — the serialisability is this
 * subclass's decision, not the base's.
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
  // PROPERTY_HINT_NONE, "suffix:m"), ...) — no range hint, just the AABB(...) shape.
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
  // PROPERTY_HINT_RANGE, "0.01,10,0.0001,or_greater") — `or_greater`: the 10 is a soft
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

  // scene/3d/visual_instance_3d.cpp:604, ADD_PROPERTY(..., "lod_bias", PROPERTY_HINT_RANGE,
  // "0.001,128,0.001"). The floor deliberately does NOT match the hint: set_lod_bias:387
  // is `ERR_FAIL_COND(p_bias < 0.0)`, so the setter's floor is 0 and sits BELOW the hint's
  // 0.001. A min end carries one bound, and it must be the more severe tier — coding
  // 0.001 would downgrade `lod_bias = -5` from the error the setter makes it to a warning,
  // which loses more than the unmodelled hint-only sliver [0, 0.001) is worth. The hint's
  // 128 ceiling is closed (no or_greater) but never checked by the setter, so it warns.
  lod_bias: v.float('lod_bias', {
    min: 0,
    max: 128,
    enforced: { min: 'visual_instance_3d.cpp:387' },
    hinted: { max: 'visual_instance_3d.cpp:604' },
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
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  // set_visibility_range_begin:245-249 is a bare assignment.
  visibility_range_begin: v.nonNegativeFloat('visibility_range_begin', {
    hinted: 'visual_instance_3d.cpp:615',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_begin_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  // set_visibility_range_begin_margin:265-269 is a bare assignment.
  visibility_range_begin_margin: v.nonNegativeFloat('visibility_range_begin_margin', {
    hinted: 'visual_instance_3d.cpp:616',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  // set_visibility_range_end:255-259 is a bare assignment.
  visibility_range_end: v.nonNegativeFloat('visibility_range_end', {
    hinted: 'visual_instance_3d.cpp:617',
  }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
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

  // scene/3d/visual_instance_3d.cpp: VisualInstance3D's own ADD_PROPERTY gives
  // "sorting_offset" PROPERTY_HINT_NONE with an empty hint string — no range, so the
  // FLOAT format check is the whole validator (negative values are legitimate: a negative
  // sorting_offset pulls sorting closer to the camera).
  sorting_offset: v.float('sorting_offset'),

  // scene/3d/visual_instance_3d.cpp: VisualInstance3D's own ADD_PROPERTY gives
  // "sorting_use_aabb_center" PROPERTY_HINT_NONE — a plain BOOL, no range to check.
  sorting_use_aabb_center: v.boolean('sorting_use_aabb_center'),

  // visual_instance_3d.cpp:301-364, the SAME InstanceUniforms engine class as
  // CanvasItem's own instance_shader_parameters (canvasitem/shared/linterParser.ts),
  // reached through the 3D RenderingServer surface instead. The base type/hint
  // come from the attached shader's own uniform declarations at runtime, not
  // from anything a .tscn carries, so this is the same permissive wildcard.
  'instance_shader_parameters/*': shape(
    () => null,
    "any Variant — the type comes from the attached shader's uniform declarations, not the .tscn"
  ),
});
