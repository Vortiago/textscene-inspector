---
type: OpenXRBindingModifierEditor
category: 2D
status: unimplemented
fixture: unit-open-xr-binding-modifier-editor.tscn
# image: unit-open-xr-binding-modifier-editor
renders_as: nothing yet, not implemented
---

# OpenXRBindingModifierEditor

Editor-only UI for the OpenXR action-map inspector (`modules/openxr/editor/`); no exported game scene ever instantiates it, since Godot only ever builds one from the editor's own binding-modifier list, never at runtime. The previewer parses and validates it like any Control-family node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `layout_mode` | `1` | anchors-mode Control layout (inherited from Control) |
| `offset_left` / `offset_top` / `offset_right` / `offset_bottom` | `8.0` / `8.0` / `108.0` / `40.0` | positions the panel within its parent (inherited from Control) |
| `size_flags_horizontal` | `1` | `SIZE_FILL`, chosen because it differs from this type's own constructed default of `3` (`SIZE_EXPAND_FILL`, set at `openxr_binding_modifier_editor.cpp:249`); the key itself is Control's, and Godot only serialises it when it departs from the owning class's default |

## Divergences

Not captured yet: nothing renders, so there is nothing to compare pixels against.

## Linting

<!-- lint:begin OpenXRBindingModifierEditor -->
Strict parsing format-checks the inherited set (53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node); `OpenXRBindingModifierEditor` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

OpenXRBindingModifierEditor registers no validators of its own: `_bind_methods`
(`openxr_binding_modifier_editor.cpp:226-231`) binds two methods and one signal,
no `ADD_PROPERTY`, and there is no `_get_property_list`/`_set`/`_get` override,
so every property a `.tscn` can set on this type is inherited from
PanelContainer up. The lenient parser (`parsePanelContainer`) forwards
straight to `parseControl`, so a malformed inherited float such as
`offset_left = "nope"` never reaches a fallback value: `parseOptionalFloat`
returns `undefined` for anything `parseFloat` cannot read, and the property
is silently dropped from the parsed node rather than substituted or reported.
