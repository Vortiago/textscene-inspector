---
type: GraphEdit
category: 2D
status: unreviewed
fixture: unit-graph-edit.tscn
# image: unit-graph-edit
renders_as: a background panel and grid, with GraphElement children placed by position_offset
---

# GraphEdit

GraphEdit is the scrollable, zoomable canvas for wiring GraphNodes together, with a
grid, connection lines, a toolbar and a minimap. The previewer draws the background
panel, the grid (lines or dots, per `grid_pattern`/`snapping_distance`) and every
resolvable `connections` entry as a curved, tinted ribbon (`connection_lines_curvature`/
`connection_lines_thickness`, coloured by each endpoint's own slot, `graph_node.cpp`'s
`get_output_port_position`/`get_input_port_position`), and places every GraphElement
child (`GraphNode`/`GraphFrame`) at `position_offset * zoom - scroll_offset`, matching
`GraphEdit::_update_scroll_offset`.

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

The lenient parser reads the eight members drawing needs — `scroll_offset`, `zoom`,
`show_grid`, `grid_pattern`, `snapping_distance`, `connection_lines_curvature`,
`connection_lines_thickness`, `connections` — the same way the strict one does. The
other seventeen GraphEdit members (`type_names`, `connection_lines_antialiased`, the
zoom-bound/minimap/toolbar family) have no picture to draw (below), so the lenient
tree carries none of them; a malformed one reaches the tree as nothing at all, same
as before.

## Known limitations

- **Not drawn** The toolbar (zoom controls, minimap, arrange button) is built from
  internal children at a hardcoded runtime position with no scene-authored geometry
  or content — only its six `show_*` visibility bools are real properties.
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
  invisible unless a node overlaps a line.
