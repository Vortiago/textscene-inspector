---
type: ScriptCreateDialog
category: Other
status: unimplemented
fixture: unit-script-create-dialog.tscn
# image: unit-script-create-dialog
renders_as: invisible transform-only fallback
---

# ScriptCreateDialog

Godot's editor-only "Attach Node Script" popup, built on ConfirmationDialog; it is editor UI that no game scene a project ships ever carries, since it exists only inside the running editor to configure and create a new `.gd`/`.cs` file. It draws at runtime when popped up inside the editor, but the previewer only parses and validates it today; it does not draw it yet, so it renders as an invisible transform-only fallback (ADR-0008) and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `title` | `"Attach Node Script"` | not drawn yet, inherited from Window; ScriptCreateDialog overrides only the default value |
| `ok_button_text` | `"Create"` | not drawn yet, inherited from AcceptDialog; ScriptCreateDialog overrides only the default value |
| `dialog_hide_on_ok` | `false` | not drawn yet, inherited from AcceptDialog, unchanged from its own default |

## Divergences

No capture exists yet, since ScriptCreateDialog is `status: unimplemented`, so there is nothing
to compare against Godot.

## Linting

<!-- lint:begin ScriptCreateDialog -->
Strict parsing format-checks the inherited set (1 inherited from ConfirmationDialog, 5 inherited from AcceptDialog, 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `ScriptCreateDialog` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
<!-- lint:end -->

ScriptCreateDialog declares no property of its own, so its whole surface is inherited from
ConfirmationDialog/AcceptDialog/Window: the lenient parser (`index.ts`, the plain `Node`
parse) and the strict linter agree on every property by construction. There is no
ScriptCreateDialog-specific key for either to diverge on. A bad value in an inherited
AcceptDialog/Window property is still never read or substituted by the lenient path; the node
renders as the same empty transform-only group regardless.
