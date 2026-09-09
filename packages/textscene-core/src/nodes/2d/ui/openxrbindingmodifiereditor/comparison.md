---
type: OpenXRBindingModifierEditor
category: 2D
status: unimplemented
fixture: unit-open-xr-binding-modifier-editor.tscn
# image: unit-open-xr-binding-modifier-editor
renders_as: nothing yet, not implemented
---

# OpenXRBindingModifierEditor

OpenXRBindingModifierEditor is editor-only UI for the OpenXR action-map inspector, which
no exported game scene instantiates. The previewer parses and validates it like any
Control but does not draw it, so it renders as a transform-only fallback.

## Linting

<!-- lint:begin OpenXRBindingModifierEditor -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `OpenXRBindingModifierEditor` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-properties` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
|  | `control-property-order` | warning |
<!-- lint:end -->

The class binds no property of its own, so every key a `.tscn` can set on it is
inherited from PanelContainer up. The lenient parser forwards to `parseControl`, so a
malformed `offset_left` becomes `undefined` and is dropped silently.

## Known limitations

- **Editor only** Godot builds this panel only inside the editor. The previewer draws
  nothing for it.
