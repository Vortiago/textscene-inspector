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
panel and the grid (lines or dots, per `grid_pattern`/`snapping_distance`), and places
every GraphElement child (`GraphNode`/`GraphFrame`) at
`position_offset * zoom - scroll_offset`, matching `GraphEdit::_update_scroll_offset`.

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

The lenient parser reads the five members drawing needs — `scroll_offset`, `zoom`,
`show_grid`, `grid_pattern`, `snapping_distance` — the same way the strict one does.
The other twenty GraphEdit members (`type_names`, `connections`, the zoom/minimap/
toolbar family) have no picture to draw (below), so the lenient tree carries none of
them; a malformed one reaches the tree as nothing at all, same as before.

## Known limitations

- **Not drawn** The toolbar (zoom controls, minimap, arrange button) is built from
  internal children at a hardcoded runtime position with no scene-authored geometry
  or content — only its six `show_*` visibility bools are real properties.
- **Not drawn** Connection lines are not drawn. `connections` genuinely serialises
  (`set_connections` runs at load time, not only interactively), but each endpoint's
  pixel position comes from the referenced GraphNode's own slot rows — two levels of
  children below what this painter can read from a sibling's solved geometry.
- **Approximated** A GraphElement child's `position` scales correctly with `zoom`,
  but its own drawn pixels do not — the previewer has no way to apply a
  container-imposed scale to a child's chrome. Exact at `zoom = 1`; a child renders
  at its unscaled size at any other zoom.
