/** Godot 4.6.3's FileDialog facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `FileDialog::FileMode` (`scene/gui/file_dialog.h:119-125`). */
const FileMode = {
  OPEN_FILE: 0,
  OPEN_FILES: 1,
  OPEN_DIR: 2,
  OPEN_ANY: 3,
  SAVE_FILE: 4,
} as const;

/** `FileDialog::DisplayMode` without its `DISPLAY_MAX` count, the bound `set_display_mode` checks (`file_dialog.h:127-131`, `file_dialog.cpp:1417`). */
const DisplayMode = {
  THUMBNAILS: 0,
  LIST: 1,
} as const;

/** `FileDialog::Access` (`file_dialog.h:113-117`). */
const Access = {
  RESOURCES: 0,
  USERDATA: 1,
  FILESYSTEM: 2,
} as const;

/** Each file mode by its integer, spelled as its constant without `FILE_MODE_` (`file_dialog.cpp:2114`). */
export const FILE_DIALOG_FILE_MODE_NAMES = enumNamesByValue(FileMode);

/** Each display mode by its integer, spelled as its constant without `DISPLAY_` (`file_dialog.cpp:2115`). */
export const FILE_DIALOG_DISPLAY_MODE_NAMES = enumNamesByValue(DisplayMode);

/** Each access scope by its integer, spelled as its constant without `ACCESS_` (`file_dialog.cpp:2116`). */
export const FILE_DIALOG_ACCESS_NAMES = enumNamesByValue(Access);
