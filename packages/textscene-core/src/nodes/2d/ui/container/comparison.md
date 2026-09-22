---
type: Container
category: 2D
status: unreviewed
fixture: unit-container.tscn
# image: unit-container
renders_as: nothing of its own; children stay at their own free/anchored rects
---

# Container

Container is the base every layout container extends. It draws no chrome, and a bare
Container — Godot's own `_notification` has no `NOTIFICATION_SORT_CHILDREN` arm for it —
imposes no layout either, so its children lay out exactly as free Controls would.

## Linting

<!-- lint:begin Container -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `Container` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
| `valid-container-script` | `container-no-script` | warning |
<!-- lint:end -->

Container registers no validators or rules of its own, so the strict and lenient parsers
agree on every property. Whatever the registered base parser reads it reads without
substitution.
