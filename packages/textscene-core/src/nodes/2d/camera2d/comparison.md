---
type: Camera2D
category: 2D
fixture: unit-remote-transform-2d.tscn
image: unit-remote-transform-2d
renders_as: a 2D view frame with no drawn geometry
---

# Camera2D

Camera2D is a Node2D that defines the 2D view — which slice of the canvas the
viewport shows. The previewer draws no geometry for it; it only tags its group so
the Cameras panel can frame the view through it. The camera's outline is an
editor-only gizmo, drawn in neither capture. This fixture contains no Camera2D
node at all: what fills the frame is the fixture's two Polygon2D pentagons, the
blue one dragged up to the right by a RemoteTransform2D relay while the grey ghost
stays at the authored spot. Nothing on screen exercises Camera2D.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| — | — | the fixture defines no Camera2D node, so no Camera2D property is set or exercised |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Camera2D -->
Strict parsing format-checks these `Camera2D` properties, plus 18 inherited from Node2D. Every validator failure is an **error**.

| Property |
| --- |
| `anchor_mode` |
| `drag_bottom_margin` |
| `drag_horizontal_enabled` |
| `drag_horizontal_offset` |
| `drag_left_margin` |
| `drag_right_margin` |
| `drag_top_margin` |
| `drag_vertical_enabled` |
| `drag_vertical_offset` |
| `editor_draw_drag_margin` |
| `editor_draw_limits` |
| `editor_draw_screen` |
| `enabled` |
| `ignore_rotation` |
| `limit_bottom` |
| `limit_enabled` |
| `limit_left` |
| `limit_right` |
| `limit_smoothed` |
| `limit_top` |
| `offset` |
| `position_smoothing_enabled` |
| `position_smoothing_speed` |
| `process_callback` |
| `rotation_smoothing_enabled` |
| `rotation_smoothing_speed` |
| `zoom` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-camera2d-properties` | `camera2d-multiple-enabled` | warning |
|  | `camera2d-invalid-zoom` | error |
|  | `camera2d-invalid-horizontal-limits` | warning |
|  | `camera2d-invalid-vertical-limits` | warning |
|  | `camera2d-smoothing-speed-missing` | warning |
|  | `camera2d-smoothing-speed-invalid` | warning |
|  | `camera2d-rotation-smoothing-speed-missing` | warning |
|  | `camera2d-rotation-smoothing-speed-invalid` | warning |
|  | `camera2d-horizontal-margins-without-drag` | warning |
|  | `camera2d-vertical-margins-without-drag` | warning |
|  | `camera2d-horizontal-offset-without-drag` | warning |
|  | `camera2d-vertical-offset-without-drag` | warning |
<!-- lint:end -->

Strict rejects a non-positive `zoom` component as `INVALID_ZOOM_VALUE`; the lenient parser's
`vec2Or` only re-checks the `Vector2(x, y)` grammar, so `Vector2(0, 0)` or a negative zoom
parses through unchanged and renders as authored, falling back to `(1, 1)` only when the
property is missing or the grammar itself fails to match. `anchor_mode` falls back to
`DRAG_CENTER` (`1`), `limit_left`/`limit_top`/`limit_right`/`limit_bottom` fall back to
`-10000000`/`-10000000`/`10000000`/`10000000`, `limit_enabled` falls back to `true`, and
`offset` falls back to `(0, 0)`, each warning first if present but unparseable. `enabled` skips
that family entirely: any value other than the literal string `'false'` is treated as true, and
it defaults to `true` when absent. `ignore_rotation`, `process_callback`, `limit_smoothed`,
every smoothing and drag property, and the `editor_draw_*` flags are validated by strict but
never read by the lenient parser at all, consistent with Camera2D drawing no geometry in the
previewer.
