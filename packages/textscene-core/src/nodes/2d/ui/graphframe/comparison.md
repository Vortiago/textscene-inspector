---
type: GraphFrame
category: 2D
status: unimplemented
fixture: unit-graph-frame.tscn
# image: unit-graph-frame
renders_as: nothing yet — not implemented
---

# GraphFrame

GraphFrame is a special GraphElement used to group and auto-resize around other
GraphElements inside a GraphEdit; the previewer parses and validates this node but
does not draw it yet, so it renders as an invisible transform-only fallback and its
children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `title` | `"Notes"` | Format-checked only; the previewer draws nothing regardless. |
| `autoshrink_enabled` | `true` | Format-checked only. |
| `autoshrink_margin` | `40` | Format-checked only; within the 0-128 hint. |
| `drag_margin` | `16` | Format-checked only; within the 0-128 hint. |
| `tint_color_enabled` | `true` | Format-checked only. |
| `tint_color` | `Color(0.3, 0.3, 0.3, 0.75)` | Format-checked only. |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin GraphFrame -->
Strict parsing format-checks these `GraphFrame` properties, plus 6 inherited from GraphElement, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `autoshrink_enabled` | true or false |  |
| `autoshrink_margin` | integer 0-128 | warning |
| `drag_margin` | integer 0-128 | warning |
| `tint_color` | Color(r, g, b, a) |  |
| `tint_color_enabled` | true or false |  |
| `title` | quoted string, or the &"…" StringName jacket |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-graph-element-selection` (type-family match) | `graph-element-selected-not-selectable` | error |
<!-- lint:end -->

The lenient parser reuses `parseControl` unchanged (`index.ts`), which reads only
the Control layout/theme-override keys, so none of GraphFrame's own properties are
read by it at all. An out-of-range `autoshrink_margin` (say `200`) or a malformed
`tint_color` therefore never reaches the lenient tree in any form, substituted or
otherwise: strict reports it as a diagnostic, and lenient simply never looks at the
key, leaving the fallback node exactly as unaffected as a well-formed value would.
