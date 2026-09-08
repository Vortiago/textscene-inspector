---
type: HFlowContainer
category: 2D
status: unimplemented
fixture: unit-h-flow-container.tscn
# image: unit-h-flow-container
renders_as: an invisible transform-only fallback
---

# HFlowContainer

HFlowContainer is a FlowContainer fixed to the horizontal axis. The previewer parses and
validates it but does not draw it, so it renders as a transform-only fallback and its
children still show.

## Linting

<!-- lint:begin HFlowContainer -->
Strict parsing format-checks the inherited set (3 inherited from FlowContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `HFlowContainer` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `HFlowContainer` also REFUSES `vertical`, which its base declares but this class cannot carry.

| Property | Accepts | Out of range |
| --- | --- | --- |
| `vertical` | **not available on this type** |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

HFlowContainer declares no member of its own and removes `vertical`. The lenient parser
reuses `parseControl` unchanged and never reads `vertical`, so a scene carrying it
parses the same as one without. Only strict rejects the key.

## Known limitations

- **Not drawn** Godot flows and wraps the children along the row. The previewer applies
  no layout, so they stay at their authored offsets.
