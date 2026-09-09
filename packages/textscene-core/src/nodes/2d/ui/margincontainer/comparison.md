---
type: MarginContainer
category: 2D
status: unreviewed
fixture: unit-margin-container.tscn
image: unit-margin-container
renders_as: a child inset by four margin constants
---

# MarginContainer

MarginContainer insets its single child by four margin constants. The previewer maps it
to a CSS flex box whose padding is those margins and draws nothing itself.

## Linting

<!-- lint:begin MarginContainer -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `MarginContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

The four margins are collected as `theme_override_constants` through
`parseOptionalFloat`, which returns `undefined` with no warning for an absent or
unparseable value. The Component then substitutes `0` for that side, so a garbled
constant removes its padding rather than failing.
