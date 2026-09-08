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

A pathfinding and avoidance helper that steers its parent body toward a target. It has no runtime visual, only an editor path debug draw, so the previewer draws nothing for it and both images show the empty preview scene.

## Linting

<!-- lint:begin NavigationAgent3D -->
Strict parsing format-checks these `NavigationAgent3D` properties, plus 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `avoidance_enabled` | true or false |  |
| `avoidance_layers` | 32-bit layer mask (layers 1-32) |  |
| `avoidance_mask` | 32-bit layer mask (layers 1-32) |  |
| `avoidance_priority` | float 0-1 | error |
| `debug_enabled` | true or false |  |
| `debug_path_custom_color` | Color(r, g, b, a) |  |
| `debug_path_custom_point_size` | float >= 0 | error below |
| `debug_use_custom` | true or false |  |
| `height` | float >= 0.01 | error below 0, warning below 0.01 |
| `keep_y_velocity` | true or false |  |
| `max_neighbors` | integer >= 1 | warning below |
| `max_speed` | float >= 0.01 | error below 0, warning below 0.01 |
| `navigation_layers` | 32-bit layer mask (layers 1-32) |  |
| `neighbor_distance` | float >= 0.1 | warning below |
| `path_desired_distance` | float >= 0.1 | warning below |
| `path_height_offset` | float >= -100 | warning below |
| `path_max_distance` | float >= 0.01 | warning below |
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
| `target_position` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |
| `time_horizon_agents` | float >= 0 | error below |
| `time_horizon_obstacles` | float >= 0 | error below |
| `use_3d_avoidance` | true or false |  |
| `velocity` | Vector3(x, y, z), or the Vector3i spelling Godot converts |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-navigationagent3d` | `navigationagent3d-parent-not-node3d` | warning |
<!-- lint:end -->

The lenient parser reads eleven keys: `radius`, `height`, `avoidance_enabled`, `avoidance_layers`, `avoidance_mask`, `max_neighbors`, `max_speed`, `navigation_layers`, `target_desired_distance`, `path_desired_distance` and `target_position`. The ten scalars use the optional readers, so a `radius` of `-5` passes through unchanged, and `target_position` warns and stays unset on a malformed `Vector3`. The other 22 keys reach no reader at all.

## Known limitations

- **Editor only** The path debug draw appears only in Godot's editor. Here it is absent.
