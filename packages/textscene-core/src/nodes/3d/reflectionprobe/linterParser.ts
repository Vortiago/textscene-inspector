/**
 * ReflectionProbe strict validators for linting.
 *
 * Declare only ReflectionProbe's OWN members — the ones doc/classes/ReflectionProbe.xml
 * lists without an `overrides=` attribute. Everything from VisualInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All four routes checked: `_bind_methods` (reflection_probe.cpp:214-284) has 15
 * `ADD_PROPERTY` calls, one per member below; no `PropertyListHelper`/
 * `register_property`, no `ADD_ARRAY_COUNT`, and no `.compat.inc` for this class.
 *
 * There IS a hand-rolled `_set`/`_get` (reflection_probe.cpp:287-301, both
 * `#ifndef DISABLE_DEPRECATED`) mapping the legacy Godot-3.x key `extents` to
 * `size` (`set_size(extents * 2)`). It has no `ADD_PROPERTY` of its own, is not in
 * the current XML member list, and `parser.ts` (which reuses `parseNode3D`) never
 * reads it either — a load-time-only compat shim for scenes saved by an older
 * Godot, not a current property. Same shape as `TextureRect`'s deprecated
 * `expand`/`ignore_texture_size` keys, and the same call: no validator here.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// reflection_probe.h:39-42 enum UpdateMode; BIND_ENUM_CONSTANT at
// reflection_probe.cpp:278-279. Labels from the ADD_PROPERTY hint string,
// reflection_probe.cpp:260: "Once (Fast),Always (Slow)".
const UPDATE_MODE = {
  0: 'UPDATE_ONCE',
  1: 'UPDATE_ALWAYS',
};

// reflection_probe.h:44-48 enum AmbientMode; BIND_ENUM_CONSTANT at
// reflection_probe.cpp:281-283. Labels from the ADD_PROPERTY hint string,
// reflection_probe.cpp:274: "Disabled,Environment,Constant Color".
const AMBIENT_MODE = {
  0: 'AMBIENT_DISABLED',
  1: 'AMBIENT_ENVIRONMENT',
  2: 'AMBIENT_COLOR',
};

validatorRegistry.registerAll('ReflectionProbe', {
  // reflection_probe.cpp:260, PROPERTY_HINT_ENUM. set_update_mode (:187-190) is a
  // bare assignment — no ERR_FAIL, no clamp — so an out-of-range int is a
  // warning, matching every other plain PROPERTY_HINT_ENUM in this codebase.
  update_mode: v.enumInt('update_mode', 0, 1, UPDATE_MODE, { hinted: 'reflection_probe.cpp:260' }),

  // reflection_probe.cpp:261, PROPERTY_HINT_RANGE "0,1,0.01". set_intensity
  // (:33-36) is a bare assignment (plus a RenderingServer call): both ends are
  // hinted only.
  intensity: v.float('intensity', { min: 0, max: 1, hinted: 'reflection_probe.cpp:261' }),

  // reflection_probe.cpp:262, PROPERTY_HINT_RANGE "0,8,0.01,or_greater,suffix:m".
  // `or_greater` opens the max end; set_blend_distance (:42-46) is a bare
  // assignment, so only the 0 floor is a real (hinted) bound.
  blend_distance: v.float('blend_distance', { min: 0, hinted: 'reflection_probe.cpp:262' }),

  // reflection_probe.cpp:263 hints PROPERTY_HINT_RANGE
  // "0,16384,0.1,or_greater,exp,suffix:m": floor closed at 0, ceiling open, so
  // 16384 is only a slider extent. set_max_distance (:80-84) clamps
  // unconditionally: `max_distance = CLAMP(p_distance, 0.0, 262'144.0);`
  // (reflection_probe.cpp:81), with a comment explaining reflections break past
  // that distance due to floating-point precision. A clamp ALTERS the value, so
  // both ends error; the 262144 is `enforcedMax` rather than `max` because the
  // hint states no ceiling at all, and 262144 itself passes through unaltered.
  max_distance: v.float('max_distance', {
    min: 0,
    enforcedMax: { at: 262144 },
    enforced: 'reflection_probe.cpp:81',
  }),

  // reflection_probe.cpp:264, PROPERTY_HINT_NONE ("suffix:m" only — a unit
  // label, not a range). set_size (:99-117) assigns `size = p_size;` UNCLAMPED;
  // the loop below it only derives a LOCAL `half_size` to re-clamp
  // `origin_offset` (see below) and never writes back into `size` itself. So
  // `size` carries no bound of any kind — format only.
  size: v.vector3('size'),

  // reflection_probe.cpp:265, PROPERTY_HINT_NONE ("suffix:m" only). Unlike
  // `size`, set_origin_offset (:123-136) DOES alter the stored value: each
  // component is clamped to `size[i]/2 - 0.01` when it exceeds that magnitude.
  // But that bound is not a literal — it is a function of `size`'s CURRENT
  // value at the moment this setter runs, and set_size (:99-117) applies the
  // same clamp in the other direction when `size` changes afterwards. Which
  // property a `.tscn` lists first decides which setter sees the other's
  // stale value, so the effective bound depends on file order, not just on the
  // two authored values (e.g. an origin_offset authored under the DEFAULT size
  // and later shrunk by a much larger authored size does not get re-widened).
  // No fixed min/max can be cited for this without replicating that
  // order-dependent state machine, so this stays format-only, same as `size`.
  origin_offset: v.vector3('origin_offset'),

  // reflection_probe.cpp:266/267/268 — plain BOOL, no hint, bare-assignment
  // setters (:142-167).
  box_projection: v.boolean('box_projection'),
  interior: v.boolean('interior'),
  enable_shadows: v.boolean('enable_shadows'),

  // reflection_probe.cpp:269/270, both PROPERTY_HINT_LAYERS_3D_RENDER — a
  // 32-checkbox editor widget, not a range; set_cull_mask/set_reflection_mask
  // (:169-185) are bare assignments.
  cull_mask: layerBitmask('cull_mask', { hinted: 'reflection_probe.cpp:269', width: 'uint32' /* reflection_probe.h:117 */ }),
  reflection_mask: layerBitmask('reflection_mask', { hinted: 'reflection_probe.cpp:270', width: 'uint32' /* reflection_probe.h:120 */ }),

  // reflection_probe.cpp:271, PROPERTY_HINT_RANGE "0,1024,0.1". No or_greater/
  // or_less; set_mesh_lod_threshold (:90-93) is a bare assignment, so both ends
  // are hinted only.
  mesh_lod_threshold: v.float('mesh_lod_threshold', { min: 0, max: 1024, hinted: 'reflection_probe.cpp:271' }),

  // reflection_probe.cpp:274, PROPERTY_HINT_ENUM. set_ambient_mode (:52-56) is a
  // bare assignment (plus notify_property_list_changed), so out-of-range is a
  // warning.
  ambient_mode: v.enumInt('ambient_mode', 0, 2, AMBIENT_MODE, { hinted: 'reflection_probe.cpp:274' }),

  // reflection_probe.cpp:275, PROPERTY_HINT_COLOR_NO_ALPHA — an editor-widget
  // hint (hides the alpha slider), not a value constraint; set_ambient_color
  // (:62-65) is a bare assignment. Same treatment as Light3D's `light_color`,
  // which carries the identical hint.
  ambient_color: v.color('ambient_color'),

  // reflection_probe.cpp:276, PROPERTY_HINT_RANGE "0,16,0.01".
  // set_ambient_color_energy (:67-70) is a bare assignment, so both ends are
  // hinted only.
  ambient_color_energy: v.float('ambient_color_energy', { min: 0, max: 16, hinted: 'reflection_probe.cpp:276' }),
});
