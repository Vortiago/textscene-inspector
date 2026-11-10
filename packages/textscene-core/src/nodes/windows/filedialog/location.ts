/**
 * The folder and the file name a FileDialog shows, as the setters that place it leave them: `set_access`,
 * `set_root_subfolder`, `set_current_dir`, `set_current_file` and `set_current_path`. `parser.ts` replays the
 * scene's lines through them in file order, as the loader sets them.
 *
 * Godot checks that a folder exists (`set_root_subfolder`, `file_dialog.cpp:1332-1335`, and `_change_dir`), and
 * a scene carries no folder listing. A step takes each folder a scene names as existing, which is what the
 * scene's author saw. `access = 2` reads the host's working directory (`DirAccess::create`,
 * `file_dialog.cpp:1517`), so a dialog with it and no folder line shows an empty path.
 */

import { accessRootPath } from '../../../godot/scene/fileDialog';
import { simplifyPath } from '../../../godot/string/string.js';

export interface FileDialogLocation {
  /** The `access` the steps end on: a changed `access` resets `root_subfolder` (`file_dialog.cpp:1509-1516`). */
  access: number;
  root_subfolder: string;
  /** The Path field's text (`update_dir`, `file_dialog.cpp:358-364`). */
  path_text: string;
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

/** What the steps change: `dir` is the current folder, null where only the host knows it. */
interface LocationState {
  access: number;
  dir: string | null;
  rootPrefix: string;
  rootSubfolder: string;
  file: string;
  isNextFolderDisabled: boolean;
}

export const startLocation = (): LocationState => ({
  access: 0,
  dir: accessRootPath(0),
  rootPrefix: '',
  rootSubfolder: '',
  file: '',
  isNextFolderDisabled: false,
});

const isAbsolute = (dir: string) => dir.includes('://') || dir.startsWith('/');

/**
 * `change_dir` joins a relative target to the current folder and simplifies it (`dir_access_unix.cpp:343-366`,
 * `String::simplify_path`). A `..` that climbs out of the root is refused, as measured in Godot 4.6.3: the dialog stays
 * where it was, which is the null this returns. A null `base` is the host's working directory, which a scene does not
 * carry: a relative target then stays relative.
 */
function resolveDir(dir: string, base: string | null): string | null {
  const joined = isAbsolute(dir) || base === null ? dir : base + (base.endsWith('/') ? '' : '/') + dir;
  const simplified = simplifyPath(joined);
  return simplified.split('/').includes('..') ? null : simplified;
}

/** `get_current_dir(false).trim_prefix(root_prefix).trim_prefix("/")` (`file_dialog.cpp:363`). */
function shownDir(dir: string, rootPrefix: string): string {
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
}

function changeDir(state: LocationState, target: string, base: string | null = state.dir): void {
  state.dir = resolveDir(target, base) ?? state.dir;
}

/** `set_root_subfolder` (`file_dialog.cpp:1332-1347`): the folder becomes the root the Path field trims. */
export function setRootSubfolder(state: LocationState, folder: string): void {
  state.rootSubfolder = folder;
  if (folder === '') {
    state.rootPrefix = '';
    return;
  }
  changeDir(state, folder);
  state.rootPrefix = state.dir ?? '';
}

/** `set_current_dir` moves a relative target to the access root first (`file_dialog.cpp:1298-1304`). */
export function setCurrentDir(state: LocationState, target: string): void {
  changeDir(state, target, accessRootPath(state.access));
  state.isNextFolderDisabled = true;
}

/** `set_current_file` leaves a name it already shows alone, and selects the part before the last dot. */
export function setCurrentFile(state: LocationState, name: string): void {
  if (name === state.file) return;
  state.file = name;
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
    path_text: state.dir === null ? '' : shownDir(state.dir, state.rootPrefix),
    is_next_folder_disabled: state.isNextFolderDisabled,
    current_file: state.file,
    file_selection: dot !== -1 ? { begin: 0, end: dot } : null,
  };
}
