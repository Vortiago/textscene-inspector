---
type: HSeparator
category: 2D
status: unreviewed
fixture: unit-h-separator.tscn
# image: unit-h-separator
renders_as: a thin horizontal quad
---

# HSeparator

HSeparator draws the default theme's `separator` StyleBoxLine (or a resolved
`theme_override_styles/separator` override) as a thin horizontal band, centred on the
cross axis and sized by the `separation` theme constant.

## Linting

<!-- lint:begin HSeparator -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HSeparator` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

HSeparator binds no property of its own, only theme items, so `linterParser.ts` declares
nothing for it. The strict and lenient parsers agree on every key, since `index.ts`
reuses `parseControl` unchanged.
