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

The two frames place both pentagons identically; one difference is visible, in the
blue fill rather than the layout:

- **The blue pentagon reads paler and less saturated in ours.** Godot writes the
  authored colour straight to the framebuffer (`0.2, 0.7, 0.9` gives `51, 178, 229`);
  ours renders `95, 191, 217`. See "Why 2D colours read paler in our captures" in docs/comparison/README.md.

## Linting

<!-- lint:begin Camera2D -->
Strict parsing format-checks these `Camera2D` properties, plus 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `anchor_mode` | enum 0-1 (FIXED_TOP_LEFT/DRAG_CENTER) | warning |
| `drag_bottom_margin` | float 0-1 | warning |
| `drag_horizontal_enabled` | true or false |  |
| `drag_horizontal_offset` | float -1-1 | warning |
| `drag_left_margin` | float 0-1 | warning |
| `drag_right_margin` | float 0-1 | warning |
| `drag_top_margin` | float 0-1 | warning |
| `drag_vertical_enabled` | true or false |  |
| `drag_vertical_offset` | float -1-1 | warning |
| `editor_draw_drag_margin` | true or false |  |
| `editor_draw_limits` | true or false |  |
| `editor_draw_screen` | true or false |  |
| `enabled` | true or false |  |
| `ignore_rotation` | true or false |  |
| `limit_bottom` | integer |  |
| `limit_enabled` | true or false |  |
| `limit_left` | integer |  |
| `limit_right` | integer |  |
| `limit_smoothed` | true or false |  |
| `limit_top` | integer |  |
| `offset` | Vector2(x, y) |  |
| `position_smoothing_enabled` | true or false |  |
| `position_smoothing_speed` | float >= 0 | error |
| `process_callback` | enum 0-1 (PHYSICS/IDLE) | warning |
| `rotation_smoothing_enabled` | true or false |  |
| `rotation_smoothing_speed` | float >= 0 | error |
| `zoom` | Vector2(x, y), neither component (near-)zero | error |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-camera2d-properties` | `camera2d-multiple-enabled` | warning |
|  | `camera2d-invalid-horizontal-limits` | warning |
|  | `camera2d-invalid-vertical-limits` | warning |
|  | `camera2d-smoothing-speed-zero` | warning |
|  | `camera2d-rotation-smoothing-speed-zero` | warning |
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
