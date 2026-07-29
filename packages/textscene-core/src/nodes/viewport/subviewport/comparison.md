---
type: SubViewport
category: 3D
status: unreviewed
fixture: unit-sub-viewport.tscn
# image: unit-sub-viewport
renders_as: an invisible boundary that scopes its canvas subtree
---

# SubViewport

A Viewport that renders its subtree into an offscreen target. It draws nothing
itself; what it does is decide **where its subtree draws** — see ADR-0030.

A sub-viewport is a **canvas boundary, not a world boundary**. Godot's
`Viewport` constructor always instantiates its own `World2D`, so
`find_world_2d` never walks up to the parent: CanvasItem descendants (2D world
*and* Control UI) draw nowhere in the parent. But `find_world_3d` falls through
to `parent->find_world_3d()` unless `own_world_3d` is set, so **Node3D
descendants do draw in the parent's 3D view**, exactly as through a plain
`Node`. Measured against Godot 4.6.3, not derived.

The previewer gets both halves from the registration rather than from branching
code: the slice registers with neither `canvasItem` nor `container`, so
`NodeDispatcher`'s existing workspace rules pass it through in the 3D workspace
and drop its whole subtree in the 2D one.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `size` | `Vector2i(256, 256)` | Render-target size in pixels. Default `Vector2i(512, 512)`. Overwritten by a stretching `SubViewportContainer`. |
| `own_world_3d` | `true` | Severs the shared `World3D`, so 3D descendants stop drawing in the parent view. The single most consequential property here. |
| `disable_3d` | `true` | Disables this viewport's own 3D pass. **Does not** hide 3D descendants from the parent view — probe-verified. |
| `transparent_bg` | `true` | Target clears transparent instead of to the opaque project clear colour. |
| `render_target_update_mode` | `0`–`4` | When the target re-renders. Default `2` (WHEN_VISIBLE). Forced to ALWAYS by a `SubViewportContainer` parent. |
| `render_target_clear_mode` | `0`–`2` | How the target clears. Default `0` (ALWAYS). |
| `handle_input_locally` | `false` | Input routing only; no render effect. Forced to `false` by a `SubViewportContainer` parent. |
| `size_2d_override` / `_stretch` | `Vector2i(320, 240)` / `true` | 2D-only size override; `(0, 0)` means unused. |
| `msaa_3d`, `use_debanding`, `canvas_item_default_texture_filter` | enums | Parsed; quality settings the previewer does not reproduce. |
| `audio_listener_enable_2d`, `gui_embed_subwindows` | booleans | Parsed; no render effect in a static previewer. |

## Divergences

- **Quality settings are parsed, not applied.** `msaa_3d`, `use_debanding` and
  `canvas_item_default_texture_filter` describe how Godot rasterises the target;
  the previewer renders through three.js defaults.
- **`handle_input_locally`, `gui_embed_subwindows`, `audio_listener_enable_2d`**
  concern input, subwindow and audio routing, none of which a static preview has.
- **`render_target_update_mode` does not gate rendering.** Godot skips the pass
  for `DISABLED`/`ONCE`; the previewer's target is derived from the scene, so
  there is no per-frame update to skip.
- **A `SubViewportContainer` parent overrides two authored values.** On
  enter-tree it forces `update_mode = ALWAYS` and `handle_input_locally = false`
  on its viewports, so those properties are dead for a contained sub-viewport.
  Not linted, because Godot's own editor writes them anyway.

## Linting

<!-- lint:begin SubViewport -->
Strict parsing format-checks these `SubViewport` properties. Every validator failure is an **error**.

| Property |
| --- |
| `audio_listener_enable_2d` |
| `canvas_item_default_texture_filter` |
| `disable_3d` |
| `gui_embed_subwindows` |
| `handle_input_locally` |
| `msaa_3d` |
| `own_world_3d` |
| `render_target_clear_mode` |
| `render_target_update_mode` |
| `size` |
| `size_2d_override` |
| `size_2d_override_stretch` |
| `transparent_bg` |
| `use_debanding` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-subviewport-properties` | `subviewport-empty-size` | warning |
<!-- lint:end -->

Strict and lenient parsing diverge only on out-of-range enums: the lenient
parser warns and falls back to Godot's default (`render_target_update_mode` → 2,
`render_target_clear_mode` → 0, `msaa_3d` → 0,
`canvas_item_default_texture_filter` → 1), while the strict parser reports an
error. A malformed `size` falls back to `Vector2i(512, 512)`; a zero-area size
parses cleanly and is reported by the advisory `subviewport-empty-size` rule
instead.
