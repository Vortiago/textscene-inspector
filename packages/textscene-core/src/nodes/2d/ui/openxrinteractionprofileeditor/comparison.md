---
type: OpenXRInteractionProfileEditor
category: 2D
status: unimplemented
fixture: unit-open-xr-interaction-profile-editor.tscn
# image: unit-open-xr-interaction-profile-editor
renders_as: invisible transform-only fallback; editor-only UI that no exported game scene ever instantiates
---

# OpenXRInteractionProfileEditor

Godot compiles this only into editor builds (`TOOLS_ENABLED`) and instantiates it as the fallback tab of the OpenXR Action Map dock (`OpenXRActionMapEditor : EditorDock`) whenever an interaction profile has no custom editor registered for it; it is never present in a game's own scene tree or an exported build. The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `modulate` | `Color(1, 1, 0.7, 1)` | tint, inherited from CanvasItem, a non-default warm-white value |
| `layout_mode` | `1` | anchored layout mode, inherited from Control |
| `offset_left` | `8.0` | left edge of the anchored rect, inherited from Control |
| `offset_top` | `8.0` | top edge of the anchored rect, inherited from Control |
| `offset_right` | `108.0` | right edge of the anchored rect, inherited from Control |
| `offset_bottom` | `40.0` | bottom edge of the anchored rect, inherited from Control |

## Divergences

Not captured yet — nothing renders, so there is nothing to compare pixels against.

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

OpenXRInteractionProfileEditor registers no properties of its own by design
(`_bind_methods` binds only methods, never `ADD_PROPERTY`, on this class and its
abstract base). Every property a scene author can set on it is inherited, so the
strict parser format-checks the whole HBoxContainer/Control/CanvasItem set and
rejects `vertical`, which HBoxContainer removes.

A malformed value here, say `offset_right = garbage` or `modulate = Color(1)`, is
silently dropped by the lenient parser: `parseOptionalFloat` and
`parseColorOrUndefined` return `undefined`, so the property is absent from
the parsed props with no diagnostic and no crash. Only the strict parser catches
it, through the inherited Control/CanvasItem validators reached by the base-walk.
