/**
 * The 2D transform-adjacent keys, and the 3D skeleton, physics and tile-data
 * families.
 */

import type { RouteRow } from './types.js';

export const spatialNodeRoutes: readonly RouteRow[] = [
  // --- 2D transform-adjacent hand-rolled keys ---
  {
    type: 'AudioListener2D',
    at: 'audio_listener_2d.cpp:61-63',
    sample: 'current',
    verdict: { validated: true },
  },
  {
    type: 'AudioListener3D',
    at: 'audio_listener_3d.cpp:70-72',
    sample: 'current',
    verdict: { validated: true },
  },
  {
    // auto_calculate_length_and_angle, length, bone_angle and (TOOLS_ENABLED)
    // editor_settings/show_bone_gizmo, all pushed at skeleton_2d.cpp:86-94 and
    // all already registered.
    type: 'Bone2D',
    at: 'skeleton_2d.cpp:85-95',
    sample: 'length',
    verdict: { validated: true },
  },
  {
    // set_length alias with no PropertyInfo (skeleton_2d.cpp:48-49,70-71);
    // never appears in _get_property_list, so only a hand-edited/legacy scene
    // reaches it.
    type: 'Bone2D',
    at: 'skeleton_2d.cpp:48-49',
    sample: 'default_length',
    verdict: {
      declined: 'never-owned',
      because:
        'A bare alias for `length`; `godot/deprecated.ts` resolves it before any lookup, so the strict parser validates it as `length` and no validator is registered under this spelling.',
    },
  },
  {
    type: 'Skeleton2D',
    at: 'skeleton_2d.cpp:530-536',
    sample: 'modification_stack',
    verdict: { validated: true },
  },

  // --- 3D skeleton/physics/tile data ---
  {
    // bones/<i>/{name,parent,rest,enabled,position,rotation,scale}, all
    // unconditionally NO_EDITOR (storage-bearing). bone_meta/<name> is a
    // NESTED leaf under the same bones/<i>/ prefix (skeleton_3d.cpp:203-206),
    // not a separate top-level family, so it resolves through the same
    // registered 'bones/*' wildcard.
    type: 'Skeleton3D',
    at: 'skeleton_3d.cpp:182-208',
    sample: 'bones/0/position',
    verdict: { validated: true },
  },
  {
    type: 'PhysicalBone3D',
    at: 'physical_bone_3d.cpp:740-751',
    sample: 'bone_name',
    verdict: { validated: true },
  },
  {
    // Delegated to whichever JointData subclass owns the live joint_type
    // (physical_bone_3d.cpp:748-750); e.g. SixDOFJointData's own
    // _get_property_list (physical_bone_3d.cpp:681 onward) for the per-axis leaves.
    type: 'PhysicalBone3D',
    at: 'physical_bone_3d.cpp:748-750',
    sample: 'joint_constraints/x/angular_limit_enabled',
    verdict: { validated: true },
  },
  {
    // Flat PACKED_INT32_ARRAY, no usage argument (soft_body_3d.cpp:176) so it
    // is PROPERTY_USAGE_DEFAULT (storage). _set_property_pinned_points_indices
    // resizes/pins with no clamp on the indices themselves.
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:176',
    sample: 'pinned_points',
    verdict: { validated: true },
  },
  {
    // point_index/spatial_attachment_path/offset per pinned point
    // (soft_body_3d.cpp:178-183). point_index writes are silently dropped:
    // _set_property_pinned_points_attachment has no branch for it and falls to
    // `return false` (soft_body_3d.cpp:238-239) even though the key carries
    // storage and is read back — the same "setter refuses" shape ChainIK3D's
    // joints/<j>/bone already has a readOnly-style validator for. (Unlike
    // ChainIK3D's joints, which carry NO storage bit and so never actually
    // reach a real .tscn, point_index genuinely does — every SoftBody3D with
    // pinned points writes it, redundantly mirroring pinned_points[i], so no
    // data is actually lost, just this one echo key.)
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:178-183',
    sample: 'attachments/0/spatial_attachment_path',
    verdict: { validated: true },
  },
  {
    // Packed cell dictionary: 2 ints key + 1 int cell value per entry.
    // ERR_FAIL_COND_V(amount % 3, false) at grid_map.cpp:71 (inside the "data"
    // branch of _set, guarded by d.has("cells") at :67) is a real enforced
    // whole-value bound. `at` below is the _get_property_list push (:158)
    // that introduces the family; the enforced bound's own line is :71, not
    // :158 as this row originally had it.
    type: 'GridMap',
    at: 'grid_map.cpp:158',
    sample: 'data',
    verdict: { validated: true },
  },
  {
    // Conditionally pushed only when baked_meshes.size() > 0 (grid_map.cpp:154-156).
    type: 'GridMap',
    at: 'grid_map.cpp:154-156',
    sample: 'baked_meshes',
    verdict: { validated: true },
  },
  {
    // Seven PropertyListHelper leaves per TileMapLayer (name, enabled,
    // modulate, y_sort_enabled, y_sort_origin, z_index, navigation_enabled)
    // plus tile_data, registered tile_map.cpp:1030-1043. Glued-index shape
    // ("layer_" + i + "/" + leaf).
    type: 'TileMap',
    at: 'tile_map.cpp:1023-1043',
    sample: 'layer_0/name',
    verdict: { validated: true },
  },
  {
    // Explicitly pushed OUTSIDE the PropertyListHelper family
    // (tile_map.cpp:747), NO_EDITOR|INTERNAL (storage-bearing).
    type: 'TileMap',
    at: 'tile_map.cpp:747',
    sample: 'format',
    verdict: { validated: true },
  },

];
