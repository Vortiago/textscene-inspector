import { SCAN_STOP_FILES } from '@textscene/core/godot';
import { LOADED_FILE_EXTENSIONS } from '@textscene/core/resources/resourceProviderUtils';
import { anyCase } from './anyCaseGlob';

/**
 * Every file a preview reads besides its scene and the project file, from core's one list, so a file type the loader
 * gains is watched with no edit here. The linter's glTF files are among them. Any case, since Godot lowers an
 * extension before it picks an importer (`editor_file_system.cpp:1224`) or a loader (`resource_loader.cpp:73`).
 */
export const RESOURCE_FILES_PATTERN = `**/*.{${LOADED_FILE_EXTENSIONS.map((extension) => anyCase(extension.slice(1))).join(',')}}`;

/** The project file watcher in extension.ts feeds the previews and diagnostics. */
export const PROJECT_FILE_PATTERN = '**/project.godot';

/** The GDExtension list the plugin probe reads, in the hidden data directory or the plain one. */
export const EXTENSION_LIST_PATTERN = '**/{.godot,godot}/extension_list.cfg';

// The shared roots watch creation and deletion, and find these files when scanning a project.
export const SCAN_STOP_FILES_PATTERN = `**/{${SCAN_STOP_FILES.join(',')}}`;

// A folder deletion can arrive as one event without separate events for its files.
export const ANY_PATH_PATTERN = '**/*';
