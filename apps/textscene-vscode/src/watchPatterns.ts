/** The globs the extension watches. Each is watched once: `extension.ts` owns the first, `TscnDiagnostics` the others. */

/**
 * Every file a preview reads besides its scene, which the linter's glTF files are among. A glTF in either case, since
 * the importer matches the extension case-insensitively and a watcher glob does not.
 */
export const RESOURCE_FILES_PATTERN = '**/*.{tres,png,jpg,jpeg,webp,svg,glb,gltf,GLB,GLTF,tscn}';

/** The project file, whose directory is the `res://` root and whose settings the plugin probe reads. */
export const PROJECT_FILE_PATTERN = '**/project.godot';

/** The GDExtension list the plugin probe reads, in the hidden data directory or the plain one. */
export const EXTENSION_LIST_PATTERN = '**/{.godot,godot}/extension_list.cfg';
