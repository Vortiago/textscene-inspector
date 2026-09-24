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
grid, connection lines, a toolbar and a minimap. The previewer draws the background panel
and the grid (lines or dots, per `grid_pattern`/`snapping_distance`). It draws every
resolvable `connections` entry as a curved, tinted ribbon
(`connection_lines_curvature`/`connection_lines_thickness`), coloured by the slot of each
endpoint (`get_output_port_position`/`get_input_port_position` in `graph_node.cpp`). It
places every GraphElement child (`GraphNode`/`GraphFrame`) at
`position_offset * zoom - scroll_offset`, as `GraphEdit::_update_scroll_offset` does.
The constructor's `set_clip_contents(true)` (`:3342`) clips all of it to the widget's
rect.

`scroll_offset` and `zoom` are stored values, not authored ones. Each setter clamps
against state an earlier property left behind, and a scene is applied in file order
(`packed_scene.cpp:492`, which parents the node only afterwards at `:541`).
`set_scroll_offset` (`:407`) clamps against `min_scroll_offset`/`max_scroll_offset`.
Both are normally still `(0, 0)`: the handler that writes them runs off
`NOTIFICATION_RESIZED` (`:867`), and `Control::_size_changed` suppresses that outside
the tree (`control.cpp:1812`). `CLAMP` tests its min first (`typedefs.h:139-141`), so
that range is inverted. A negative authored offset lands on `(0, 0)`, and every other
one on minus the size the preceding `offset_*` keys produced.

A `zoom` write that moves the value is the one load-time path that writes the pair first
(`:2448`). It measures a child list that is still empty, so the bounds become `-size`
and `+size`, and the clamp spans `-size` to `(0, 0)`, where an offset inside it
survives. `set_zoom` (`:2434`) clamps against `zoom_min`/`zoom_max` as they stand: the
constructor's `1 / 1.2^8` and `1.2^4` (`:3175-3177`) until the file states otherwise.
Each bound's setter re-runs `set_zoom(zoom)` (`:2487`, `:2502`), which also sets the
disabled flags of the two zoom buttons (`:2445-2446`), unless the clamp changed nothing
and it returned first (`:2435-2437`).

A disabled zoom button keeps the empty box of `FlatButton` (`default_theme.cpp:370`) and
draws its icon at the 0.4 alpha of `icon_disabled_color` (`:169`). `loadOrder.ts`
replays all of it.

It also draws the three pieces of chrome that the GraphEdit C++ constructor builds. They
are present in every GraphEdit, whatever the scene file says:

- The **toolbar** at `(10, 10)`: a `PanelContainer` at its minimum size around an
  `HBoxContainer` of these widgets: the zoom label
  (`round(zoom * 100)%`), three zoom buttons, the grid and snapping toggles, the
  snapping-distance `SpinBox`, the minimap toggle and the arrange button. `show_menu`
  hides the panel. `show_zoom_label`, `show_zoom_buttons`, `show_grid_buttons`,
  `show_minimap_button` and `show_arrange_button` hide widgets inside it, which re-flows
  the row and re-sizes the panel. `show_grid`, `snapping_enabled` and `minimap_enabled`
  each press their toggle, and the SpinBox shows `snapping_distance`.
- The two **scrollbars**, anchored to the bottom and right edges. `_update_scrollbars`
  grows the scroll range past the page in every GraphEdit with a non-zero rect, so both
  are always visible. The size and offset of each grabber come from that range and
  `scroll_offset`.
- The **minimap**, anchored bottom-right, inset 12px, at `minimap_size` (at least 50 per
  axis) and `minimap_opacity`, drawn only while `minimap_enabled`. Inside it are the
  panel, one rect per visible GraphFrame and then GraphNode in its panel colour, every
  connection, and the camera viewport rect. A connection is a 0.5px
  `draw_polyline_colors` polyline, with each point's colour lerped in minimap space and
  a feather that `connection_lines_antialiased` selects. All of it is letterboxed into
  the bounding box of the graph.

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
| `valid-graphedit-properties` | `graphedit-zoom-min-above-max` | error |
|  | `graphedit-scroll-offset-discarded` | info |
<!-- lint:end -->

The lenient parser reads the members that drawing needs, the same way the strict one
does: `scroll_offset`, `zoom`, `zoom_min`, `zoom_max`, `show_grid`, `grid_pattern`,
`snapping_distance`, `snapping_enabled`, `connection_lines_curvature`,
`connection_lines_thickness`, `connection_lines_antialiased`, `connections`, the three
`minimap_*` members and the six `show_*` flags. The others (`type_names`,
`panning_scheme`, `right_disconnects`, `zoom_step`) have no picture to draw, so the
lenient tree carries none of them, and a malformed one does not reach the tree.

## Known limitations

- **Approximated** A GraphElement child's `position` scales with `zoom`, but its drawn
  pixels do not: the previewer cannot apply a container-imposed scale to a child's
  chrome. It is exact at `zoom = 1`, and at any other zoom a child renders at its
  unscaled size. A connection endpoint uses the full
  `(portLocal + position_offset) * zoom - scroll_offset` formula. So at a zoom other
  than 1, the line lands on the port's real position while the node's drawn icon stays
  unscaled beside it.
- **Approximated** Draw order. Godot moves `connections_layer` to just above the grid
  and below every GraphFrame/GraphNode (`graph_edit.cpp:717`), so a connection paints
  over the grid but under every node and frame. This painter draws its connections at
  its `renderOrder`, the same as the grid, so they sit behind every GraphElement child.
  The difference shows only where a node overlaps a line. The toolbar, scrollbars and
  minimap paint above the whole subtree, as the `INTERNAL_MODE_BACK` of `top_layer`
  does.
- **Approximated** Every toolbar button draws its icon and its pressed box, the SpinBox
  draws its field and arrows, and the two zoom buttons draw their disabled state. No
  button draws a hover or focus state.
