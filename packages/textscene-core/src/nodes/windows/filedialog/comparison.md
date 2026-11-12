---
type: FileDialog
category: Other
fixture: unit-file-dialog.tscn
renders_as: an embedded window with the file chooser's toolbar, lists, filter and options
---

# FileDialog

A preset dialog for choosing files or directories. It builds on ConfirmationDialog and adds filters and options. The previewer draws a visible dialog as an embedded window. It shows the toolbar, the Favorites and Recent lists, the file list, the filter and the options over the button row. The file list shows the entries of the shown folder, folders first, as Godot lists them.

## Open File
<!-- compare: image=unit-file-dialog-open-empty status=limitation fixture=file-dialog-open-empty/unit-file-dialog-open-empty.tscn -->

A dialog in Open File mode over a folder with no matching file. The OK button is disabled, as Godot disables it while nothing is selected.

## Save File
<!-- compare: image=unit-file-dialog-save-empty status=limitation fixture=file-dialog-save-empty/unit-file-dialog-save-empty.tscn -->

Save File mode adds the create-folder button, titles the window "Save a File" and enables the Save button.

## Options
<!-- compare: image=unit-file-dialog-options status=limitation fixture=file-dialog-options/unit-file-dialog-options.tscn -->

A CheckBox option and a value option draw in the options row and the option grid under the filter.

## Current path
<!-- compare: image=unit-file-dialog-current-path status=limitation fixture=file-dialog-current-path/unit-file-dialog-current-path.tscn -->

`current_path` puts the dialog in a folder and a file name in the File field. The name before its dot is selected, and the next-folder button is disabled, as in Godot.

## File list
<!-- compare: image=unit-file-dialog-listing status=limitation fixture=file-dialog-listing/unit-file-dialog-listing.tscn -->

The list holds the folders of `res://`, then the files that match the first filter, each in natural order that ignores case. The first row is selected, and a folder row leaves the File field empty.

## List display mode
<!-- compare: image=unit-file-dialog-listing-list-mode status=limitation fixture=file-dialog-listing/unit-file-dialog-listing-list-mode.tscn -->

`display_mode = 1` lists the entries in one column of 16 px icons.

## Current file
<!-- compare: image=unit-file-dialog-listing-current-file status=limitation fixture=file-dialog-listing/unit-file-dialog-listing-current-file.tscn -->

`current_file` selects the row of that name and puts the name in the File field. The list draws the current row under a cursor box only in Open Files mode.

## Missing root subfolder
<!-- compare: image=unit-file-dialog-listing-missing-subfolder status=limitation fixture=file-dialog-listing/unit-file-dialog-listing-missing-subfolder.tscn -->

A `root_subfolder` that names no folder is kept and ignored, so the dialog lists `res://`.

## Theme icon
<!-- compare: image=unit-file-dialog-theme-icon status=limitation fixture=file-dialog-theme-icon/unit-file-dialog-theme-icon.tscn -->

The Cancel and OK buttons draw the theme icon `icon` of `Button`, and the filter button draws the one of `OptionButton`. The toolbar buttons keep their own icons.

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
| `filename_filter` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `filters` | string array (PackedStringArray(…), Array[String]([…]) or […]) |  |
| `folder_creation_enabled` | true or false |  |
| `hidden_files_toggle_enabled` | true or false |  |
| `layout_toggle_enabled` | true or false |  |
| `mode_overrides_title` | true or false |  |
| `option_#/*` | option name, values or default |  |
| `option_count` | integer >= 0 | error below |
| `overwrite_warning_enabled` | true or false |  |
| `recent_list_enabled` | true or false |  |
| `root_subfolder` | quoted string, or the &"…" StringName or NodePath("…") it converts |  |
| `show_hidden_files` | true or false |  |
| `use_native_dialog` | true or false |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-window-properties` (type-family match) | `window-max-size-below-min-size` | info |
|  | `window-size-clamped-by-limits` | warning |
|  | `window-content-scale-factor-floored` | warning |
|  | `window-force-native-refused-while-visible` | error |
| `valid-filedialog-properties` (type-family match) | `filedialog-option-index-out-of-range` | error |
<!-- lint:end -->

The lenient parser replays `title`, `file_mode`, `mode_overrides_title` and the `option_*` lines in file order, as Godot's loader sets them. It replays the placing lines the same way: `access`, `root_subfolder`, `current_dir`, `current_file` and `current_path`. A value the setter refuses, such as a `file_mode` of `9`, keeps the previous one. A changed `access` resets `root_subfolder`. The seven customisation flags default to true. Godot does not save `current_dir`, `current_file` or `current_path`, but the parser reads them as the loader would.

## Known limitations

- **Not drawn** The Favorites and Recent lists stay empty, since a scene does not carry them.
- **Approximated** A `user://` or filesystem folder lists no entry, since the host holds no such folder for a scene.
- **Approximated** `access = 2` opens the host's working directory and drive list (`file_dialog.cpp:1517,1620`), which a scene does not carry, so the path field is empty.
