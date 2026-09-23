/**
 * ReflectionProbe strict validators for linting: only its own members, the ones
 * doc/classes/ReflectionProbe.xml lists without `overrides=`. The NODE_BASE_TYPES
 * base-walk delivers everything from VisualInstance3D up, so re-declaring an
 * inherited key shadows it and duplicates the rule.
 */

// `_bind_methods` (reflection_probe.cpp:214-284) has one `ADD_PROPERTY` per member below,
// and the class has no `PropertyListHelper`, `register_property`, `ADD_ARRAY_COUNT` or
// `.compat.inc`.

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// reflection_probe.h:39-42 enum UpdateMode, bound at reflection_probe.cpp:278-279.
// Labels from the hint string, reflection_probe.cpp:260: "Once (Fast),Always (Slow)".
const UPDATE_MODE = {
  0: 'UPDATE_ONCE',
  1: 'UPDATE_ALWAYS',
};

// reflection_probe.h:44-48 enum AmbientMode, bound at reflection_probe.cpp:281-283.
// Labels from the hint string, reflection_probe.cpp:274: "Disabled,Environment,Constant Color".
const AMBIENT_MODE = {
  0: 'AMBIENT_DISABLED',
  1: 'AMBIENT_ENVIRONMENT',
  2: 'AMBIENT_COLOR',
};

validatorRegistry.registerAll('ReflectionProbe', {
  // reflection_probe.cpp:260, PROPERTY_HINT_ENUM. set_update_mode (:187-190) is a bare
  // assignment, so an out-of-range int warns.
  update_mode: v.enumInt('update_mode', 0, 1, UPDATE_MODE, { hinted: 'reflection_probe.cpp:260' }),

  // reflection_probe.cpp:261, PROPERTY_HINT_RANGE "0,1,0.01". set_intensity (:33-36)
  // stores the value unchecked, so both ends are hinted only.
  intensity: v.float('intensity', { min: 0, max: 1, hinted: 'reflection_probe.cpp:261' }),

  // reflection_probe.cpp:262, PROPERTY_HINT_RANGE "0,8,0.01,or_greater,suffix:m".
  // set_blend_distance (:42-46) is a bare assignment, so only the 0 floor is hinted.
  blend_distance: v.float('blend_distance', { min: 0, hinted: 'reflection_probe.cpp:262' }),

  // reflection_probe.cpp:263 hints "0,16384,0.1,or_greater,exp,suffix:m", so 16384 is
  // only a slider extent. set_max_distance clamps: `CLAMP(p_distance, 0.0, 262'144.0)`
  // (reflection_probe.cpp:81), so both ends error. `enforcedMax`, not `max`: the hint
  // states no ceiling, and 262144 itself passes unaltered.
  max_distance: v.float('max_distance', {
    min: 0,
    enforcedMax: { at: 262144 },
    enforced: 'reflection_probe.cpp:81',
  }),

  // reflection_probe.cpp:264, PROPERTY_HINT_NONE, "suffix:m". set_size (:99-117) stores
  // `p_size` unclamped: its local `half_size` only re-clamps `origin_offset`.
  // reflection_probe.cpp:287-301 maps the Godot 3 key `extents` to `set_size(extents * 2)`.
  // `godot/deprecated.ts` resolves it to `size`, so `extents` gets no validator of its own.
  size: v.vector3('size'),

  // reflection_probe.cpp:265, PROPERTY_HINT_NONE. set_origin_offset (:123-136) clamps each
  // component to `size[i]/2 - 0.01`, and set_size (:99-117) clamps it again when `size`
  // changes. The bound depends on the current `size` and on file order, so no literal
  // can be cited and this stays format-only.
  origin_offset: v.vector3('origin_offset'),

  // reflection_probe.cpp:266/267/268: plain BOOL, bare-assignment setters (:142-167).
  box_projection: v.boolean('box_projection'),
  interior: v.boolean('interior'),
  enable_shadows: v.boolean('enable_shadows'),

  // reflection_probe.cpp:269/270, PROPERTY_HINT_LAYERS_3D_RENDER: a 32-checkbox widget,
  // not a range. set_cull_mask and set_reflection_mask (:169-185) are bare assignments.
  cull_mask: layerBitmask('cull_mask', { hinted: 'reflection_probe.cpp:269', width: 'uint32' /* reflection_probe.h:117 */ }),
  reflection_mask: layerBitmask('reflection_mask', { hinted: 'reflection_probe.cpp:270', width: 'uint32' /* reflection_probe.h:120 */ }),

  // reflection_probe.cpp:271, PROPERTY_HINT_RANGE "0,1024,0.1". set_mesh_lod_threshold
  // (:90-93) is a bare assignment, so both ends are hinted only.
  mesh_lod_threshold: v.float('mesh_lod_threshold', { min: 0, max: 1024, hinted: 'reflection_probe.cpp:271' }),

  // reflection_probe.cpp:274, PROPERTY_HINT_ENUM. set_ambient_mode (:52-56) stores the
  // value unchecked, so out-of-range warns.
  ambient_mode: v.enumInt('ambient_mode', 0, 2, AMBIENT_MODE, { hinted: 'reflection_probe.cpp:274' }),

  // reflection_probe.cpp:275, PROPERTY_HINT_COLOR_NO_ALPHA only hides the alpha slider.
  // set_ambient_color (:62-65) is a bare assignment.
  ambient_color: v.color('ambient_color'),

  // reflection_probe.cpp:276, PROPERTY_HINT_RANGE "0,16,0.01".
  // set_ambient_color_energy (:67-70) is a bare assignment, so both ends are
  // hinted only.
  ambient_color_energy: v.float('ambient_color_energy', { min: 0, max: 16, hinted: 'reflection_probe.cpp:276' }),
});
