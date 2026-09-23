# GraphEdit engine notes

The engine reasoning behind two GraphEdit modules, too long for a code comment. Every cite is
Godot 4.6.3 source. A bare `:line` is `scene/gui/graph_edit.cpp`.

## Load order (`loadOrder.ts`)

`SceneState::instantiate` sets every property (`scene/resources/packed_scene.cpp:492`) before it
parents the node (`:541`), so each setter below runs outside the tree. Three setters read state
that an earlier key wrote.

### `scroll_offset`

- `Control::_size_changed` updates `data.size_cache` but skips `NOTIFICATION_RESIZED` outside the
  tree (`scene/gui/control.cpp:1812`). The resize handler (`:867`) therefore never calls
  `GraphEdit::_update_scrollbars`, the only writer of `min_scroll_offset` and `max_scroll_offset`
  (`:492-493`).
- Both bounds are still `(0, 0)` when `set_scroll_offset` clamps (`:407`), and `CLAMP` tests the
  min branch first (`core/typedefs.h:139-141`). The range is inverted, and each authored offset
  lands on `0` or on `-size`.
- A `zoom` write that moves the value calls `_update_scrollbars` first (`:2448`). `SceneState`
  parents GraphEdit's children after its own properties, so the child list is still empty then.
  The merged rect is one size out from the origin (`:488-493`), and a later clamp reads the proper
  range, `min_scroll_offset` to `max_scroll_offset - size`, where an authored offset survives.
- `set_scroll_offset` reruns `_update_scrollbars` (`:414`) only after its own clamp, and a file
  writes the key once.

### Size

`get_parent_anchorable_rect` returns an empty `Rect2` outside the tree (`control.cpp:687-689`). Each
`anchor_*` adds zero, so the size is `offset_right - offset_left` by `offset_bottom - offset_top`,
floored by `custom_minimum_size` (`control.cpp:1773-1797`, `:1744-1750`).

### `zoom`

`set_zoom` clamps against `zoom_min` and `zoom_max` as they stand (`:2434`), and each bound's setter
reruns `set_zoom(zoom)` (`:2487`, `:2502`). `set_zoom_custom` returns before it touches the buttons'
disabled flags when the clamp changes nothing (`:2435-2437`), so a bound written after `zoom` moves
neither.

### Not modelled

`anchors_preset` and `layout_mode` rewrite the offsets against the same empty parent rect. Godot's
saver writes them ahead of the `offset_*` keys that overwrite them.

## Connection stroke (`connectionStroke.ts`)

The fragment stage of `default_connections_shader` (`:217-238`):

```glsl
dist = abs(UV.y - 0.5)                              // 0 at the centreline, 0.5 at the edge
fake_aa_width = rim_width = 1.5 / line_width         // UV units; 1.5px in SCREEN space either way
alpha       = smoothstep(0.5, 0.5 - fake_aa_width, dist)
final_color = mix(rim_color, COLOR, smoothstep(0.5 - rim_width, 0.5 - fake_aa_width - rim_width, dist))
```

From each edge inward, 1.5 px fades `rim_color` to alpha 0, 1.5 px blends `rim_color` into the
core colour, and the rest is the core. The port draws these bands as fixed-width rings of vertex
colour.
