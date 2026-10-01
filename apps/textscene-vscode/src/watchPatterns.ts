/** The globs the extension watches. Each is watched once: `extension.ts` owns the first, `TscnDiagnostics` the others. */

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
