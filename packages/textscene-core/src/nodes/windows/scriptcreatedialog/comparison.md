---
type: ScriptCreateDialog
category: Other
status: linter-only
fixture: unit-script-create-dialog.tscn
# image: unit-script-create-dialog
visual: false
renders_as: nothing (a transform-only group)
---

# ScriptCreateDialog

Godot's editor-only "Attach Node Script" popup, built on ConfirmationDialog. It is an editor class (`editor/register_editor_types.cpp:182`), so `ClassDB::instantiate` refuses it outside the editor (`class_db.cpp:579-581`) and the scene loader makes a placeholder in its place (`packed_scene.cpp:316-345`). A game draws nothing for the dialog, and its children still load and draw. The previewer matches: the base `Node` mounts as a transform-only group (ADR-0008).

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
