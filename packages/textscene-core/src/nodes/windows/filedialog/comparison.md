---
type: FileDialog
category: Other
status: unimplemented
fixture: unit-file-dialog.tscn
# image: unit-file-dialog
renders_as: invisible transform-only fallback
---

# FileDialog

A preset dialog for choosing files or directories, built on ConfirmationDialog with filters and a per-dialog options family. The previewer parses and validates it but does not draw it, so it mounts as an invisible transform-only group (ADR-0008).

## Linting

<!-- lint:begin FileDialog -->
Strict parsing format-checks these `FileDialog` properties, plus 1 inherited from ConfirmationDialog, 5 inherited from AcceptDialog, 45 inherited from Window, 47 inherited from Viewport, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `access` | enum 0-2 (RESOURCES/USERDATA/FILESYSTEM) | error |
| `deleting_enabled` | true or false |  |
| `display_mode` | enum 0-1 (THUMBNAILS/LIST) | error |
| `favorites_enabled` | true or false |  |
| `file_filter_toggle_enabled` | true or false |  |
| `file_mode` | enum 0-4 (OPEN_FILE/OPEN_FILES/OPEN_DIR/OPEN_ANY/SAVE_FILE) | error |
| `file_sort_options_enabled` | true or false |  |
| `filename_filter` | quoted string, or the &"…" StringName jacket |  |
| `filters` | string array (PackedStringArray(…), Array[String]([…]) or […]) |  |
| `folder_creation_enabled` | true or false |  |
| `hidden_files_toggle_enabled` | true or false |  |
| `layout_toggle_enabled` | true or false |  |
| `mode_overrides_title` | true or false |  |
| `option_#/*` | option name, values or default |  |
| `option_count` | integer >= 0 | error below |
| `overwrite_warning_enabled` | true or false |  |
| `recent_list_enabled` | true or false |  |
| `root_subfolder` | quoted string, or the &"…" StringName jacket |  |
| `show_hidden_files` | true or false |  |
| `use_native_dialog` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
| `valid-filedialog-properties` (type-family match) | `filedialog-option-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser registers the plain `Node` reader, which reads only the heading attributes and an optional `transform`. A `file_mode` of `5`, which `set_file_mode` refuses at runtime, is never read, substituted or reported on the lenient path.

## Known limitations

- **Not drawn** Godot displays the dialog once popped up. The previewer draws nothing for it.
