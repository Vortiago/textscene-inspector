/**
 * Which files of a project the Godot 4.6.3 editor's filesystem scan reaches, and so which GDExtensions it loads before
 * it imports anything (`editor_file_system.cpp:310-334`).
 */

import { PROJECT_FILE_NAME } from './project.js';

/** The extension of a GDExtension's file, matched in any case (`gdextension.cpp:881-893`, `ustring.h:517`). */
export const GDEXTENSION_FILE_EXTENSION = 'gdextension';

/**
 * Files that make the scan skip the directory holding them: another project, or a `.gdignore`
 * (`editor_file_system.cpp:3466-3478`). The root's own `project.godot` is not one: the scan starts inside the root.
 */
export const SCAN_STOP_FILES: readonly string[] = [PROJECT_FILE_NAME, '.gdignore'];

/**
 * Whether the scan enters a directory named `name`: never one whose name starts with a dot
 * (`editor_file_system.cpp:1161-1164`), on every platform. A file is not filtered by name: Windows hides a file by
 * attribute (`dir_access_windows.cpp:112`), and listing one file too many only turns an error into a warning.
 */
export function isScannedDirectoryName(name: string): boolean {
  return !name.startsWith('.');
}

/**
 * Whether the scan reaches the file at `path`, a `res://` path: no directory on the way is dot-named or one of
 * `skippedDirectories`, the `res://` paths of the directories that hold a {@link SCAN_STOP_FILES} file.
 */
export function isScannedPath(path: string, skippedDirectories: ReadonlySet<string>): boolean {
  const directories = path.slice('res://'.length).split('/').slice(0, -1);
  let directory = 'res:/';
  for (const name of directories) {
    directory = `${directory}/${name}`;
    if (!isScannedDirectoryName(name) || skippedDirectories.has(directory)) return false;
  }
  return true;
}
