---
type: VehicleWheel3D
category: 3D
status: unreviewed
fixture: unit-physics-vehicle.tscn
image: unit-physics-vehicle
renders_as: a transform group with a selection-gated wheel gizmo
---

# VehicleWheel3D

VehicleWheel3D positions one wheel of a VehicleBody3D. It draws no geometry at runtime in either engine, so the previewer mounts it as a transform group (ADR-0008) whose child mesh is the visible wheel. Each wheel lands at the same point in both frames.

## Linting

<!-- lint:begin VehicleWheel3D -->
Strict parsing format-checks these `VehicleWheel3D` properties, plus 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `brake` | float |  |
| `damping_compression` | float |  |
| `damping_relaxation` | float |  |
| `engine_force` | float |  |
| `steering` | radians, -180° to 180° | warning |
| `suspension_max_force` | float |  |
| `suspension_stiffness` | float |  |
| `suspension_travel` | float |  |
| `use_as_steering` | true or false |  |
| `use_as_traction` | true or false |  |
| `wheel_friction_slip` | float |  |
| `wheel_radius` | float |  |
| `wheel_rest_length` | float |  |
| `wheel_roll_influence` | float |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-vehiclewheel3d` | `vehiclewheel3d-not-under-vehicle-body` | warning |
<!-- lint:end -->

The lenient parser reads every strict-validated property, and an unauthored key stays `undefined` rather than taking Godot's default at parse time. The defaults are substituted where the value is consumed: the gizmo falls back to `wheel_radius = 0.5` and `wheel_rest_length = 0.15`, and the damping-pair rule compares against `damping_compression = 0.83` and `damping_relaxation = 0.88`.

## Known limitations

- **Editor only** Godot's editor draws the wheel gizmo for every wheel. Here it draws only for the selected node (ADR-0018).
