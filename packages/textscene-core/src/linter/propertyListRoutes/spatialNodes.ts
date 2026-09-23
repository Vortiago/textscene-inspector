/**
 * The 2D transform-adjacent keys, and the 3D skeleton, physics and tile-data
 * families.
 */

import type { RouteRow } from './types.js';

export const spatialNodeRoutes: readonly RouteRow[] = [
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
    // editor_settings/show_bone_gizmo, all pushed at skeleton_2d.cpp:86-94.
    type: 'Bone2D',
    at: 'skeleton_2d.cpp:85-95',
    sample: 'length',
    verdict: { validated: true },
  },
  {
    // set_length alias with no PropertyInfo (skeleton_2d.cpp:48-49,70-71). It is
    // absent from _get_property_list, so only a hand-edited scene reaches it.
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

  {
    // bones/<i>/{name,parent,rest,enabled,position,rotation,scale}, all
    // NO_EDITOR, so stored. bone_meta/<name> nests under the same bones/<i>/
    // prefix (skeleton_3d.cpp:203-206) and resolves through 'bones/*'.
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
    // Delegated to the JointData subclass of the live joint_type
    // (physical_bone_3d.cpp:748-750), such as SixDOFJointData's
    // _get_property_list (physical_bone_3d.cpp:681 onward) for per-axis leaves.
    type: 'PhysicalBone3D',
    at: 'physical_bone_3d.cpp:748-750',
    sample: 'joint_constraints/x/angular_limit_enabled',
    verdict: { validated: true },
  },
  {
    // Flat PACKED_INT32_ARRAY with no usage argument (soft_body_3d.cpp:176), so
    // PROPERTY_USAGE_DEFAULT. _set_property_pinned_points_indices does not clamp
    // the indices.
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:176',
    sample: 'pinned_points',
    verdict: { validated: true },
  },
  {
    // point_index, spatial_attachment_path and offset per pinned point
    // (soft_body_3d.cpp:178-183). A stored point_index write falls to `return
    // false` (soft_body_3d.cpp:238-239), yet Godot writes it, mirroring
    // pinned_points[i], so no data is lost.
    type: 'SoftBody3D',
    at: 'soft_body_3d.cpp:178-183',
    sample: 'attachments/0/spatial_attachment_path',
    verdict: { validated: true },
  },
  {
    // Packed cells: a 2-int key and a 1-int value per entry. The enforced bound
    // is ERR_FAIL_COND_V(amount % 3, false) at grid_map.cpp:71, in _set's "data"
    // branch behind d.has("cells") at :67. `at` is the _get_property_list push.
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
    // plus tile_data, registered at tile_map.cpp:1030-1043, as "layer_<i>/<leaf>".
    type: 'TileMap',
    at: 'tile_map.cpp:1023-1043',
    sample: 'layer_0/name',
    verdict: { validated: true },
  },
  {
    // Pushed outside the PropertyListHelper family (tile_map.cpp:747),
    // NO_EDITOR|INTERNAL, so stored.
    type: 'TileMap',
    at: 'tile_map.cpp:747',
    sample: 'format',
    verdict: { validated: true },
  },

];
