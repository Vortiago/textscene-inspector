/**
 * The folder and the file name a FileDialog shows, as the setters that place it leave them: `set_access`,
 * `set_root_subfolder`, `set_current_dir`, `set_current_file` and `set_current_path`. `parser.ts` replays the
 * scene's lines through them in file order, as the loader sets them.
 *
 * Godot refuses a folder that does not exist (`set_root_subfolder`, `file_dialog.cpp:1332-1335`, and
 * `DirAccess::change_dir`). A scene carries no folder listing, so a replay asks `exists`, which a host's listing
 * answers. Without an answer a replay takes each folder a scene names as existing, which is what the scene's author saw.
 * `access = 2` reads the host's working directory (`DirAccess::create`, `file_dialog.cpp:1517`), so a dialog with it and
 * no folder line shows an empty path.
 *
 * The dialog keeps two folders: the one its `DirAccess` stands in, which the file list reads, and the one the Path field
 * and `current_dir` last showed (`update_dir`, `file_dialog.cpp:358-364`). A refused `_change_dir` moves the first and not
 * the second.
 */

import { accessRootPath } from '../../../godot/scene/fileDialog';
import { isAbsolutePath, simplifyPath } from '../../../godot/string/string.js';

/** Whether the folder at a resolved `res://` path exists. True where the host cannot say. */
export type FolderExists = (resolvedFolder: string) => boolean;

export interface FileDialogLocation {
  /** The `access` the steps end on: a changed `access` resets `root_subfolder` (`file_dialog.cpp:1509-1516`). */
  access: number;
  root_subfolder: string;
  /** The Path field's text (`update_dir`, `file_dialog.cpp:358-364`). */
  path_text: string;
  /** The folder the file list shows: where the dialog's `DirAccess` stands. Null where only the host knows it. */
  listed_dir: string | null;
  /**
   * Whether a `set_current_dir` ran: it pushes the folder history, which disables the next-folder button
   * (`_push_history`, `file_dialog.cpp:434-443`). Measured in Godot 4.6.3: the previous-folder button stays as drawn.
   */
  is_next_folder_disabled: boolean;
  /** The File field's text. */
  current_file: string;
  /** The characters `_focus_file_text` selects in it: the name before its last dot (`file_dialog.cpp:56-63`). */
  file_selection: { begin: number; end: number } | null;
}

/** What the steps change. */
interface LocationState {
  access: number;
  /** Where the `DirAccess` stands, null where only the host knows it. */
  dir: string | null;
  /** The folder `update_dir` last showed. */
  shownDir: string | null;
  rootPrefix: string;
  rootSubfolder: string;
  file: string;
  isNextFolderDisabled: boolean;
  exists: FolderExists;
}

export const startLocation = (exists: FolderExists = () => true): LocationState => ({
  access: 0,
  dir: accessRootPath(0),
  shownDir: accessRootPath(0),
  rootPrefix: '',
  rootSubfolder: '',
  file: '',
  isNextFolderDisabled: false,
  exists,
});

/**
 * `change_dir` joins a relative target to the current folder and simplifies it (`dir_access_unix.cpp:343-366`,
 * `String::simplify_path`). A `..` that climbs out of the root is refused, as measured in Godot 4.6.3: the dialog stays
 * where it was, which is the null this returns. A null `base` is the host's working directory, which a scene does not
 * carry: a relative target then stays relative.
 */
function resolveDir(dir: string, base: string | null): string | null {
  const joined = isAbsolutePath(dir) || base === null ? dir : base + (base.endsWith('/') ? '' : '/') + dir;
  const simplified = simplifyPath(joined);
  return simplified.split('/').includes('..') ? null : simplified;
}

/** `get_current_dir(false).trim_prefix(root_prefix).trim_prefix("/")` (`file_dialog.cpp:363`). */
function shownText(dir: string, rootPrefix: string): string {
  if (rootPrefix === '') return dir;
  const rest = dir.startsWith(rootPrefix) ? dir.slice(rootPrefix.length) : dir;
  return rest.startsWith('/') ? rest.slice(1) : rest;
}

/** `set_access` does nothing for the access it already has (`file_dialog.cpp:1509-1516`). */
export function setAccess(state: LocationState, access: number): void {
  if (access === state.access) return;
  state.access = access;
  state.rootPrefix = '';
  state.rootSubfolder = '';
  state.dir = accessRootPath(access);
  state.shownDir = state.dir;
}

/** `DirAccess::change_dir`: the `DirAccess` moves only to a folder that exists. */
function changeDir(state: LocationState, target: string): void {
  const resolved = resolveDir(target, state.dir);
  if (resolved !== null && state.exists(resolved)) state.dir = resolved;
}

/** `FileDialog::_change_dir` (`file_dialog.cpp:1604-1618`): a folder outside the root_subfolder is refused and the Path field is not updated. */
function enterDir(state: LocationState, target: string): void {
  const old = state.dir;
  changeDir(state, target);
  if (state.rootPrefix !== '' && !(state.dir ?? '').startsWith(state.rootPrefix)) {
    state.dir = old;
    return;
  }
  state.shownDir = state.dir;
}

/** `set_root_subfolder` (`file_dialog.cpp:1332-1347`): the folder becomes the root the Path field trims. */
export function setRootSubfolder(state: LocationState, folder: string): void {
  state.rootSubfolder = folder;
  const resolved = resolveDir(folder, state.dir);
  if (folder !== '' && (resolved === null || !state.exists(resolved))) return;
  changeDir(state, folder);
  state.rootPrefix = folder === '' ? '' : (state.dir ?? '');
  state.shownDir = state.dir;
}

/** `set_current_dir` moves a relative target to the access root first and pushes the history even when `_change_dir` refuses it (`file_dialog.cpp:1298-1305,1604-1614`). */
export function setCurrentDir(state: LocationState, target: string): void {
  if (!isAbsolutePath(target)) state.dir = accessRootPath(state.access);
  enterDir(state, target);
  state.isNextFolderDisabled = true;
}

/** `set_current_file` shows `name`, and `update_dir` runs. `finishLocation` selects the part before its last dot. */
export function setCurrentFile(state: LocationState, name: string): void {
  if (state.file === name) return;
  state.file = name;
  state.shownDir = state.dir;
}

/** Splitting `res://y.png` at its last slash leaves `res:/`: the folder is the scheme root. */
const withSchemeRoot = (dir: string) => (dir.endsWith(':/') ? `${dir}/` : dir);

/** `set_current_path` splits at the last `/` or `\` and ignores an empty path (`file_dialog.cpp:1318-1331`). */
export function setCurrentPath(state: LocationState, path: string): void {
  if (path === '') return;
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  if (at !== -1) setCurrentDir(state, withSchemeRoot(path.slice(0, at)));
  setCurrentFile(state, at === -1 ? path : path.slice(at + 1));
}

export function finishLocation(state: LocationState): FileDialogLocation {
  const dot = state.file.lastIndexOf('.');
  return {
    access: state.access,
    root_subfolder: state.rootSubfolder,
    path_text: state.shownDir === null ? '' : shownText(state.shownDir, state.rootPrefix),
    listed_dir: state.dir,
    is_next_folder_disabled: state.isNextFolderDisabled,
    current_file: state.file,
    file_selection: dot !== -1 ? { begin: 0, end: dot } : null,
  };
}
