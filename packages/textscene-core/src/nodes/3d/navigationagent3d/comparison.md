---
type: NavigationAgent3D
category: 3D
status: linter-only
fixture: unit-navigation-agent-3d.tscn
image: unit-navigation-agent-3d
visual: false
renders_as: nothing (non-visual navigation helper)
---

# NavigationAgent3D

A pathfinding and avoidance helper that steers its parent body toward a target. It
has no runtime visual — only an editor-only path debug draw — so the previewer draws
nothing for it. Both images show only the sky gradient over brown ground; the
sibling `CollisionShape3D` is toggle-gated (ADR-0005/0006) and also absent.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `target_position` | `Vector3(1, 2, 3)` | none — pathfinding target, not drawn |
| `path_desired_distance` | `1.0` | none — waypoint-arrival tuning, not drawn |
| `target_desired_distance` | `1.5` | none — target-arrival tuning, not drawn |
| `path_height_offset` | `0.0` | none — path-position offset, not drawn |
| `path_max_distance` | `5.0` | none — repath tuning, not drawn |
| `navigation_layers` | `1` | none — nav-mesh query layers, not drawn |
| `pathfinding_algorithm` | `0` (AStar) | none — query tuning, not drawn |
| `path_postprocessing` | `0` (Corridorfunnel) | none — query tuning, not drawn |
| `path_metadata_flags` | `7` (Types\|RIDs\|Owners) | none — query tuning, not drawn |
| `simplify_path` | `true` | none — query tuning, not drawn |
| `simplify_epsilon` | `0.0` | none — query tuning, not drawn |
| `path_return_max_length` | `0.0` | none — query tuning, not drawn |
| `path_return_max_radius` | `0.0` | none — query tuning, not drawn |
| `path_search_max_polygons` | `4096` | none — query tuning, not drawn |
| `path_search_max_distance` | `0.0` | none — query tuning, not drawn |
| `avoidance_enabled` | `true` | none — avoidance is a simulation flag, no runtime visual |
| `velocity` | `Vector3(0, 0, 0)` | none — avoidance-input state, not drawn |
| `height` | `1.8` | none — avoidance height, not drawn |
| `radius` | `0.4` | none — avoidance radius, not drawn |
| `neighbor_distance` | `50.0` | none — avoidance tuning, not drawn |
| `max_neighbors` | `1` | none — avoidance tuning, not drawn |
| `time_horizon_agents` | `1.0` | none — avoidance tuning, not drawn |
| `time_horizon_obstacles` | `0.0` | none — avoidance tuning, not drawn |
| `max_speed` | `10.0` | none — avoidance tuning, not drawn |
| `use_3d_avoidance` | `false` | none — avoidance dimensionality flag, not drawn |
| `keep_y_velocity` | `true` | none — avoidance tuning, not drawn |
| `avoidance_layers` | `1` | none — avoidance layer mask, not drawn |
| `avoidance_mask` | `1` | none — avoidance mask, not drawn |
| `avoidance_priority` | `1.0` | none — avoidance tuning, not drawn |
| `debug_enabled` | `false` | none — gates an editor-only debug draw the previewer never runs |
| `debug_use_custom` | `false` | none — debug-draw styling, not drawn |
| `debug_path_custom_color` | `Color(1, 1, 1, 1)` | none — debug-draw styling, not drawn |
| `debug_path_custom_point_size` | `4.0` | none — debug-draw styling, not drawn |

## Divergences

`use_3d_avoidance`, `keep_y_velocity` and `path_height_offset` are 3D-only —
NavigationAgent2D has no such members. The reverse also holds:
NavigationAgent2D's Debug group carries `debug_path_custom_line_width`, which
NavigationAgent3D's own Debug group (`navigation_agent_3d.cpp:203-206`, four
members only) does not bind at all.

## Linting

<!-- lint:begin NavigationAgent3D -->
Strict parsing format-checks these `NavigationAgent3D` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) | warning |
| `avoidance_mask` | 32-bit layer mask (layers 1-32) | warning |
| `avoidance_priority` | float 0-1 | error |
| `debug_enabled` | true or false |  |
| `debug_path_custom_color` | Color(r, g, b, a) |  |
| `debug_path_custom_point_size` | float >= 0 | error |
| `debug_use_custom` | true or false |  |
| `height` | float >= 0 | error |
| `keep_y_velocity` | true or false |  |
| `max_neighbors` | integer >= 1 | warning |
| `max_speed` | float >= 0 | error |
| `navigation_layers` | 32-bit layer mask (layers 1-32) | warning |
| `neighbor_distance` | float >= 0.1 | warning |
| `path_desired_distance` | float >= 0.1 | warning |
| `path_height_offset` | float >= -100 | warning |
| `path_max_distance` | float >= 0.01 | warning |
| `path_metadata_flags` | bit mask of PATH_METADATA_INCLUDE_TYPES (1) | PATH_METADATA_INCLUDE_RIDS (2) | PATH_METADATA_INCLUDE_OWNERS (4) | warning |
| `path_postprocessing` | enum 0-2 (PATH_POSTPROCESSING_CORRIDORFUNNEL/PATH_POSTPROCESSING_EDGECENTERED/PATH_POSTPROCESSING_NONE) | warning |
| `path_return_max_length` | float >= 0 | error |
| `path_return_max_radius` | float >= 0 | error |
| `path_search_max_distance` | float >= 0 | error |
| `path_search_max_polygons` | integer >= 0 | warning |
| `pathfinding_algorithm` | enum 0-0 (PATHFINDING_ALGORITHM_ASTAR) | warning |
| `radius` | float >= 0 | error |
| `simplify_epsilon` | float >= 0 | error |
| `simplify_path` | true or false |  |
| `target_desired_distance` | float >= 0.1 | warning |
| `target_position` | Vector3(x, y, z) |  |
| `time_horizon_agents` | float >= 0 | error |
| `time_horizon_obstacles` | float >= 0 | error |
| `use_3d_avoidance` | true or false |  |
| `velocity` | Vector3(x, y, z) |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-navigationagent3d` | `navigationagent3d-parent-not-node3d` | warning |
<!-- lint:end -->

The lenient parser (`parser.ts`) only ever read eleven of the class's now 33
strict-validated members: `radius`, `height`, `avoidance_enabled`,
`avoidance_layers`, `avoidance_mask`, `max_neighbors`, `max_speed`,
`navigation_layers`, `target_desired_distance`, `path_desired_distance` and
`target_position`. The ten scalars use the optional readers: absent or
unparseable values leave the property unset, silently, with no warning, and
none of strict's `min: 0` checks apply, so a `radius` of `-5` parses through
unchanged. `target_position` is the exception among those eleven: it parses
the `Vector3(...)` literal directly and warns (leaving the property unset) if
the literal is malformed. The other 22 keys this wave added strict validators
for — `path_height_offset`, `path_max_distance`, `pathfinding_algorithm`,
`path_postprocessing`, `path_metadata_flags`, `simplify_path`,
`simplify_epsilon`, `path_return_max_length`, `path_return_max_radius`,
`path_search_max_polygons`, `path_search_max_distance`, `velocity`,
`neighbor_distance`, `time_horizon_agents`, `time_horizon_obstacles`,
`use_3d_avoidance`, `keep_y_velocity`, `avoidance_priority`, `debug_enabled`,
`debug_use_custom`, `debug_path_custom_color` and
`debug_path_custom_point_size` — reach no reader in `parser.ts` at all; nothing
downstream renders them, so `parseNode`'s generic base parse is all the
lenient path needs, and only `linterParser.ts` ever sees these values.
