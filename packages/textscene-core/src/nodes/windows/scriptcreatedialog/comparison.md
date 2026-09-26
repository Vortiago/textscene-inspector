---
type: ScriptCreateDialog
category: Other
status: unimplemented
fixture: unit-script-create-dialog.tscn
# image: unit-script-create-dialog
renders_as: invisible transform-only fallback
---

# ScriptCreateDialog

Godot's editor-only "Attach Node Script" popup, built on ConfirmationDialog. No shipped game scene carries it. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group (ADR-0008).

## Linting

<!-- lint:begin ScriptCreateDialog -->
Strict parsing format-checks the inherited set (1 inherited from ConfirmationDialog, 5 inherited from AcceptDialog, 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node); `ScriptCreateDialog` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
<!-- lint:end -->

ScriptCreateDialog declares no property of its own, so the lenient `Node` reader and the strict linter agree by construction. A bad inherited AcceptDialog or Window value is never read or substituted on the lenient path.

## Known limitations

- **Not drawn** Godot displays the dialog inside the editor. The previewer draws nothing for it.
