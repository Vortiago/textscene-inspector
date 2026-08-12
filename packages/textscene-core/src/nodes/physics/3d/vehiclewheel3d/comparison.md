---
type: VehicleWheel3D
category: 3D
status: unreviewed
fixture: unit-physics-vehicle.tscn
image: unit-physics-vehicle
renders_as: a transform group with a selection-gated wheel gizmo
---

# VehicleWheel3D

VehicleWheel3D positions one wheel of a VehicleBody3D. It draws no geometry at
runtime in either engine — the visible wheel is its child `MeshInstance3D` — so
the previewer mounts it as a transform group (ADR-0005/0008) that additionally
draws Godot's wheel gizmo.

Godot's editor draws that gizmo for **every** wheel at all times
(`vehicle_body_3d_gizmo_plugin.cpp`): a radius circle in the YZ plane, a
four-section spring coil, a suspension-travel line from the origin up to
`wheel_rest_length`, an axle tick at each end of it, and a forward arrow at
`y = −radius` pointing +Z. The previewer draws the same geometry but gates it on
selection (ADR-0018) — a four-wheeled vehicle would otherwise fill the viewport
with coils.

Neither frame below shows that gizmo: it is editor-only in Godot, and these
captures come from the runtime renderer, while ours is hidden with nothing
selected. Both engines therefore agree on what a wheel draws by itself — nothing
— and the `vehiclewheel3d-selected` golden is where our copy of the gizmo is
pinned instead.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `transform` | four distinct offsets around the chassis | places each wheel and its child mesh; the only property with a visual effect when nothing is selected |
| `wheel_radius` | `0.25` (Wheel1–3), `0.3` (Wheel4) | sizes the gizmo's radius circle and forward arrow; Wheel4's larger value makes the scaling visible |
| `wheel_rest_length` | `0.2` on Wheel1 | length of the gizmo's suspension-travel line (Godot default `0.15`) |
| `use_as_traction` | `true` on Wheel1–3 | physics-only; surfaced in the inspector's Drive section |
| `use_as_steering` | `true` on Wheel1 and Wheel3 | physics-only; the front pair |
| `wheel_roll_influence` | `0.4` | physics-only |
| `wheel_friction_slip` | `1.0` | physics-only |
| `suspension_travel` | `0.2` | physics-only; inside Godot's documented 0.1–0.3 range, so the fixture lints without advisories |
| `suspension_stiffness` | `40.0` | physics-only |
| `damping_compression` | `0.88` | physics-only |

## Divergences

None visible in this fixture — 70 of 721 980 pixels differ (0.010%), all of them
antialiasing along the chassis and wheel silhouettes. Each wheel places its mesh
at the same point in both engines.

The gizmo is a deliberate divergence from Godot's **editor**, not from the frames
above: Godot draws it for every wheel unconditionally, we draw it only for the
selected node (ADR-0018).

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-vehiclewheel3d` | `vehiclewheel3d-not-under-vehicle-body` | warning |
<!-- lint:end -->

The lenient parser reads every strict-validated property, so the two grammars
agree key for key. Unauthored keys stay `undefined` rather than being filled with
Godot's defaults at parse time — real wheels routinely leave `suspension_travel`
and `damping_relaxation` unset, and "authored the default" is a different fact
from "authored nothing". The defaults are substituted where the value is consumed
instead: the inspector shows the effective figure, the gizmo falls back to
`wheel_radius = 0.5` / `wheel_rest_length = 0.15`, and the damping-pair rule
compares against `damping_compression = 0.83` / `damping_relaxation = 0.88` so a
wheel that authors only one side is still checked (Godot's own pair satisfies the
recommendation, so a wheel authoring neither never warns).
