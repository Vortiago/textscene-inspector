---
type: VSeparator
category: 2D
status: unreviewed
fixture: unit-v-separator.tscn
# image: unit-v-separator
renders_as: a thin vertical quad
---

# VSeparator

VSeparator draws the default theme's `separator` StyleBoxLine (or a resolved
`theme_override_styles/separator` override) as a thin vertical band, centred on the
cross axis and sized by the `separation` theme constant.

## Linting

<!-- lint:begin VSeparator -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `VSeparator` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

VSeparator declares no property of its own, and `index.ts` reuses `parseControl` unchanged. The two theme overrides are Control's generic `theme_override_*` wildcards, so strict and lenient parsing agree on every key here.
