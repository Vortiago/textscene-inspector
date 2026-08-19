/**
 * NavigationAgent2D strict validators for linting.
 *
 * Declare only NavigationAgent2D's OWN members — the ones doc/classes/NavigationAgent2D.xml
 * lists without an `overrides=` attribute. Everything from Node up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * NavigationAgent2D's base is plain `Node` (nodeBaseTypes.generated.ts), not
 * Node2D — it steers a Node2D-inheriting PARENT rather than being one itself
 * (see linter.ts for the parent-type warning that follows from that).
 *
 * The 30 members below are every `ADD_PROPERTY` in
 * `navigation_agent_2d.cpp:143-188` (three groups: Pathfinding, Avoidance,
 * Debug); none carries `overrides=` in the XML. Several setters here call
 * `ERR_FAIL_COND` or clamp with `MAX(0.0, …)` where the sibling `PROPERTY_HINT_RANGE`
 * suggests a laxer or absent bound — each citation below points at the actual
 * setter body, not the hint, per ADR-0032.
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { hintedBitField, layerBitmask, v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('NavigationAgent2D', {
  // --- Pathfinding ---

  // navigation_agent_2d.cpp:144, VECTOR2 hinted PROPERTY_HINT_NONE (USAGE_NO_EDITOR
  // still serialises it, object.h:132). set_target_position (cpp:641-649) is a
  // bare assignment; no bound to check beyond the literal's shape.
  target_position: v.vector2('target_position'),
  // navigation_agent_2d.cpp:554-560 is a bare assignment (only an equal-check
  // early return); the hint at :145 ("0.1,1000,0.01,or_greater") gives the real
  // floor of 0.1, not 0.
  path_desired_distance: v.float('path_desired_distance', {
    min: 0.1,
    message: "Property 'path_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_2d.cpp:145',
  }),
  // navigation_agent_2d.cpp:562-568 is a bare assignment; the hint at :146
  // ("0.1,1000,0.01,or_greater") gives the real floor of 0.1, not 0.
  target_desired_distance: v.float('target_desired_distance', {
    min: 0.1,
    message: "Property 'target_desired_distance' must be >= 0.1.",
    hinted: 'navigation_agent_2d.cpp:146',
  }),
  // navigation_agent_2d.cpp:629-635 is a bare assignment; the hint at :147
  // ("10,1000,1,or_greater") gives the real floor of 10, not 0.
  path_max_distance: v.float('path_max_distance', {
    min: 10,
    message: "Property 'path_max_distance' must be >= 10.",
    hinted: 'navigation_agent_2d.cpp:147',
  }),
  // Bare uint32_t assignment (set_navigation_layers, cpp:412-422): the
  // parameter type is the ceiling, and PROPERTY_HINT_LAYERS_2D_NAVIGATION (:148)
  // is a UI-control hint, not a range.
  navigation_layers: layerBitmask('navigation_layers', { hinted: 'navigation_agent_2d.cpp:148', width: 'uint32' /* navigation_agent_2d.h:132 */ }),
  // set_pathfinding_algorithm (cpp:446-454) is a bare assignment (plus an
  // equal-check). The HINT_ENUM at :149 lists a single value, "AStar" — the
  // only member of NavigationPathQueryParameters2D::PathfindingAlgorithm
  // (navigation_path_query_parameters_2d.h:43-45).
  pathfinding_algorithm: v.enumInt(
    'pathfinding_algorithm',
    0,
    0,
    { 0: 'PATHFINDING_ALGORITHM_ASTAR' },
    { hinted: 'navigation_agent_2d.cpp:149' }
  ),
  // set_path_postprocessing (cpp:456-464) is a bare assignment (plus an
  // equal-check). HINT_ENUM at :150 ("Corridorfunnel,Edgecentered,None") matches
  // PathPostProcessing 0-2 (navigation_path_query_parameters_2d.h:47-51).
  path_postprocessing: v.enumInt(
    'path_postprocessing',
    0,
    2,
    {
      0: 'PATH_POSTPROCESSING_CORRIDORFUNNEL',
      1: 'PATH_POSTPROCESSING_EDGECENTERED',
      2: 'PATH_POSTPROCESSING_NONE',
    },
    { hinted: 'navigation_agent_2d.cpp:150' }
  ),
  // set_path_metadata_flags (cpp:524-530) is a bare BitField assignment — no
  // `p_flags & MASK`, so every bit the caller sets is kept, not just the three
  // HINT_FLAGS names at :151 ("Include Types,Include RIDs,Include Owners" = 1|2|4,
  // navigation_constants_2d.h:52-54). A bit outside 1|2|4 loads and runs but is
  // unreachable from the inspector, which is `hintedBitField`'s warning tier.
  path_metadata_flags: hintedBitField('path_metadata_flags', {
    hinted: 'navigation_agent_2d.cpp:151',
    labels: {
      1: 'PATH_METADATA_INCLUDE_TYPES',
      2: 'PATH_METADATA_INCLUDE_RIDS',
      4: 'PATH_METADATA_INCLUDE_OWNERS',
    },
  }),
  simplify_path: v.boolean('simplify_path'),
  // set_simplify_epsilon (cpp:475-478) CLAMPS: `simplify_epsilon = MAX(0.0, p_epsilon);`
  // — the setter alters an out-of-range value rather than merely being hinted
  // against it, so this is an ERROR (ADR-0032), not the hint's advisory tier.
  simplify_epsilon: v.float('simplify_epsilon', {
    min: 0,
    message: "Property 'simplify_epsilon' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:476',
  }),
  // set_path_return_max_length (cpp:484-487) CLAMPS: `path_return_max_length = MAX(0.0, p_length);`
  path_return_max_length: v.float('path_return_max_length', {
    min: 0,
    message: "Property 'path_return_max_length' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:485',
  }),
  // set_path_return_max_radius (cpp:493-496) CLAMPS: `path_return_max_radius = MAX(0.0, p_radius);`
  path_return_max_radius: v.float('path_return_max_radius', {
    min: 0,
    message: "Property 'path_return_max_radius' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:494',
  }),
  // set_path_search_max_polygons (cpp:502-505) is a bare assignment; the hint at
  // :156 ("0,4096,1,or_greater") gives an advisory floor of 0.
  path_search_max_polygons: v.int('path_search_max_polygons', {
    min: 0,
    message: "Property 'path_search_max_polygons' must be >= 0.",
    hinted: 'navigation_agent_2d.cpp:156',
  }),
  // set_path_search_max_distance (cpp:511-514) CLAMPS: `path_search_max_distance = MAX(0.0, p_distance);`
  // — carries NO PROPERTY_HINT_RANGE at all (:157 has no hint string), so the
  // hint-vs-enforced split does not even apply: the bound is entirely from the
  // clamp.
  path_search_max_distance: v.float('path_search_max_distance', {
    min: 0,
    message: "Property 'path_search_max_distance' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:512',
  }),

  // --- Avoidance ---

  avoidance_enabled: v.boolean('avoidance_enabled'),
  // navigation_agent_2d.cpp:712-715 is a bare assignment (VECTOR2, USAGE_NO_EDITOR
  // at :161 — still serialises, object.h:132); no bound beyond the literal's shape.
  velocity: v.vector2('velocity'),
  // Two tiers on the floor. navigation_agent_2d.cpp:571,
  // `ERR_FAIL_COND_MSG(p_radius < 0.0, "Radius must be positive.")` refuses
  // below 0; the hint (:162, "0.01,500,0.01,or_greater,suffix:px") floors at
  // 0.01, so [0, 0.01) loads and only warns. `or_greater` opens the ceiling.
  radius: v.float('radius', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_2d.cpp:571' },
    hinted: { min: 'navigation_agent_2d.cpp:162' },
  }),
  // set_neighbor_distance (cpp:581-589) is a bare assignment; the hint at :163
  // ("0.1,100000,0.01,or_greater") gives an advisory floor of 0.1.
  neighbor_distance: v.float('neighbor_distance', {
    min: 0.1,
    message: "Property 'neighbor_distance' must be >= 0.1.",
    hinted: 'navigation_agent_2d.cpp:163',
  }),
  // set_max_neighbors (cpp:591-599) is a bare assignment; the hint at :164
  // ("1,10000,1,or_greater") gives the real floor of 1, not 0.
  max_neighbors: v.int('max_neighbors', {
    min: 1,
    message: "Property 'max_neighbors' must be >= 1.",
    hinted: 'navigation_agent_2d.cpp:164',
  }),
  // navigation_agent_2d.cpp:601-608, ERR_FAIL_COND_MSG(p_time_horizon < 0.0, "Time horizon must be positive.").
  time_horizon_agents: v.float('time_horizon_agents', {
    min: 0,
    message: "Property 'time_horizon_agents' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:602',
  }),
  // navigation_agent_2d.cpp:610-617, ERR_FAIL_COND_MSG(p_time_horizon < 0.0, "Time horizon must be positive.").
  time_horizon_obstacles: v.float('time_horizon_obstacles', {
    min: 0,
    message: "Property 'time_horizon_obstacles' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:611',
  }),
  // Two tiers on the floor. navigation_agent_2d.cpp:620,
  // `ERR_FAIL_COND_MSG(p_max_speed < 0.0, "Max speed must be positive.")`
  // refuses below 0; the hint (:167, "0.01,100000,0.01,or_greater,suffix:px/s")
  // floors at 0.01, so [0, 0.01) loads and only warns. `or_greater` opens the
  // ceiling.
  max_speed: v.float('max_speed', {
    enforcedMin: { at: 0 },
    min: 0.01,
    enforced: { min: 'navigation_agent_2d.cpp:620' },
    hinted: { min: 'navigation_agent_2d.cpp:167' },
  }),
  // Bare uint32_t assignment (set_avoidance_layers, cpp:932-935); PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :168 is a UI-control hint, not a range.
  avoidance_layers: layerBitmask('avoidance_layers', { hinted: 'navigation_agent_2d.cpp:168', width: 'uint32' /* navigation_agent_2d.h:229 */ }),
  // Bare uint32_t assignment (set_avoidance_mask, cpp:941-944); PROPERTY_HINT_LAYERS_AVOIDANCE
  // at :169 is a UI-control hint, not a range.
  avoidance_mask: layerBitmask('avoidance_mask', { hinted: 'navigation_agent_2d.cpp:169', width: 'uint32' /* navigation_agent_2d.h:232 */ }),
  // navigation_agent_2d.cpp:986-991, ERR_FAIL_COND_MSG(p_priority < 0.0, ...) at
  // :987 and ERR_FAIL_COND_MSG(p_priority > 1.0, ...) at :988 — both ends refused
  // by the setter, matching the hint's own "0.0,1.0,0.01" exactly.
  avoidance_priority: v.float('avoidance_priority', {
    min: 0,
    max: 1,
    message: "Property 'avoidance_priority' must be between 0.0 and 1.0 inclusive.",
    enforced: { min: 'navigation_agent_2d.cpp:987', max: 'navigation_agent_2d.cpp:988' },
  }),

  // --- Debug ---

  debug_enabled: v.boolean('debug_enabled'),
  debug_use_custom: v.boolean('debug_use_custom'),
  // navigation_agent_2d.cpp:1029-1038 is a bare Color assignment (inside
  // `#ifdef DEBUG_ENABLED`, which every editor build defines); no bound, just
  // the literal's shape.
  debug_path_custom_color: v.color('debug_path_custom_color'),
  // set_debug_path_custom_point_size (cpp:1044-1053, `#ifdef DEBUG_ENABLED`)
  // CLAMPS: `debug_path_custom_point_size = MAX(0.0, p_point_size);` at :1050.
  // The editor (which is what saves a .tscn) always builds with DEBUG_ENABLED,
  // so this is the practical serialisation path.
  debug_path_custom_point_size: v.float('debug_path_custom_point_size', {
    min: 0,
    message: "Property 'debug_path_custom_point_size' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:1050',
  }),
  // set_debug_path_custom_line_width (cpp:1059-1068, `#ifdef DEBUG_ENABLED`) is a
  // bare assignment — no clamp, unlike its point-size sibling. The hint at :188
  // ("-1,50,0.01,or_greater") gives an advisory floor of -1 (the default sentinel
  // meaning "use the global line width").
  debug_path_custom_line_width: v.float('debug_path_custom_line_width', {
    min: -1,
    message: "Property 'debug_path_custom_line_width' must be >= -1.",
    hinted: 'navigation_agent_2d.cpp:188',
  }),

  // --- Pre-4.0-beta-1X spellings (navigation_agent_2d.cpp:198-224) ---

  // navigation_agent_2d.cpp:206 hands `p_value` straight to set_target_position,
  // so the slot takes the same unconstrained Vector2 `target_position` takes.
  target_location: v.vector2('target_location'),
  // navigation_agent_2d.cpp:202 hands `p_value` straight to
  // set_time_horizon_agents, whose ERR_FAIL_COND_MSG (:602) refuses a negative
  // value — the same enforced floor `time_horizon_agents` carries, under the
  // name the scene spells.
  time_horizon: v.float('time_horizon', {
    min: 0,
    message: "Property 'time_horizon' must be >= 0.",
    enforced: 'navigation_agent_2d.cpp:602',
  }),
});
