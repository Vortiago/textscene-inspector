/**
 * NavigationAgent3D strict validators for linting.
 *
 * Declare only NavigationAgent3D's OWN members — the ones doc/classes/NavigationAgent3D.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * NavigationAgent3D's base is plain `Node` (nodeBaseTypes.generated.ts), not
 * Node3D — it steers a Node3D-inheriting PARENT rather than being one itself
 * (see linter.ts for the parent-type warning that follows from that).
 *
 * The 33 members below are every `ADD_PROPERTY` in `navigation_agent_3d.cpp`,
 * across three groups: Pathfinding (:154-168), Avoidance (:171-184) and Debug
 * (:203-206); none carries `overrides=` in the XML. Several setters here call
 * `ERR_FAIL_COND` or clamp with `MAX(0.0, …)` where the sibling `PROPERTY_HINT_RANGE`
 * suggests a laxer or absent bound — each citation below points at the actual
 * setter body, not the hint, per ADR-0032.
 *
 * Three members here have no 2D counterpart at all — `use_3d_avoidance`,
 * `keep_y_velocity` and `path_height_offset` are 3D-only avoidance/path
 * concerns. The reverse also holds: NavigationAgent2D's Debug group carries a
 * `debug_path_custom_line_width` that NavigationAgent3D's Debug group
 * (:203-206, four members only) does not bind at all.
 *
 * Not registered: the `#ifndef DISABLE_DEPRECATED` compat shim (cpp:212-226)
 * hand-rolls `_set`/`_get` for three Godot-4.0-beta10-and-earlier names
 * (`time_horizon`, `target_location`, `agent_height_offset`), each forwarding
 * to a modern setter (`set_time_horizon_agents`, `set_target_position`,
 * `set_path_height_offset`). A `.tscn` carrying one of these legacy keys still
 * loads today, routed through whichever modern property's bound this file
 * already states — but the legacy key ITSELF reaches no validator here, same
 * as the 2D twin's identical shim (navigation_agent_2d.cpp:198-224). All three
 * are in the shared table in `godot/deprecated.ts`, which resolves them in the
 * property bag so the rules and the renderer read the modern field.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { hintedBitField, layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationAgent3D', {
  // --- Pathfinding ---

  // navigation_agent_3d.cpp:154, VECTOR3 hinted PROPERTY_HINT_NONE (USAGE_NO_EDITOR
  // still serialises it, object.h:132). set_target_position (cpp:705-713) is a
  // bare assignment (plus a repath trigger); no bound to check beyond the
  // literal's shape.
  target_position: v.vector3('target_position'),
  // navigation_agent_3d.cpp:591-597 is a bare assignment (only an equal-check
  // early return); the hint at :155 ("0.1,100,0.01,or_greater") gives the real
  // floor of 0.1, not 0.
  path_desired_distance: v.float('path_desired_distance', {
    min: 0.1,
    message: "Property 'path_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:155',
  }),
  // navigation_agent_3d.cpp:599-605 is a bare assignment; the hint at :156
  // ("0.1,100,0.01,or_greater") gives the real floor of 0.1, not 0.
  target_desired_distance: v.float('target_desired_distance', {
    min: 0.1,
    message: "Property 'target_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:156',
  }),
  // navigation_agent_3d.cpp:626-628 is a pure bare assignment (not even an
  // equal-check); the hint at :157 ("-100.0,100,0.01,or_greater") gives the real
  // floor of -100, with the ceiling opened by `or_greater`. 3D-only: no 2D
  // NavigationAgent2D counterpart.
  path_height_offset: v.float('path_height_offset', {
    min: -100,
    message: "Property 'path_height_offset' must be >= -100.",
    hinted: 'navigation_agent_3d.cpp:157',
  }),
  // navigation_agent_3d.cpp:693-699 is a bare assignment (plus an equal-check);
  // the hint at :158 ("0.01,100,0.1,or_greater") gives the real floor of 0.01.
  path_max_distance: v.float('path_max_distance', {
    min: 0.01,
    message: "Property 'path_max_distance' must be >= 0.01.",
    hinted: 'navigation_agent_3d.cpp:158',
  }),
  // Bare uint32_t assignment (set_navigation_layers, cpp:449-459, plus an
  // equal-check and a repath trigger): the parameter type is the ceiling, and
  // PROPERTY_HINT_LAYERS_3D_NAVIGATION (:159) is a UI-control hint, not a range.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_agent_3d.cpp:159', width: 'uint32' /* navigation_agent_3d.h:142 */ }),
  // set_pathfinding_algorithm (cpp:483-491) is a bare assignment (plus an
  // equal-check). The HINT_ENUM at :160 lists a single value, "AStar" — the
  // only member of NavigationPathQueryParameters3D::PathfindingAlgorithm
  // (navigation_path_query_parameters_3d.h:43-45).
  pathfinding_algorithm: v.enumInt(
    'pathfinding_algorithm',
    0,
    0,
    { 0: 'PATHFINDING_ALGORITHM_ASTAR' },
    { hinted: 'navigation_agent_3d.cpp:160' }
  ),
  // set_path_postprocessing (cpp:493-501) is a bare assignment (plus an
  // equal-check). HINT_ENUM at :161 ("Corridorfunnel,Edgecentered,None") matches
  // PathPostProcessing 0-2 (navigation_path_query_parameters_3d.h:47-51).
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
  // set_path_metadata_flags (cpp:561-567) is a bare BitField assignment — no
  // `p_flags & MASK`, so every bit the caller sets is kept, not just the three
  // HINT_FLAGS names at :162 ("Include Types,Include RIDs,Include Owners" = 1|2|4,
  // navigation_constants_3d.h:52-54). A bit outside 1|2|4 loads and runs but is
  // unreachable from the inspector, which is `hintedBitField`'s warning tier.
  path_metadata_flags: hintedBitField('path_metadata_flags', {
    hinted: 'navigation_agent_3d.cpp:162',
    labels: {
      1: 'PATH_METADATA_INCLUDE_TYPES',
      2: 'PATH_METADATA_INCLUDE_RIDS',
      4: 'PATH_METADATA_INCLUDE_OWNERS',
    },
  }),
  simplify_path: v.boolean('simplify_path'),
  // set_simplify_epsilon (cpp:512-515) CLAMPS: `simplify_epsilon = MAX(0.0, p_epsilon);`
  // — the setter alters an out-of-range value rather than merely being hinted
  // against it, so this is an ERROR (ADR-0032), not the hint's advisory tier.
  simplify_epsilon: v.float('simplify_epsilon', {
    min: 0,
    message: "Property 'simplify_epsilon' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:513',
  }),
  // set_path_return_max_length (cpp:521-524) CLAMPS: `path_return_max_length = MAX(0.0, p_length);`
  path_return_max_length: v.float('path_return_max_length', {
    min: 0,
    message: "Property 'path_return_max_length' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:522',
  }),
  // set_path_return_max_radius (cpp:530-533) CLAMPS: `path_return_max_radius = MAX(0.0, p_radius);`
  path_return_max_radius: v.float('path_return_max_radius', {
    min: 0,
    message: "Property 'path_return_max_radius' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:531',
  }),
  // set_path_search_max_polygons (cpp:539-542) is a bare assignment; the hint at
  // :167 ("0,4096,1,or_greater") gives an advisory floor of 0.
  path_search_max_polygons: v.int('path_search_max_polygons', {
    min: 0,
    message: "Property 'path_search_max_polygons' must be >= 0.",
    hinted: 'navigation_agent_3d.cpp:167',
  }),
  // set_path_search_max_distance (cpp:548-551) CLAMPS: `path_search_max_distance = MAX(0.0, p_distance);`
  // — carries NO PROPERTY_HINT_RANGE at all (:168 has no hint string), so the
  // hint-vs-enforced split does not even apply: the bound is entirely from the
  // clamp.
  path_search_max_distance: v.float('path_search_max_distance', {
    min: 0,
    message: "Property 'path_search_max_distance' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:549',
  }),

  // --- Avoidance ---

  avoidance_enabled: v.boolean('avoidance_enabled'),
  // navigation_agent_3d.cpp:776-779 is a bare assignment (VECTOR3, USAGE_NO_EDITOR
  // at :172 — still serialises, object.h:132); no bound beyond the literal's shape.
  velocity: v.vector3('velocity'),
  // Two tiers on the floor. navigation_agent_3d.cpp:618,
  // `ERR_FAIL_COND_MSG(p_height < 0.0, "Height must be positive.")` refuses
  // below 0; the hint (:173, "0.01,100,0.01,or_greater,suffix:m") floors at
  // 0.01, so [0, 0.01) loads and only warns. `or_greater` opens the ceiling.
  height: v.float('height', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:618' },
    hinted: { min: 'navigation_agent_3d.cpp:173' },
  }),
  // Same split as `height`. navigation_agent_3d.cpp:608,
  // `ERR_FAIL_COND_MSG(p_radius < 0.0, "Radius must be positive.")`; the hint
  // (:174, "0.01,100,0.01,or_greater,suffix:m") floors at 0.01.
  radius: v.float('radius', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:608' },
    hinted: { min: 'navigation_agent_3d.cpp:174' },
  }),
  // set_neighbor_distance (cpp:645-652) is a bare assignment; the hint at :175
  // ("0.1,10000,0.01,or_greater") gives an advisory floor of 0.1.
  neighbor_distance: v.float('neighbor_distance', {
    min: 0.1,
    message: "Property 'neighbor_distance' must be >= 0.1.",
    hinted: 'navigation_agent_3d.cpp:175',
  }),
  // set_max_neighbors (cpp:655-663) is a bare assignment; the hint at :176
  // ("1,10000,1,or_greater") gives the real floor of 1, not 0.
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
  // Same split as `height`/`radius`. navigation_agent_3d.cpp:684,
  // `ERR_FAIL_COND_MSG(p_max_speed < 0.0, "Max speed must be positive.")`; the
  // hint (:179, "0.01,10000,0.01,or_greater,suffix:m/s") floors at 0.01.
  max_speed: v.float('max_speed', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_3d.cpp:684' },
    hinted: { min: 'navigation_agent_3d.cpp:179' },
  }),
  // set_use_3d_avoidance (cpp:630-634) is a bare assignment (plus a
  // notify_property_list_changed call that only re-runs _validate_property's
  // inspector-visibility toggle on keep_y_velocity, cpp:346-351 — an editor
  // display concern, not a value constraint). No hint at all (:180). 3D-only:
  // no 2D NavigationAgent2D counterpart.
  use_3d_avoidance: v.boolean('use_3d_avoidance'),
  // set_keep_y_velocity (cpp:636-639) is a bare assignment (plus a
  // stored_y_velocity reset, an internal simulation field this validator never
  // sees). No hint at all (:181). 3D-only: no 2D NavigationAgent2D counterpart.
  keep_y_velocity: v.boolean('keep_y_velocity'),
  // Bare uint32_t assignment (set_avoidance_layers, cpp:1003-1006); PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :182 is a UI-control hint, not a range.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_agent_3d.cpp:182', width: 'uint32' /* navigation_agent_3d.h:251 */ }),
  // Bare uint32_t assignment (set_avoidance_mask, cpp:1012-1015); PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :183 is a UI-control hint, not a range.
  avoidance_mask: layerBitmask('avoidance_mask', { hinted: 'navigation_agent_3d.cpp:183', width: 'uint32' /* navigation_agent_3d.h:254 */ }),
  // navigation_agent_3d.cpp:1057-1062, ERR_FAIL_COND_MSG(p_priority < 0.0, ...) at
  // :1058 and ERR_FAIL_COND_MSG(p_priority > 1.0, ...) at :1059 — both ends refused
  // by the setter, matching the hint's own "0.0,1.0,0.01" exactly.
  avoidance_priority: v.float('avoidance_priority', {
    min: 0,
    max: 1,
    message: "Property 'avoidance_priority' must be between 0.0 and 1.0 inclusive.",
    enforced: { min: 'navigation_agent_3d.cpp:1058', max: 'navigation_agent_3d.cpp:1059' },
  }),

  // --- Debug ---

  // navigation_agent_3d.cpp:1070-1079 is a bare assignment (inside
  // `#ifdef DEBUG_ENABLED`, which every editor build defines); no bound. The
  // editor (which is what saves a .tscn) always builds with DEBUG_ENABLED, so
  // this is the practical serialisation path for the whole Debug group.
  debug_enabled: v.boolean('debug_enabled'),
  debug_use_custom: v.boolean('debug_use_custom'),
  // navigation_agent_3d.cpp:1100-1109 is a bare Color assignment (DEBUG_ENABLED-gated);
  // no bound, just the literal's shape.
  debug_path_custom_color: v.color('debug_path_custom_color'),
  // set_debug_path_custom_point_size (cpp:1115-1124, DEBUG_ENABLED-gated)
  // CLAMPS: `debug_path_custom_point_size = MAX(0.0, p_point_size);` at :1121.
  debug_path_custom_point_size: v.float('debug_path_custom_point_size', {
    min: 0,
    message: "Property 'debug_path_custom_point_size' must be >= 0.",
    enforced: 'navigation_agent_3d.cpp:1121',
  }),
});
