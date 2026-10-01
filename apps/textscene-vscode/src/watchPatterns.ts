/** The globs the extension watches. Each is watched once: `extension.ts` owns the first two, `TscnDiagnostics` the others. */

import { SCAN_STOP_FILES } from '@textscene/core/godot';
import { LOADED_FILE_EXTENSIONS } from '@textscene/core/resources/resourceProviderUtils';
import { anyCase } from './anyCaseGlob';

/**
 * Every file a preview reads besides its scene and the project file, from core's one list, so a file type the loader
 * gains is watched with no edit here. The linter's glTF files are among them. Any case, since Godot lowers an
 * extension before it picks an importer (`editor_file_system.cpp:1224`) or a loader (`resource_loader.cpp:73`).
 */
export const RESOURCE_FILES_PATTERN = `**/*.{${LOADED_FILE_EXTENSIONS.map((extension) => anyCase(extension.slice(1))).join(',')}}`;

/** The project file, whose directory is the `res://` root and whose settings the plugin probe reads. */
export const PROJECT_FILE_PATTERN = '**/project.godot';

/** The GDExtension list the plugin probe reads, in the hidden data directory or the plain one. */
export const EXTENSION_LIST_PATTERN = '**/{.godot,godot}/extension_list.cfg';

/**
 * A GDExtension's file, in any case, as the editor's scan finds it (`gdextension.cpp:889-893`, `ustring.h:517`). One
 * created or deleted can change whether the project can add to the glTF importer.
 */
export const GDEXTENSION_PATTERN = `**/*.${anyCase('gdextension')}`;

/**
 * A file that makes the editor's scan skip its directory: a nested `project.godot` or a `.gdignore`. One created or
 * deleted moves the GDExtension files the scan finds. The provider's listing searches with the same glob, so the watch
 * sees each stop file the listing reads.
 */
export const SCAN_STOP_FILES_PATTERN = `**/{${SCAN_STOP_FILES.join(',')}}`;

/**
 * Every path, watched for deletes only. VS Code reports a deleted or moved folder as one delete of the folder and
 * drops the deletes of its files (`EventCoalescer.coalesce`, `watcher.ts:438-468` in VS Code), so no file glob above
 * sees them.
 */
export const ANY_PATH_PATTERN = '**/*';
