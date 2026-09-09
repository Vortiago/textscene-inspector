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

NavigationAgent2D steers its Node2D parent along a navigation path. It has no runtime
visual, only an editor debug path, so the previewer draws nothing for it and that
absence is correct.

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
| `target_position` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `time_horizon_agents` | float >= 0 | error below |
| `time_horizon_obstacles` | float >= 0 | error below |
| `velocity` | Vector2(x, y), or the Vector2i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-navigationagent2d` | `navigationagent2d-parent-not-node2d` | warning |
<!-- lint:end -->

The lenient parser reuses the generic `parseNode`, so none of the thirty agent keys is
read. A `radius` of `-5` or a malformed `target_position` changes nothing in the parsed
tree. Only strict sees these values.
