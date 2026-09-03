---
type: GraphEdit
category: 2D
status: unimplemented
fixture: unit-graph-edit.tscn
# image: unit-graph-edit
renders_as: invisible transform-only fallback
---

# GraphEdit

Godot draws GraphEdit as a scrollable, zoomable canvas for wiring GraphNodes together: a panel with a grid of lines or dots behind it, curved connection lines between the child nodes' ports, a toolbar of zoom/grid/snapping/arrange buttons, and a minimap in the bottom-right corner. The previewer parses and validates this node but does not draw any of it yet, so it renders as an invisible transform-only fallback and its GraphNode children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `408.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `328.0` | bottom edge of the anchored rect, inherited from Control |
| `scroll_offset` | `Vector2(32, 16)` | shifts the graph contents left and up under the viewport |
| `show_grid` | `true` | the background grid is drawn |
| `grid_pattern` | `1` | `GRID_PATTERN_DOTS`, so the grid is dots rather than lines |
| `snapping_enabled` | `true` | dragged nodes land on grid intersections |
| `snapping_distance` | `40` | the snap step, and the grid line spacing, in pixels |
| `panning_scheme` | `1` | `SCROLL_PANS`, so the mouse wheel pans instead of zooming |
| `right_disconnects` | `true` | a connection can be detached by dragging its right end |
| `type_names` | `{ 0: "Number", 1: "Text" }` | human-readable labels for port types 0 and 1 |
| `connection_lines_curvature` | `0.25` | flattens the bezier connection lines toward straight |
| `connection_lines_thickness` | `6.0` | connection lines are drawn 6 px wide |
| `connection_lines_antialiased` | `false` | connection lines are drawn with hard edges |
| `connections` | one `from_node`/`to_node` dictionary | wires `Source` port 0 to `Sink` port 0 |
| `zoom` | `1.5` | the graph is drawn at 150 percent |
| `zoom_min` | `0.25` | the lower end of the zoom range |
| `zoom_max` | `4.0` | the upper end of the zoom range |
| `zoom_step` | `1.5` | each zoom-in or zoom-out multiplies or divides by 1.5 |
| `minimap_enabled` | `true` | the minimap overlay is shown |
| `minimap_size` | `Vector2(200, 120)` | the minimap rectangle's size in pixels |
| `minimap_opacity` | `0.4` | the minimap is drawn at 40 percent alpha |
| `show_menu` | `true` | the toolbar strip is visible |
| `show_zoom_label` | `true` | the toolbar shows the current zoom percentage |
| `show_zoom_buttons` | `true` | the toolbar's zoom-out/reset/zoom-in buttons are visible |
| `show_grid_buttons` | `false` | the grid and snapping toggles are hidden from the toolbar |
| `show_minimap_button` | `false` | the minimap toggle is hidden from the toolbar |
| `show_arrange_button` | `false` | the auto-arrange button is hidden from the toolbar |

## Divergences

None visible in this fixture.

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
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-graphedit-zoom-limits` | `graphedit-zoom-min-above-max` | error |
<!-- lint:end -->

GraphEdit's lenient parser is `parseControl`, which has no field for any of the
twenty-five members above: it reads Control's layout and theme keys and drops the
rest by never looking at them. So the two parsers diverge in coverage rather than
in value. A `snapping_distance = 500` that strict reports as an error, and a
`grid_pattern = 7` it reports as a warning, both reach the lenient tree as
nothing at all, with no fallback value substituted, because the key is not in
`parseControl`'s schema. Nothing downstream can read a GraphEdit property yet.
