/**
 * The `@textscene/core/godot` package export: the engine facts an app reads. Core imports each fact
 * from its file under a group, so this barrel re-exports only what an app imports through it
 * (`packageExports.test.ts`).
 */

export { PROJECT_FILE_NAME, PROJECT_FILE_PATH } from './project/project.js';
export { SCAN_STOP_FILES, isScannedPath } from './project/editorScan.js';
export { importSidecarPath, isGodotTextResourcePath } from './project/resourceFormats.js';
