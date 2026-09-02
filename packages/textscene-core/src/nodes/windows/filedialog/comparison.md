---
type: FileDialog
category: Other
status: unimplemented
fixture: unit-file-dialog.tscn
# image: unit-file-dialog
renders_as: invisible transform-only fallback
---

# FileDialog

A preset dialog for choosing files or directories in the filesystem, building on ConfirmationDialog and adding filters, a customisable browse UI and a dynamic per-dialog options family. It genuinely draws at runtime once popped up, but the previewer only parses and validates it today; it does not draw it yet, so it renders as an invisible transform-only fallback (ADR-0008) and its children still show.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `mode_overrides_title` | `false` | not drawn yet, whether changing `file_mode` also changes the window title |
| `file_mode` | `0` (Open File) | not drawn yet, the dialog's open/save mode |
| `display_mode` | `1` (List) | not drawn yet, file list as a grid of thumbnails vs. a list of filenames |
| `access` | `2` (File System) | not drawn yet, which part of the filesystem the dialog may browse |
| `root_subfolder` | `"levels"` | not drawn yet, the sub-folder the dialog cannot navigate above |
| `filters` | `PackedStringArray("*.png, *.jpg, *.jpeg", "*.tscn")` | not drawn yet, the file type filters offered in the filter dropdown |
| `filename_filter` | `"level"` | not drawn yet, the substring filter applied to file names |
| `show_hidden_files` | `true` | not drawn yet, whether hidden files are shown |
| `use_native_dialog` | `false` | not drawn yet, whether the OS's native file dialog is used instead |
| `option_count` | `2` | not drawn yet, how many extra OptionButtons/CheckBoxes the dialog shows |
| `hidden_files_toggle_enabled` | `true` | not drawn yet, whether the toggle-hidden-files button is shown |
| `file_filter_toggle_enabled` | `true` | not drawn yet, whether the toggle-file-filter button is shown |
| `file_sort_options_enabled` | `true` | not drawn yet, whether the file sort options button is shown |
| `folder_creation_enabled` | `true` | not drawn yet, whether the "New Folder..." option is available |
| `favorites_enabled` | `false` | not drawn yet, whether the favorites list and toggle are shown |
| `recent_list_enabled` | `false` | not drawn yet, whether the recent-directories list is shown |
| `layout_toggle_enabled` | `true` | not drawn yet, whether the list/thumbnail layout buttons are shown |
| `overwrite_warning_enabled` | `true` | not drawn yet, whether saving over an existing file warns first |
| `deleting_enabled` | `false` | not drawn yet, whether the context menu offers "Delete" |

## Divergences

No capture exists yet, FileDialog is `status: unimplemented`, so there is nothing to
compare against Godot.

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
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | warning |
| `valid-filedialog-properties` (type-family match) | `filedialog-option-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser (`parser.ts`) reuses the plain `Node` parser: it reads only the
`[node]` heading's `name`/`parent`/`instance`/`index` attributes plus an optional
`transform` property, and never looks at `file_mode`, `access`, `filters` or any
other FileDialog-specific key at all. A bad `file_mode` value such as `5` (which
`set_file_mode`'s `ERR_FAIL_INDEX` refuses at runtime) is never read, substituted,
or reported by the lenient path: the node still renders as the same empty
transform-only group either way, regardless of what the strict linter above
would flag.
