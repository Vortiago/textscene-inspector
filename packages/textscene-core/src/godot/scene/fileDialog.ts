/** Godot 4.6.3's FileDialog facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';
import { stripEdges } from '../string/string.js';

/** `FileDialog::FileMode` (`scene/gui/file_dialog.h:119-125`). */
const FileMode = {
  OPEN_FILE: 0,
  OPEN_FILES: 1,
  OPEN_DIR: 2,
  OPEN_ANY: 3,
  SAVE_FILE: 4,
} as const;

/** `FileDialog::DisplayMode` without its `DISPLAY_MAX` count, the bound `set_display_mode` checks (`file_dialog.h:127-131`, `file_dialog.cpp:1417`). */
export const DisplayMode = {
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

/** `FileDialog::set_file_mode`'s per-mode default OK text and title (`file_dialog.cpp:1362-1400`), by `FileMode`. */
export const FILE_MODE_TEXT: Readonly<Record<number, { okText: string; title: string }>> = {
  [FileMode.OPEN_FILE]: { okText: 'Open', title: 'Open a File' },
  [FileMode.OPEN_FILES]: { okText: 'Open', title: 'Open File(s)' },
  [FileMode.OPEN_DIR]: { okText: 'Select Current Folder', title: 'Open a Directory' },
  [FileMode.OPEN_ANY]: { okText: 'Open', title: 'Open a File or Directory' },
  [FileMode.SAVE_FILE]: { okText: 'Save', title: 'Save a File' },
};

/** The file mode a `FileDialog` starts in (`file_dialog.h:119`): `mode = FILE_MODE_SAVE_FILE`. */
export const DEFAULT_FILE_MODE = FileMode.SAVE_FILE;

/**
 * Whether `mode` picks files only: it hides the create-folder button (`file_dialog.cpp:1570-1573`) and, with nothing
 * selected, disables the OK button (`_is_open_should_be_disabled`, `:549-557`).
 */
export function isOpenFileMode(mode: number): boolean {
  return mode === FileMode.OPEN_FILE || mode === FileMode.OPEN_FILES;
}

/** The root a `FileDialog` shows in its path field, by `Access` (`file_dialog.cpp:1509-1538`, `DirAccess::get_current_dir(false)`). */
export function accessRootPath(access: number): string | null {
  if (access === Access.RESOURCES) return 'res://';
  if (access === Access.USERDATA) return 'user://';
  return null;
}

/**
 * The text the filter OptionButton shows for its first item (`update_filters`, `file_dialog.cpp:1117-1201`): the
 * "All Recognized" entry when more than one filter is set, else the first filter as "description (patterns)",
 * or "(patterns)" with no description, else "All Files (*.*)".
 */
export function firstFilterLabel(filters: readonly string[]): string {
  if (filters.length === 0) return ALL_FILES_LABEL;
  if (filters.length > 1) return `All Recognized (${recognisedPatterns(filters)})`;
  const [patterns, description] = filterFields(filters[0]!);
  return description === '' ? `(${patterns})` : `${description} (${patterns})`;
}

const ALL_FILES_LABEL = 'All Files (*.*)';

/** `max_filters`: the "All Recognized" entry names this many filters, then "..." (`file_dialog.cpp:1126`). */
const MAX_RECOGNISED_FILTERS = 5;

/** A filter's `patterns ; description` parts, each stripped (`get_slicec(';', n).strip_edges()`). */
function filterFields(filter: string): [patterns: string, description: string] {
  const parts = filter.split(';').map(stripEdges);
  return [parts[0] ?? '', parts[1] ?? ''];
}

function recognisedPatterns(filters: readonly string[]): string {
  const named: string[] = [];
  for (const filter of filters.slice(0, MAX_RECOGNISED_FILTERS)) {
    const [patterns] = filterFields(filter);
    if (patterns !== '') named.push(patterns);
  }
  const names = named.join(', ');
  return filters.length > MAX_RECOGNISED_FILTERS ? `${names}, ...` : names;
}

/** The `FileDialog` theme icons its buttons show (`NOTIFICATION_THEME_CHANGED`, `file_dialog.cpp:287-299`). */
export const FILE_DIALOG_THEME_ICONS = [
  'back_folder',
  'forward_folder',
  'parent_folder',
  'reload',
  'favorite',
  'create_folder',
  'toggle_hidden',
  'thumbnail_mode',
  'list_mode',
  'toggle_filename_filter',
  'sort',
  'favorite_up',
  'favorite_down',
] as const;

export type FileDialogThemeIcon = (typeof FILE_DIALOG_THEME_ICONS)[number];

/** The size of every FileDialog icon (`scene/theme/icons/`, 16x16). */
export const FILE_DIALOG_ICON_SIZE: Readonly<{ x: number; y: number }> = { x: 16, y: 16 };

/** `favorite_list` and `recent_list` floor their width at `128 * get_theme_default_base_scale()` (`file_dialog.cpp:261-262`). */
export const FILE_DIALOG_SIDE_LIST_MINIMUM_WIDTH = 128;
