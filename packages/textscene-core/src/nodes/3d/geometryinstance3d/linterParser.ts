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
import { v } from '../../../linter/validators/index.js';

const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
const GI_MODE = { 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' };
const VISIBILITY_RANGE_FADE_MODE = { 0: 'DISABLED', 1: 'SELF', 2: 'DEPENDENCIES' };

validatorRegistry.registerAll('GeometryInstance3D', {
  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "cast_shadow",
  // PROPERTY_HINT_ENUM, "Off,On,Double-Sided,Shadows Only"), ...)
  cast_shadow: v.enumInt('cast_shadow', 0, 3, CAST_SHADOW),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::AABB, "custom_aabb",
  // PROPERTY_HINT_NONE, "suffix:m"), ...) — no range hint, just the AABB(...) shape.
  custom_aabb: v.aabb('custom_aabb'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "extra_cull_margin", PROPERTY_HINT_RANGE,
  // "0,16384,0.01,suffix:m"); setter mirrors the floor: ERR_FAIL_COND(p_margin < 0).
  extra_cull_margin: v.float('extra_cull_margin', { min: 0, max: 16384 }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "gi_lightmap_texel_scale",
  // PROPERTY_HINT_RANGE, "0.01,10,0.0001,or_greater") — `or_greater`: the 10 is a soft
  // editor bound only, so no max is enforced here.
  gi_lightmap_texel_scale: v.float('gi_lightmap_texel_scale', { min: 0.01 }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "gi_mode", PROPERTY_HINT_ENUM,
  // "Disabled,Static,Dynamic")
  gi_mode: v.enumInt('gi_mode', 0, 2, GI_MODE),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "ignore_occlusion_culling"), ...)
  ignore_occlusion_culling: v.boolean('ignore_occlusion_culling'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "lod_bias", PROPERTY_HINT_RANGE,
  // "0.001,128,0.001"). The hint's 0.001 floor is an editor-slider convenience, not the
  // documented validity floor: doc/classes/GeometryInstance3D.xml says "A value of 0 will
  // force the mesh to its lowest level of detail" (0 is a meaningful, intentional value,
  // not an error), and the setter only rejects negative: ERR_FAIL_COND(p_bias < 0.0). The
  // validator follows the setter/doc floor (0), not the slider's.
  lod_bias: v.float('lod_bias', { min: 0, max: 128 }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "material_overlay", PROPERTY_HINT_RESOURCE_TYPE, "BaseMaterial3D,ShaderMaterial",
  // PROPERTY_USAGE_DEFAULT), ...)
  material_overlay: v.resourceReference('material_overlay'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::OBJECT,
  // "material_override", PROPERTY_HINT_RESOURCE_TYPE, "BaseMaterial3D,ShaderMaterial",
  // PROPERTY_USAGE_DEFAULT), ...)
  material_override: v.resourceReference('material_override'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "transparency", PROPERTY_HINT_RANGE,
  // "0.0,1.0,0.01")
  transparency: v.float('transparency', { min: 0, max: 1 }),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_begin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  visibility_range_begin: v.nonNegativeFloat('visibility_range_begin'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_begin_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  visibility_range_begin_margin: v.nonNegativeFloat('visibility_range_begin_margin'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  visibility_range_end: v.nonNegativeFloat('visibility_range_end'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_end_margin",
  // PROPERTY_HINT_RANGE, "0.0,4096.0,0.01,or_greater,suffix:m") — `or_greater`: no cap.
  visibility_range_end_margin: v.nonNegativeFloat('visibility_range_end_margin'),

  // scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(..., "visibility_range_fade_mode",
  // PROPERTY_HINT_ENUM, "Disabled,Self,Dependencies")
  visibility_range_fade_mode: v.enumInt(
    'visibility_range_fade_mode',
    0,
    2,
    VISIBILITY_RANGE_FADE_MODE
  ),

  // scene/3d/visual_instance_3d.cpp: VisualInstance3D's own ADD_PROPERTY gives
  // "sorting_offset" PROPERTY_HINT_NONE with an empty hint string — no range, so the
  // FLOAT format check is the whole validator (negative values are legitimate: a negative
  // sorting_offset pulls sorting closer to the camera).
  sorting_offset: v.float('sorting_offset'),

  // scene/3d/visual_instance_3d.cpp: VisualInstance3D's own ADD_PROPERTY gives
  // "sorting_use_aabb_center" PROPERTY_HINT_NONE — a plain BOOL, no range to check.
  sorting_use_aabb_center: v.boolean('sorting_use_aabb_center'),
});
