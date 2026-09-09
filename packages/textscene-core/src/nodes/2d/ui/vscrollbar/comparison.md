---
type: VScrollBar
category: 2D
status: unimplemented
fixture: unit-v-scroll-bar.tscn
# image: unit-v-scroll-bar
renders_as: invisible transform-only fallback
---

# VScrollBar

A vertical scroll bar: a track with increment and decrement buttons and a draggable grabber, minimum at the top and maximum at the bottom. The previewer does not draw it yet, so the node is an invisible transform-only fallback and its children still show.

## Linting

<!-- lint:begin VScrollBar -->
Strict parsing format-checks the inherited set (1 inherited from ScrollBar, 9 inherited from Range, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VScrollBar` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

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

The lenient parser is `parseControl`, which has no field for `custom_step`, `page` or `value`. A malformed `value = "nope"` is dropped exactly like a well-formed one, since the reader never looks at the key.

## Known limitations

- **Not drawn** Godot draws the track, the buttons and the grabber. Here the rect stays empty.
