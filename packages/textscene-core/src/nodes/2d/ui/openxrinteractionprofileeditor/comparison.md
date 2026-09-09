---
type: OpenXRInteractionProfileEditor
category: 2D
status: unimplemented
fixture: unit-open-xr-interaction-profile-editor.tscn
# image: unit-open-xr-interaction-profile-editor
renders_as: invisible transform-only fallback, editor-only UI that no exported game scene ever instantiates
---

# OpenXRInteractionProfileEditor

OpenXRInteractionProfileEditor is the editor's fallback tab for an OpenXR interaction
profile, compiled only into editor builds. The previewer parses and validates it like
any Control but does not draw it, so it renders as a transform-only fallback.

## Linting

<!-- lint:begin OpenXRInteractionProfileEditor -->
Strict parsing format-checks the inherited set (1 inherited from BoxContainer, 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `OpenXRInteractionProfileEditor` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032). `OpenXRInteractionProfileEditor` also REFUSES `vertical`, which its base declares but this class cannot carry.

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

The class binds no property of its own, so strict checks the inherited HBoxContainer set
and rejects `vertical`, which HBoxContainer removes. The lenient parser drops a
malformed `offset_right` or `modulate` silently, since `parseOptionalFloat` and
`parseColorOrUndefined` return `undefined`.

## Known limitations

- **Editor only** Godot builds this panel only inside the editor. The previewer draws
  nothing for it.
