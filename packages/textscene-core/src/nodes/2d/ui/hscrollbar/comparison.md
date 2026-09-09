---
type: HScrollBar
category: 2D
status: unimplemented
fixture: unit-h-scroll-bar.tscn
# image: unit-h-scroll-bar
renders_as: invisible transform-only fallback
---

# HScrollBar

HScrollBar is a horizontal track with a draggable grabber and step buttons. The
previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin HScrollBar -->
Strict parsing format-checks the inherited set (1 inherited from ScrollBar, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HScrollBar` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-range-bounds` (type-family match) | `range-max-below-min` | error |
|  | `range-exp-edit-negative-min` | warning |
<!-- lint:end -->

The lenient parser is `parseControl`, which has no field for `custom_step`, `page`,
`value` or any other Range or ScrollBar member. A malformed `custom_step` is dropped
exactly like a well-formed one.

## Known limitations

- **Not drawn** Godot draws the track and grabber. The previewer draws nothing for this
  node.
