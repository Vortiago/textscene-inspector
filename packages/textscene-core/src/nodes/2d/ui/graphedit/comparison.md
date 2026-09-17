---
type: GraphEdit
category: 2D
status: unreviewed
fixture: unit-graph-edit.tscn
# image: unit-graph-edit
renders_as: a background panel, grid, toolbar, scrollbars and minimap, with GraphElement children placed by position_offset and the whole rect clipped
---

# GraphEdit

GraphEdit is the scrollable, zoomable canvas for wiring GraphNodes together, with a
grid, connection lines, a toolbar and a minimap. The previewer draws the background
panel, the grid (lines or dots, per `grid_pattern`/`snapping_distance`) and every
resolvable `connections` entry as a curved, tinted ribbon (`connection_lines_curvature`/
`connection_lines_thickness`, coloured by each endpoint's own slot, `graph_node.cpp`'s
`get_output_port_position`/`get_input_port_position`), and places every GraphElement
child (`GraphNode`/`GraphFrame`) at `position_offset * zoom - scroll_offset`, matching
`GraphEdit::_update_scroll_offset`. The constructor's `set_clip_contents(true)`
(`:3342`) scissors all of it to the widget's own rect.

`scroll_offset` and `zoom` are STORED values rather than authored ones, because each
setter clamps against state an earlier property left behind and a scene is applied in
the file's own order (`packed_scene.cpp:492`, which parents the node only afterwards at
`:541`). `set_scroll_offset` (`:407`) clamps against `min_scroll_offset`/
`max_scroll_offset`, both still `(0, 0)` because `_update_scrollbars` runs off
`NOTIFICATION_RESIZED` and `Control::_size_changed` suppresses that outside the tree
(`control.cpp:1812`); with `CLAMP` testing its min first (`typedefs.h:139-141`), a
negative authored offset lands on `(0, 0)` and every other one on minus the size the
preceding `offset_*` keys produced. `set_zoom` (`:2434`) clamps against
`zoom_min`/`zoom_max` as they stand — the constructor's `1 / 1.2^8` and `1.2^4`
(`:3175-3177`) until the file states otherwise — and each bound's own setter re-runs
`set_zoom(zoom)` (`:2487`, `:2502`), which also presses the two zoom buttons' disabled
flags (`:2445-2446`) unless the clamp changed nothing and it returned first
(`:2435-2437`). A disabled zoom button keeps `FlatButton`'s empty box
(`default_theme.cpp:370`) and draws its icon at `icon_disabled_color`'s alpha of 0.4
(`:169`). `loadOrder.ts` replays all of it.

It also draws the three pieces of chrome GraphEdit's own C++ CONSTRUCTOR builds, which
are therefore present in every GraphEdit whatever the scene file says:

- The **toolbar** at `(10, 10)` — a `PanelContainer` sized to its own minimum around an
  `HBoxContainer` of up to nine widgets: the zoom label (`round(zoom * 100)%`), three
  zoom buttons, the grid and snapping toggles, the snapping-distance `SpinBox`, the
  minimap toggle and the arrange button. `show_menu` hides the panel itself;
  `show_zoom_label`, `show_zoom_buttons`, `show_grid_buttons`, `show_minimap_button` and
  `show_arrange_button` hide widgets inside it, which re-flows the row and re-sizes the
  panel. `show_grid`, `snapping_enabled` and `minimap_enabled` each press their own
  toggle, and `snapping_distance` is the SpinBox's displayed value.
- The two **scrollbars**, anchored to the bottom and right edges. `_update_scrollbars`
  grows the scroll range past the page in every GraphEdit with a non-zero rect, so both
  are always visible; each grabber's size and offset come from that range and
  `scroll_offset`.
- The **minimap**, anchored bottom-right and inset 12px, at `minimap_size` (floored at
  50 per axis) and `minimap_opacity`, drawn only while `minimap_enabled`. Inside it: the
  panel, one rect per visible GraphFrame then GraphNode in its own panel colour, every
  connection as a 0.5px `draw_polyline_colors` polyline whose per-point colour is lerped
  in minimap space and whose feather `connection_lines_antialiased` selects, and the
  camera viewport rect, all letterboxed into the graph's own bounding box.

## Linting

<!-- lint:begin GraphEdit -->
Strict parsing format-checks these `GraphEdit` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `connection_lines_antialiased` | true or false |  |
| `connection_lines_curvature` | float |  |
| `connection_lines_thickness` | float 0-100 | error below, warning above |
| `connections` | Array literal ([...] or Array[Dictionary]([...])) |  |
| `grid_pattern` | enum 0-1 (GRID_PATTERN_LINES/GRID_PATTERN_DOTS) | warning |
| `minimap_enabled` | true or false |  |
| `minimap_opacity` | float |  |
| `minimap_size` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `panning_scheme` | enum 0-1 (SCROLL_ZOOMS/SCROLL_PANS) | warning |
| `right_disconnects` | true or false |  |
| `scroll_offset` | Vector2(x, y), or the Vector2i spelling Godot converts |  |
| `show_arrange_button` | true or false |  |
| `show_grid` | true or false |  |
| `show_grid_buttons` | true or false |  |
| `show_menu` | true or false |  |
| `show_minimap_button` | true or false |  |
| `show_zoom_buttons` | true or false |  |
| `show_zoom_label` | true or false |  |
| `snapping_distance` | integer 2-100 | error |
| `snapping_enabled` | true or false |  |
| `type_names` | Dictionary literal ({…}) |  |
| `zoom` | float |  |
| `zoom_max` | float |  |
| `zoom_min` | float |  |
| `zoom_step` | float >= 0 | error below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-graphedit-zoom-limits` | `graphedit-zoom-min-above-max` | error |
<!-- lint:end -->

The lenient parser reads the twenty-one members drawing needs — `scroll_offset`, `zoom`,
`zoom_min`, `zoom_max`, `show_grid`, `grid_pattern`, `snapping_distance`,
`snapping_enabled`, `connection_lines_curvature`, `connection_lines_thickness`,
`connection_lines_antialiased`, `connections`, the three `minimap_*` members and the six
`show_*` flags — the same way the strict one does. The remaining four (`type_names`,
`panning_scheme`, `right_disconnects`, `zoom_step`) have no picture to draw, so the
lenient tree carries none of them; a malformed one reaches the tree as nothing at all.

## Known limitations

- **Approximated** A GraphElement child's `position` scales correctly with `zoom`,
  but its own drawn pixels do not — the previewer has no way to apply a
  container-imposed scale to a child's chrome. Exact at `zoom = 1`; a child renders
  at its unscaled size at any other zoom. A connection endpoint still ports the full
  `(portLocal + position_offset) * zoom - scroll_offset` formula, so at a non-1 zoom
  the line lands on the port's REAL position while the node's own drawn icon stays
  unscaled beside it — a visible mismatch that is this same gap, not a new one.
- **Approximated** Draw order: Godot moves `connections_layer` to just above the grid
  and below every GraphFrame/GraphNode (`graph_edit.cpp:717`), so a connection paints
  over the grid but under every node/frame. This painter draws its connections at its
  own `renderOrder`, same as the grid, so they sit behind every GraphElement child —
  invisible unless a node overlaps a line. The toolbar, scrollbars and minimap do paint
  above the whole subtree, matching `top_layer`'s own `INTERNAL_MODE_BACK`.
- **Approximated** Every toolbar button draws its icon, its pressed box and (for the
  SpinBox) its field and arrows, but no hover, focus or disabled state — the same
  static-frame restriction every other Control painter here carries.
