/**
 * NavigationAgent3D strict validators for linting: only its own members, the
 * ones doc/classes/NavigationAgent3D.xml lists without `overrides=`. Its base is
 * plain `Node`, since it steers a Node3D parent (linter.ts warns on the parent).
 * The NODE_BASE_TYPES base-walk delivers the inherited keys.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { hintedBitField, layerBitmask, v } from '../../../linter/validators/index.js';

// Every `ADD_PROPERTY` in `navigation_agent_3d.cpp` is below. A cite names the setter body, not the
// hint, where a setter calls `ERR_FAIL_COND` or clamps with `MAX(0.0, …)` (ADR-0032). The
// `DISABLE_DEPRECATED` shim (cpp:209-243) forwards `time_horizon`, `target_location` and
// `agent_height_offset`, and `godot/deprecated.ts` maps them to modern keys, so none registers.
validatorRegistry.registerAll('NavigationAgent3D', {
  // Pathfinding group, navigation_agent_3d.cpp:154-168.

  // navigation_agent_3d.cpp:154, VECTOR3, PROPERTY_HINT_NONE. USAGE_NO_EDITOR still
  // serialises it (object.h:132). set_target_position (cpp:705-713) is a bare assignment.
  target_position: v.vector3('target_position'),
  // navigation_agent_3d.cpp:591-597 is a bare assignment. The hint at :155
  // ("0.1,100,0.01,or_greater") floors at 0.1, not 0.
  path_desired_distance: v.float('path_desired_distance', {
    min: 0.1,
    message: "Property 'path_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:155',
  }),
  // navigation_agent_3d.cpp:599-605 is a bare assignment. The hint at :156
  // ("0.1,100,0.01,or_greater") floors at 0.1, not 0.
  target_desired_distance: v.float('target_desired_distance', {
    min: 0.1,
    message: "Property 'target_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:156',
  }),
  // navigation_agent_3d.cpp:626-628 is a bare assignment. The hint at :157
  // ("-100.0,100,0.01,or_greater") floors at -100. NavigationAgent2D has no counterpart.
  path_height_offset: v.float('path_height_offset', {
    min: -100,
    message: "Property 'path_height_offset' must be >= -100.",
    hinted: 'navigation_agent_3d.cpp:157',
  }),
  // navigation_agent_3d.cpp:693-699 is a bare assignment. The hint at :158
  // ("0.01,100,0.1,or_greater") floors at 0.01.
  path_max_distance: v.float('path_max_distance', {
    min: 0.01,
    message: "Property 'path_max_distance' must be >= 0.01.",
    hinted: 'navigation_agent_3d.cpp:158',
  }),
  // set_navigation_layers (cpp:449-459) stores a uint32_t, so the parameter type is the
  // ceiling. PROPERTY_HINT_LAYERS_3D_NAVIGATION (:159) is a UI-control hint, not a range.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_agent_3d.cpp:159', width: 'uint32' /* navigation_agent_3d.h:142 */ }),
  // set_pathfinding_algorithm (cpp:483-491) is a bare assignment. The HINT_ENUM at :160
  // lists only "AStar", the one PathfindingAlgorithm (navigation_path_query_parameters_3d.h:43-45).
  pathfinding_algorithm: v.enumInt(
    'pathfinding_algorithm',
    0,
    0,
    { 0: 'PATHFINDING_ALGORITHM_ASTAR' },
    { hinted: 'navigation_agent_3d.cpp:160' }
  ),
  // set_path_postprocessing (cpp:493-501) is a bare assignment. The HINT_ENUM at :161
  // ("Corridorfunnel,Edgecentered,None") matches PathPostProcessing 0-2
  // (navigation_path_query_parameters_3d.h:47-51).
  path_postprocessing: v.enumInt(
    'path_postprocessing',
    0,
    2,
    {
      0: 'PATH_POSTPROCESSING_CORRIDORFUNNEL',
      1: 'PATH_POSTPROCESSING_EDGECENTERED',
      2: 'PATH_POSTPROCESSING_NONE',
    },
    { hinted: 'navigation_agent_3d.cpp:161' }
  ),
  // set_path_metadata_flags (cpp:561-567) keeps every bit, with no `p_flags & MASK`. A bit
  // outside the HINT_FLAGS at :162 (1|2|4, navigation_constants_3d.h:52-54) loads but is
  // unreachable from the inspector, so it warns.
  path_metadata_flags: hintedBitField('path_metadata_flags', {
    hinted: 'navigation_agent_3d.cpp:162',
    labels: {
      1: 'PATH_METADATA_INCLUDE_TYPES',
      2: 'PATH_METADATA_INCLUDE_RIDS',
      4: 'PATH_METADATA_INCLUDE_OWNERS',
    },
  }),
  simplify_path: v.boolean('simplify_path'),
  // set_simplify_epsilon (cpp:512-515) clamps with `MAX(0.0, p_epsilon)`, altering the
  // value, so this errors (ADR-0032).
  simplify_epsilon: v.float('simplify_epsilon', {
    min: 0,
    message: "Property 'simplify_epsilon' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:513',
  }),
  // set_path_return_max_length (cpp:521-524) clamps: `path_return_max_length = MAX(0.0, p_length);`
  path_return_max_length: v.float('path_return_max_length', {
    min: 0,
    message: "Property 'path_return_max_length' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:522',
  }),
  // set_path_return_max_radius (cpp:530-533) clamps: `path_return_max_radius = MAX(0.0, p_radius);`
  path_return_max_radius: v.float('path_return_max_radius', {
    min: 0,
    message: "Property 'path_return_max_radius' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:531',
  }),
  // set_path_search_max_polygons (cpp:539-542) is a bare assignment. The hint at :167
  // ("0,4096,1,or_greater") floors at 0.
  path_search_max_polygons: v.int('path_search_max_polygons', {
    min: 0,
    message: "Property 'path_search_max_polygons' must be >= 0.",
    hinted: 'navigation_agent_3d.cpp:167',
  }),
  // set_path_search_max_distance (cpp:548-551) clamps with `MAX(0.0, p_distance)`. :168
  // has no hint string, so the clamp is the only bound.
  path_search_max_distance: v.float('path_search_max_distance', {
    min: 0,
    message: "Property 'path_search_max_distance' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:549',
  }),

  // Avoidance group, navigation_agent_3d.cpp:171-184.

  avoidance_enabled: v.boolean('avoidance_enabled'),
  // navigation_agent_3d.cpp:776-779 is a bare assignment. USAGE_NO_EDITOR at :172 still
  // serialises (object.h:132).
  velocity: v.vector3('velocity'),
  // navigation_agent_3d.cpp:618 refuses p_height < 0.0, and the hint (:173,
  // "0.01,100,0.01,or_greater,suffix:m") floors at 0.01, so [0, 0.01) loads and only warns.
  height: v.float('height', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:618' },
    hinted: { min: 'navigation_agent_3d.cpp:173' },
  }),
  // Same split as `height`: navigation_agent_3d.cpp:608 refuses p_radius < 0.0, and the
  // hint (:174, "0.01,100,0.01,or_greater,suffix:m") floors at 0.01.
  radius: v.float('radius', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:608' },
    hinted: { min: 'navigation_agent_3d.cpp:174' },
  }),
  // set_neighbor_distance (cpp:645-652) is a bare assignment. The hint at :175
  // ("0.1,10000,0.01,or_greater") floors at 0.1.
  neighbor_distance: v.float('neighbor_distance', {
    min: 0.1,
    message: "Property 'neighbor_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:175',
  }),
  // set_max_neighbors (cpp:655-663) is a bare assignment. The hint at :176
  // ("1,10000,1,or_greater") floors at 1, not 0.
  max_neighbors: v.int('max_neighbors', {
    min: 1,
    message: "Property 'max_neighbors' must be >= 1.",
    hinted: 'navigation_agent_3d.cpp:176',
  }),
  // navigation_agent_3d.cpp:665-671, ERR_FAIL_COND_MSG(p_time_horizon < 0.0, "Time horizon must be positive.").
  time_horizon_agents: v.float('time_horizon_agents', {
    min: 0,
    message: "Property 'time_horizon_agents' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:666',
  }),
  // navigation_agent_3d.cpp:674-680, ERR_FAIL_COND_MSG(p_time_horizon < 0.0, "Time horizon must be positive.").
  time_horizon_obstacles: v.float('time_horizon_obstacles', {
    min: 0,
    message: "Property 'time_horizon_obstacles' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:675',
  }),
  // Same split as `height`: navigation_agent_3d.cpp:684 refuses p_max_speed < 0.0, and the
  // hint (:179, "0.01,10000,0.01,or_greater,suffix:m/s") floors at 0.01.
  max_speed: v.float('max_speed', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:684' },
    hinted: { min: 'navigation_agent_3d.cpp:179' },
  }),
  // set_use_3d_avoidance (cpp:630-634) is a bare assignment. Its
  // notify_property_list_changed only toggles keep_y_velocity's inspector visibility
  // (cpp:346-351). No hint (:180). NavigationAgent2D has no counterpart.
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
  // set_keep_y_velocity (cpp:636-639) is a bare assignment. No hint (:181).
  // NavigationAgent2D has no counterpart.
  keep_y_velocity: v.boolean('keep_y_velocity'),
  // set_avoidance_layers (cpp:1003-1006) stores a uint32_t. PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :182 is a UI-control hint, not a range.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_agent_3d.cpp:182', width: 'uint32' /* navigation_agent_3d.h:251 */ }),
  // set_avoidance_mask (cpp:1012-1015) stores a uint32_t. PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :183 is a UI-control hint, not a range.
  avoidance_mask: layerBitmask('avoidance_mask', { hinted: 'navigation_agent_3d.cpp:183', width: 'uint32' /* navigation_agent_3d.h:254 */ }),
  // navigation_agent_3d.cpp:1057-1062 refuses p_priority < 0.0 at :1058 and > 1.0 at
  // :1059, matching the hint's "0.0,1.0,0.01".
  avoidance_priority: v.float('avoidance_priority', {
    min: 0,
    max: 1,
    message: "Property 'avoidance_priority' must be between 0.0 and 1.0 inclusive.",
    enforced: { min: 'navigation_agent_3d.cpp:1058', max: 'navigation_agent_3d.cpp:1059' },
  }),

  // Debug group, navigation_agent_3d.cpp:203-206: four members, with no
  // `debug_path_custom_line_width` unlike NavigationAgent2D.

  // navigation_agent_3d.cpp:1070-1079 is a bare assignment inside `#ifdef DEBUG_ENABLED`,
  // which every editor build defines, so the editor serialises the whole Debug group.
  debug_enabled: v.boolean('debug_enabled'),
  debug_use_custom: v.boolean('debug_use_custom'),
  // navigation_agent_3d.cpp:1100-1109 is a bare Color assignment, gated on DEBUG_ENABLED.
  debug_path_custom_color: v.color('debug_path_custom_color'),
  // set_debug_path_custom_point_size (cpp:1115-1124, gated on DEBUG_ENABLED) clamps:
  // `debug_path_custom_point_size = MAX(0.0, p_point_size);` at :1121.
  debug_path_custom_point_size: v.float('debug_path_custom_point_size', {
    min: 0,
    message: "Property 'debug_path_custom_point_size' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:1121',
  }),
});
