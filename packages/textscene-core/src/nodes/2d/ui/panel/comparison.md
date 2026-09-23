---
type: Panel
category: 2D
status: done
fixture: unit-panel.tscn
image: unit-panel
renders_as: a StyleBox quad
---

# Panel

Panel is a bare rectangular Control that paints its `theme_override_styles/panel`
StyleBox and holds free-anchored children. The previewer draws that StyleBox (fill,
corner arcs and border ring) onto the canvas.

## Linting

<!-- lint:begin Panel -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `Panel` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

Panel adds no properties of its own and forwards straight to `parseControl`, so there is
no Panel-specific lenient fallback beyond what Control covers.
