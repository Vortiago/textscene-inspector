---
type: Container
category: 2D
status: unimplemented
fixture: unit-container.tscn
# image: unit-container
renders_as: nothing yet, not implemented
---

# Container

Container is the abstract base every layout container extends and draws nothing of its
own. The previewer parses and validates it but does not draw it, so it renders as a
transform-only fallback and its children still show.

## Linting

<!-- lint:begin Container -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `Container` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-container-script` | `container-no-script` | warning |
<!-- lint:end -->

Container registers no validators or rules of its own, so the strict and lenient parsers
agree on every property. Whatever the registered base parser reads it reads without
substitution.

## Known limitations

- **Not drawn** The previewer draws nothing for this node. Its children still show at
  their authored offsets.
