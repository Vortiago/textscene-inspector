/**
 * The files Godot 4.6.3 reads at a project's root: its settings, and the GDExtension list in its data directory.
 */

import { stripEdges } from './string.js';

/** The settings file whose directory is the project's `res://` root (`project_settings.cpp:793`). */
export const PROJECT_FILE_NAME = 'project.godot';

/** {@link PROJECT_FILE_NAME} as the `res://` path a provider loads. */
export const PROJECT_FILE_PATH = `res://${PROJECT_FILE_NAME}`;

/**
 * The `res://` path of the project's data directory: `.godot`, or `godot` when
 * `application/config/use_hidden_project_data_directory` is false (`project_settings.cpp:60-61`, `:879-880`). The
 * setting defaults to true (`:1694`).
 */
export function dataDirectoryPath(useHiddenDirectory: boolean): string {
  return `res://${useHiddenDirectory ? '.' : ''}godot`;
}

/**
 * The `res://` path of the file in the data directory that lists the GDExtensions the project loads
 * (`gdextension.cpp:45-46`).
 */
export function extensionListPath(useHiddenDirectory: boolean): string {
  return `${dataDirectoryPath(useHiddenDirectory)}/extension_list.cfg`;
}

/**
 * The extension paths `load_extensions` loads from an `extension_list.cfg`: each line with its edges stripped, a
 * blank one skipped (`gdextension_manager.cpp:324-330`).
 */
export function extensionListEntries(text: string): string[] {
  return text
    .split('\n')
    .map(stripEdges)
    .filter((entry) => entry !== '');
}
