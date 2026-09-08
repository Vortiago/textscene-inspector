---
type: CheckButton
category: 2D
status: unimplemented
fixture: unit-check-button.tscn
# image: unit-check-button
renders_as: invisible transform-only fallback
---

# CheckButton

CheckButton is a labelled on-off switch with a themed check icon. The previewer parses
and validates it but does not draw it, so it renders as a transform-only fallback and
its children still show.

## Linting

<!-- lint:begin CheckButton -->
Strict parsing format-checks the inherited set (13 inherited from Button, 10 inherited from BaseButton, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `CheckButton` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
| `valid-button-group` (type-family match) | `button-group-without-toggle-mode` | warning |
<!-- lint:end -->

CheckButton binds no property of its own, only theme items, so the strict and lenient
parsers agree on every key. Whatever the registered base parser reads it reads without
substitution.

## Known limitations

- **Not drawn** Godot draws the switch and its label. The previewer draws nothing for
  this node.
