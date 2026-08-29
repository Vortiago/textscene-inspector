---
type: NavigationAgent2D
category: 2D
status: linter-only
fixture: unit-navigation-agent-2d.tscn
# image: unit-navigation-agent-2d
visual: false
renders_as: nothing (a transform-only group)
---

# NavigationAgent2D

A 2D pathfinding/avoidance helper that steers its Node2D parent toward a target;
it has no runtime visual of its own — only an editor-only debug path draw — so
drawing NOTHING here is correct, not a gap: the absence is the useful fact.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `target_position` | `Vector2(100, 50)` | none — pathfinding target, not drawn |
| `path_desired_distance` | `15.0` | none — waypoint-arrival tuning, not drawn |
| `target_desired_distance` | `8.0` | none — target-arrival tuning, not drawn |
| `path_max_distance` | `50.0` | none — repath tuning, not drawn |
| `navigation_layers` | `4` | none — nav-mesh query layers, not drawn |
| `pathfinding_algorithm` | `0` (AStar) | none — query tuning, not drawn |
| `path_postprocessing` | `1` (Edgecentered) | none — query tuning, not drawn |
| `path_metadata_flags` | `7` (Types\|RIDs\|Owners) | none — query tuning, not drawn |
| `simplify_path` | `true` | none — query tuning, not drawn |
| `simplify_epsilon` | `1.0` | none — query tuning, not drawn |
| `path_return_max_length` | `100.0` | none — query tuning, not drawn |
| `path_return_max_radius` | `50.0` | none — query tuning, not drawn |
| `path_search_max_polygons` | `2048` | none — query tuning, not drawn |
| `path_search_max_distance` | `20.0` | none — query tuning, not drawn |
| `avoidance_enabled` | `true` | none — avoidance is a simulation flag, no runtime visual |
| `velocity` | `Vector2(10, 0)` | none — avoidance-input state, not drawn |
| `radius` | `12.0` | none — avoidance radius, not drawn |
| `neighbor_distance` | `300.0` | none — avoidance tuning, not drawn |
| `max_neighbors` | `5` | none — avoidance tuning, not drawn |
| `time_horizon_agents` | `1.5` | none — avoidance tuning, not drawn |
| `time_horizon_obstacles` | `0.5` | none — avoidance tuning, not drawn |
| `max_speed` | `150.0` | none — avoidance tuning, not drawn |
| `avoidance_layers` | `2` | none — avoidance layer mask, not drawn |
| `avoidance_mask` | `3` | none — avoidance mask, not drawn |
| `avoidance_priority` | `0.5` | none — avoidance tuning, not drawn |
| `debug_enabled` | `true` | none — gates an editor-only debug draw the previewer never runs |
| `debug_use_custom` | `true` | none — debug-draw styling, not drawn |
| `debug_path_custom_color` | `Color(1, 0, 0, 1)` | none — debug-draw styling, not drawn |
| `debug_path_custom_point_size` | `5.0` | none — debug-draw styling, not drawn |
| `debug_path_custom_line_width` | `2.0` | none — debug-draw styling, not drawn |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin NavigationAgent2D -->
Strict parsing format-checks these `NavigationAgent2D` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |  |
| `avoidance_mask` | 32-bit layer mask (layers 1-32) |  |
| `avoidance_priority` | float 0-1 | error |
| `debug_enabled` | true or false |  |
| `debug_path_custom_color` | Color(r, g, b, a) |  |
| `debug_path_custom_line_width` | float >= -1 | warning below |
| `debug_path_custom_point_size` | float >= 0 | error below |
| `debug_use_custom` | true or false |  |
| `max_neighbors` | integer >= 1 | warning below |
| `max_speed` | float >= 0.01 | error below 0, warning below 0.01 |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `neighbor_distance` | float >= 0.1 | warning below |
| `path_desired_distance` | float >= 0.1 | warning below |
| `path_max_distance` | float >= 10 | warning below |
| `path_metadata_flags` | bit mask of PATH_METADATA_INCLUDE_TYPES (1) \| PATH_METADATA_INCLUDE_RIDS (2) \| PATH_METADATA_INCLUDE_OWNERS (4) |  |
| `path_postprocessing` | enum 0-2 (PATH_POSTPROCESSING_CORRIDORFUNNEL/PATH_POSTPROCESSING_EDGECENTERED/PATH_POSTPROCESSING_NONE) | warning |
| `path_return_max_length` | float >= 0 | error below |
| `path_return_max_radius` | float >= 0 | error below |
| `path_search_max_distance` | float >= 0 | error below |
| `path_search_max_polygons` | integer >= 0 | warning below |
| `pathfinding_algorithm` | enum 0-0 (PATHFINDING_ALGORITHM_ASTAR) | warning |
| `radius` | float >= 0.01 | error below 0, warning below 0.01 |
| `simplify_epsilon` | float >= 0 | error below |
| `simplify_path` | true or false |  |
| `target_desired_distance` | float >= 0.1 | warning below |
| `target_location` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `target_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `time_horizon` | float >= 0 | error below |
| `time_horizon_agents` | float >= 0 | error below |
| `time_horizon_obstacles` | float >= 0 | error below |
| `velocity` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-navigationagent2d` | `navigationagent2d-parent-not-node2d` | warning |
<!-- lint:end -->

The lenient parser (`index.ts`) reuses the generic `parseNode` rather than a
bespoke per-property parse, because nothing downstream ever reads
NavigationAgent2D's own properties (no propertyFormatter, no renderer input) —
so it does not read radius, target_position, or any of the other 30 keys at
all. A `radius` of `-5` or a malformed `target_position` therefore has no
effect on the parsed tree either way; only strict's `linterParser.ts` sees
these values at all, which is why every bound above is enforced there alone.
