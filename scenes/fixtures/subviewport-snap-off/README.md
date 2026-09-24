# subviewport-snap-off

`unit-subviewport-snap-off.tscn` draws one Control chain twice under
`gui/common/snap_controls_to_pixels = false`: once in the root viewport and
once inside a SubViewport. The scene header names the variable. This file holds
the measurements behind it.

## Why four half-pixel offsets

`Control::_update_canvas_item_transform` snaps each CanvasItem's own transform.
A chain of four 0.5 offsets therefore gives 4 × 0.5 = 2 px between the snapped
and the unsnapped arm. Both end points are whole numbers, so each arm's edges
land on pixel boundaries and neither reading depends on the rasteriser's fill
rule.

One 0.5 offset would be invisible: `floor(x + 0.5)` moves a rect by at most half
a pixel, and a solid rect's edge coverage also rounds to nearest, so both
placements cover the same pixels.

## Measured through Godot 4.6.3

At the 1152×648 project viewport, the root window reports
`is_snap_controls_to_pixels_enabled() == false`, and its SubViewport reports
`true`.

| Arm | Bar position | Green square |
| --- | --- | --- |
| `RootArm`, unsnapped | 100.5 + 0.5 + 0.5 + 0.5 = (102, 62) | x 102..141, y 62..101 |
| `Booth`, snapped inside the SubViewport at (400, 300) | 101 + 1 + 1 + 1 = (104, 64) | x 504..543, y 364..403 |

The two arms are 2 px apart on each axis. Applying the project's opt-out inside
the SubViewport would close that gap to 0.

## Why the reference uses `--mode 2d-root`

The default `--mode 2d` renders the whole scene inside a SubViewport, so both
arms sit in a SubViewport and both read (104, 64). The root window's opt-out
cannot show there, and `pnpm ref:godot` refuses this project in that mode.

## Why the fixture measures an image

`get_global_position()` reports (102, 62) for both arms. The snap acts on the
canvas item transform, never on `get_rect()`, so only the drawn pixels separate
the arms.

The SubViewport holds Controls only, so the Control-raster pass fills its
surface.
