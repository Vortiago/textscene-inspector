/** The globs the extension watches. Each is watched once: `extension.ts` owns the first, `TscnDiagnostics` the others. */

import { SCAN_STOP_FILES } from '@textscene/core/godot';
import { anyCase } from './anyCaseGlob';

/**
 * Every file a preview reads besides its scene, which the linter's glTF files are among. A glTF in any case, since the
 * editor's scan lowers a file's extension before it picks an importer (`editor_file_system.cpp:1224`).
 */
export const RESOURCE_FILES_PATTERN = `**/*.{tres,png,jpg,jpeg,webp,svg,${anyCase('glb')},${anyCase('gltf')},tscn}`;

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
